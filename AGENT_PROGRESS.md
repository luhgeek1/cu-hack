# AGENT_PROGRESS.md

This file is the shared coordination log for all coding agents working on the project.

**Do not delete previous entries. Append or update your own task only.**

Before starting work:
1. Read `AGENT.md`.
2. Read this file.
3. Inspect current repository state.
4. Check whether another agent is already editing the same area.

---

# Current project status

Hackathon project: **«Честный месяц»**

Current core concept:

> Banks show transactions. We reconstruct what actually happened with the user's money.

Main priorities:
- mock bank connection
- transaction sync/import
- financial-event reconstruction
- correct handling of required edge cases
- analytics
- Needs Attention
- Money Graph
- live recalculation

---

# Shared decisions

## Product

- Do not require manual entry of every transaction.
- Product should feel like automatic bank synchronization.
- Hackathon implementation may use mock/sandbox bank providers.
- Normal day target: 0 user actions.
- Ambiguous case target: 1 user tap.

## Backend

- Financial arithmetic must be deterministic.
- Gemini must not be the source of truth for totals.
- Raw transactions and higher-level FinancialEvents are separate concepts.
- Analytics should be calculated from FinancialEvents.

## AI

- Gemini may interpret payment descriptions / merchant semantics.
- Prefer structured JSON responses.
- No custom model training.

## Frontend

- Mobile-first preferred.
- Exact visual design is intentionally not fixed.
- Demo clarity is more important than number of screens.

---

# Active tasks

No tasks registered yet.

Agents: when you start work, append an `[IN PROGRESS]` section below.

---

# Entry template

## [IN PROGRESS] Task name

Agent:
Started:

Goal:
- 

Files expected to change:
- 

Dependencies:
- 

Notes:
- 

---

When finished, replace/add:

## [DONE] Task name

Agent:
Completed:

Implemented:
- 

Files changed:
- 

API/contracts added or changed:
- 

How to test:
- 

Remaining issues:
- 

Next recommended task:
- 

---

If blocked:

## [BLOCKED] Task name

Agent:

Reason:
- 

Need:
- 

Safe workaround:
- 
