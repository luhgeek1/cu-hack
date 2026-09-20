# AGENT.md

## Project: PALATA

### Hackathon context

We are building a solution for **CU@Hack, Case 3 — «Честный месяц»**.

Hackathon duration: **~5 hours**.

Team:
- 2 Frontend developers
- 2 Backend developers
- 1 ML/AI developer

Development style:
- Fast parallel vibe-coding
- Prefer working end-to-end product slices over overengineered architecture
- Do not train custom ML models
- Gemini API may be used where LLM reasoning is useful
- Every agent must coordinate through `AGENT_PROGRESS.md`

---

# 1. Problem

Existing personal-finance apps usually fail in one of two ways:

1. Manual tracking gives accurate analytics but requires too much daily effort.
2. Automatic bank imports reduce user effort, but transaction classification is often wrong.

The core issue:

> **A bank transaction is not always a real expense or income.**

Examples:
- Transfer between user's own accounts is neither expense nor income.
- Lending money is not an expense.
- Repayment of debt is not income.
- Refund from a shop is not income.
- If user paid for a group and friends reimburse them, only user's own share is a real expense.
- Topping up a marketplace card is not an expense; later purchases from that card are.
- Cash withdrawal needs an explicit policy.

The product must simultaneously provide:
1. Very low user effort.
2. Correct numbers.
3. A reason to return regularly.

---

# 2. Product concept

Working product concept:

> **We do not classify transactions. We reconstruct real financial events.**

The system receives transactions from multiple accounts/banks, links related operations together, and produces a set of higher-level financial events.

Examples:

```text
T-Bank -10 000 ₽
Sber   +10 000 ₽
→ OWN_TRANSFER
→ expense = 0
→ income = 0
```

```text
Restaurant -8 000 ₽
+1 600 ₽ "за ужин"
+1 600 ₽ "ужин"
+1 600 ₽ "рестик"
+1 600 ₽ "за вчера"
→ SHARED_EXPENSE
→ real user expense = 1 600 ₽
```

The main promise:

> **The user should not have to maintain a budget manually. The system does the work and asks the user only when confidence is low.**

Target interaction metric:

- Normal day: **0 user actions**
- Ambiguous case: **1 tap**

---

# 3. Mandatory case requirements

The hackathon solution MUST demonstrate:

1. Convenient addition/import of operations.
2. A real mechanism that motivates regular usage.
3. Correct handling of the required difficult transaction scenarios.
4. Analytics for different periods: day / week / month / year.
5. Totals must be consistent between periods.
6. Demo dataset with at least ~50 transactions.
7. Working product demo and pitch.

Required transaction/event scenarios:

- Normal expense
- Normal income
- Transfer between user's own accounts
- Marketplace-card top-up + later purchases
- Loan given
- Partial loan repayment over time
- Group/shared expense with reimbursements
- Incoming payment such as "за обед" without known context
- Product refund
- Cash withdrawal

Do not fake the arithmetic with an LLM.

All money totals and event linking rules must be deterministic in backend code.

---

# 4. Current product flow

## 4.1 Authentication / bank connection

We want the user experience to feel like:

```text
Sign in
↓
Connect banks
↓
T-Bank / Sber / Alfa / marketplace bank
↓
Grant access
↓
Sync transactions
↓
PALATA dashboard
```

Important:

For the hackathon, **do not spend time on real production banking integrations**.

Use a sandbox/mock Open Banking flow.

The UI may imitate a realistic OAuth/Open Banking connection flow, but the backend can return prepared transaction datasets.

Architecture should keep the bank source replaceable later.

Recommended abstraction:

```text
BankProvider
  ├── MockTBankProvider
  ├── MockSberProvider
  ├── MockAlfaProvider
  └── future real provider
```

The source of transactions must not be coupled to the Money Engine.

---

# 5. Core pipeline

```text
Bank / Mock Bank
      ↓
Transactions
      ↓
Normalization
      ↓
Matching Engine
      ↓
Financial Events
      ↓
Gemini semantic enrichment
      ↓
Confidence / ambiguity
      ↓
Analytics
      ↓
Frontend
```

Important distinction:

### Backend code decides:
- amounts
- dates
- transaction matching
- totals
- analytics
- period aggregation
- deterministic rules

### Gemini may help with:
- payment description interpretation
- merchant/category interpretation
- semantic intent
- short explanations
- natural-language summaries

Gemini must NOT be the source of truth for financial arithmetic.

---

# 6. Main entities

## User

Suggested fields:

```ts
id
name
email?
createdAt
```

## Account

```ts
id
userId
bank
name
accountType
currency
balance
externalId?
```

## Transaction

Raw/normalized bank operation.

```ts
id
accountId
amount
currency
timestamp
direction // debit | credit
merchant?
description?
category?
sourceBank
externalId?
```

## FinancialEvent

Higher-level real-world event.

Possible event types:

```text
EXPENSE
INCOME
OWN_TRANSFER
DEBT_GIVEN
DEBT_REPAYMENT
REFUND
SHARED_EXPENSE
MARKETPLACE_TRANSFER
CASH_WITHDRAWAL
UNKNOWN
```

Suggested fields:

```ts
id
type
title
amount
effectiveExpense
effectiveIncome
confidence
status // auto | needs_attention | confirmed
createdAt
```

## TransactionLink

Links one or more raw transactions to one financial event.

```ts
id
eventId
transactionId
role
```

---

# 7. Matching Engine

This is the most important backend logic.

Do not overcomplicate it.

For the hackathon, simple deterministic heuristics are enough.

## 7.1 Own-account transfer

Detect matching debit/credit:

- same absolute amount
- close timestamps
- accounts belong to same user
- possibly matching descriptions

Result:

```text
OWN_TRANSFER
effectiveExpense = 0
effectiveIncome = 0
```

---

## 7.2 Refund

Possible rule:

- same or similar merchant
- opposite direction
- same amount or amount compatible with previous purchase
- occurs after original purchase

Result:

```text
REFUND
```

Refund should reduce effective spending and should not be treated as income.

---

## 7.3 Debt

Possible rule:

- outgoing person-to-person transfer
- later incoming transfers from same counterparty
- repayments may be partial
- total repayments may accumulate over time

Example:

```text
-3000
+1500
+1500
```

Result:

```text
DEBT_GIVEN
DEBT_REPAYMENT
```

These should not distort income/expense analytics.

---

## 7.4 Shared/group expense

Example:

```text
Restaurant -8000
+1600
+1600
+1600
+1600
```

If reimbursements are semantically related and close enough in time:

```text
real expense = 8000 - 6400 = 1600
```

This should become one high-level event.

---

## 7.5 Marketplace card

Example:

```text
T-Bank -6000
Ozon Bank +6000
```

This is movement between user's accounts.

Later:

```text
Ozon Bank -800 groceries
Ozon Bank -2300 electronics
Ozon Bank -900 household
```

Those later transactions are actual expenses.

---

## 7.6 Ambiguous incoming payment

Example:

```text
+500 ₽
"за обед"
```

If there is no matching known debt/shared expense, do not confidently classify it.

Set:

```text
status = needs_attention
```

Frontend should ask user for one-tap clarification.

---

# 8. Confidence model

Each detected event should have a confidence value.

Example:

```text
Own transfer: 0.99
Refund: 0.94
Shared expense repayment: 0.88
Unknown incoming payment: 0.61
```

Suggested behavior:

```text
confidence >= threshold
→ auto-classify

confidence < threshold
→ needs_attention
```

The exact threshold can be tuned for the demo.

The goal is not scientific calibration.

The goal is to support the product idea:

> **Automatically handle obvious cases and ask the user only when needed.**

---

# 9. Gemini role

Gemini is optional but useful.

Use Gemini mainly to normalize intent from human payment descriptions.

Example input:

```text
"вернул за рестик"
```

Expected structured output:

```json
{
  "intent": "shared_expense_repayment",
  "confidence": 0.94
}
```

Example:

```text
"вернул долг"
```

Output:

```json
{
  "intent": "debt_repayment",
  "confidence": 0.98
}
```

Prefer structured JSON responses.

Do not send the full application state if unnecessary.

Do not make Gemini responsible for financial arithmetic.

---

# 10. Killer features

## Priority A — must implement if possible

### 10.1 Bank thinks / Actually

Very strong demo screen.

Example:

```text
Bank transactions say:
64 020 ₽ spent

Our Money Engine:
38 420 ₽ real spending
```

Breakdown:

```text
Own transfers       -10 000 ₽
Marketplace top-up   -6 000 ₽
Friend repayments    -6 400 ₽
Refund               -3 200 ₽
```

This should immediately explain the value of the product.

---

### 10.2 Money Graph

Visualize how raw transactions combine into one event.

Example:

```text
                    Restaurant
                     -8000 ₽
                        │
         ┌──────────────┼──────────────┐
         ↓              ↓              ↓
      +1600 ₽         +1600 ₽       +1600 ₽
        Anton            Misha           Katya
                        │
                     +1600 ₽
                       Dima

Real expense:
1600 ₽
```

The graph does not need to be technically complex.

The purpose is:
- explainability
- visual wow-effect
- prove why totals are correct

---

### 10.3 Needs Attention

Show only ambiguous events.

Example:

```text
+500 ₽
"за обед"

What was this?

[Returned money]
[Income]
[Transfer]
[Other]
```

One tap resolves the event.

After resolving, analytics should update.

---

### 10.4 Live recalculation

Important demo moment.

User resolves an ambiguous transaction.

Then:

1. Event graph updates
2. Monthly total updates
3. "Bank thinks / Actually" delta updates

This is one of the strongest live-demo moments.

---

## Priority B — implement only if core is stable

### 10.5 Explain My Month

Button:

```text
Why 38 420 ₽?
```

Show exactly how the final number was calculated.

---

### 10.6 Cross-bank brain

Show that the app understands accounts across multiple banks belong to the same user.

Useful for own-account transfers and marketplace cards.

---

### 10.7 Debt timeline

Example:

```text
You lent Anton 3000 ₽
↓
1500 ₽ returned
↓
1500 ₽ returned
↓
Debt closed
```

---

### 10.8 Subscription detection

Detect repeating payments.

Example:

```text
Yandex Plus
299 ₽ / month
```

Could be shown as:

```text
Recurring expenses:
2840 ₽ / month
```

---

### 10.9 Monthly AI summary

Gemini may generate a short summary based ONLY on backend-computed numbers.

Example:

```text
In September your real spending was 38 420 ₽.
Restaurant spending increased by 34%.
16 000 ₽ of bank debits were internal transfers, not expenses.
```

---

# 11. Main frontend areas

Exact design is intentionally NOT fixed.

Frontend agents should design the UI themselves.

But the product should support these conceptual areas:

- onboarding / authentication
- bank connection
- sync state
- monthly dashboard
- transaction/event feed
- event details
- Money Graph
- needs attention
- analytics by period
- explanation of total

Mobile-first is preferred because this is a personal-finance product.

Do not create unnecessary screens.

Focus on demo quality.

---

# 12. Analytics

Required periods:

```text
day
week
month
year
```

All period totals MUST come from the same FinancialEvent source of truth.

Do not separately calculate weekly and monthly values from unrelated mock numbers.

Required:

```text
sum(weeks in month) == month total
```

where period boundaries make this applicable.

Recommended analytics:

- real expenses
- real income
- category breakdown
- comparison with previous period
- amount excluded from bank "spending"
- needs attention count

---

# 13. Demo dataset

Target:

```text
50–100 transactions
```

Must contain:

- ordinary purchases
- ordinary salary/income
- own-account transfer
- marketplace-card transfer
- purchases from marketplace card
- loan given
- loan repayment in multiple parts
- shared restaurant bill
- several reimbursements
- ambiguous incoming "за обед"
- refund
- cash withdrawal
- some recurring transactions

The dataset is BOTH:
1. test data
2. demo material

Keep it realistic.

---

# 14. Demo script

Recommended live demo:

## Step 1
Open product as new user.

## Step 2
Sign in / authenticate.

## Step 3
Connect 2–3 mock banks.

## Step 4
Transactions sync automatically.

## Step 5
Show:

```text
Banks think:
64 020 ₽ spent

PALATA:
38 420 ₽ real spending
```

## Step 6
Open explanation.

Show:
- own transfer
- refund
- debt
- group expense
- marketplace card

## Step 7
Open Money Graph for shared dinner.

## Step 8
Open "Needs Attention".

Resolve:

```text
+1600 ₽ "за ужин"
```

as shared-expense repayment.

## Step 9
Live recalculation happens.

## Step 10
Finish on analytics/dashboard.

Main pitch:

> **Banks show transactions. We reconstruct what actually happened with your money.**

Alternative formulation:

> **Other finance apps classify transactions. We reconstruct financial events.**

---

# 15. Priorities for 5-hour hackathon

## P0 — must work

- Basic auth or demo auth
- Mock bank connection
- Import/sync demo dataset
- Transaction normalization
- FinancialEvent model
- Own-account transfer matching
- Debt scenario
- Shared expense scenario
- Refund scenario
- Marketplace-card scenario
- Analytics for week/month
- Needs Attention
- Working frontend demo

## P1 — strong additions

- Money Graph
- Bank thinks / Actually
- Live recalculation
- Gemini semantic intent parsing
- multiple periods

## P2 — only if time remains

- subscriptions
- anomalies
- AI monthly summary
- fancy animation
- advanced settings
- support for more bank providers

Never sacrifice P0 for P2.

---

# 16. What NOT to do

Do NOT:

- train a custom ML model
- integrate real production bank APIs unless credentials are already available
- spend hours on auth infrastructure
- let Gemini calculate financial totals
- hardcode analytics independently from backend events
- build five import methods
- build features unrelated to the case
- create overengineered microservices
- rewrite stable code without a clear reason
- break other agents' work

One working path is better than five unfinished ones.

---

# 17. API sketch

This is a guideline, not a strict contract.

Possible endpoints:

```text
POST /auth/login

GET  /banks
POST /banks/connect
POST /banks/:id/sync

GET  /accounts
GET  /transactions

GET  /events
GET  /events/:id
POST /events/:id/resolve

GET  /attention

GET  /analytics?period=day
GET  /analytics?period=week
GET  /analytics?period=month
GET  /analytics?period=year

GET  /analytics/explanation
```

If the backend team chooses different endpoints, document them in `AGENT_PROGRESS.md`.

---

# 18. Agent coordination protocol

This repository may be edited by multiple coding agents at the same time.

ALL AGENTS MUST FOLLOW THESE RULES.

## Before starting any task

1. Read this entire `AGENT.md`.
2. Read the latest `AGENT_PROGRESS.md`.
3. Inspect the current repository before assuming a component/API does not exist.
4. Check what other agents are currently working on.
5. Reuse existing code where reasonable.
6. Avoid editing the same files as another active agent unless necessary.

---

## When starting work

Append a new entry to `AGENT_PROGRESS.md`.

Format:

```md
## [IN PROGRESS] <short task name>

Agent: <agent name/id if known>
Started: <timestamp or approximate time>

Goal:
- ...

Files expected to change:
- `path/file`
- `path/file`

Dependencies:
- ...

Notes:
- ...
```

Do NOT delete other agents' entries.

---

## While working

If you make an architectural/API decision that affects other agents, immediately append it to `AGENT_PROGRESS.md`.

Example:

```md
### Decision
`GET /analytics` now returns:
{
  "realExpense": number,
  "bankExpense": number,
  "excluded": [...]
}
```

Do not silently change shared contracts.

---

## When finishing work

Update or append your task entry as:

```md
## [DONE] <task name>

Agent: <agent name/id>
Completed: <timestamp or approximate time>

Implemented:
- ...
- ...

Files changed:
- `...`
- `...`

API/contracts added or changed:
- ...

How to test:
- ...

Remaining issues:
- ...

Next recommended task:
- ...
```

---

## If blocked

Write:

```md
## [BLOCKED] <task>

Reason:
- ...

Need:
- ...

Safe workaround:
- ...
```

Then continue with another independent task if possible.

---

# 19. Shared-file discipline

Prefer modular changes.

Do not rewrite large shared files unless required.

Especially coordinate before changing:

- root app layout
- routing
- shared types
- database schema
- API response contracts
- global styles
- environment configuration

If you must change a shared contract:
1. document the change
2. preserve backwards compatibility when possible
3. update dependent code if obvious
4. note affected areas in `AGENT_PROGRESS.md`

---

# 20. Integration-first mindset

Every feature should be demoable end-to-end.

Prefer:

```text
working backend endpoint
+
working frontend state
+
real demo interaction
```

over:

```text
large isolated subsystem
```

At any moment, the repository should move toward a working demo.

---

# 21. Source of truth hierarchy

When instructions conflict, use this priority:

1. Current explicit human instruction
2. `AGENT.md`
3. Latest documented decisions in `AGENT_PROGRESS.md`
4. Existing repository behavior
5. Agent assumptions

Never silently override a human decision.

---

# 22. Final product principle

When making product or engineering decisions, ask:

> **Does this help demonstrate that raw bank transactions are not the same thing as real financial events?**

If yes, it is probably useful.

If no, it is probably not important for this 5-hour hackathon.

The goal is not to build a complete finance app.

The goal is to build the strongest possible demonstration of:

```text
automatic input
+
correct event reconstruction
+
trustworthy analytics
+
almost zero user effort
```
