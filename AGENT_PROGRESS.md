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

## [DONE] Honest Month backend

Agent: OpenCode
Started: 2026-09-20
Goal: Implement the PDF case end-to-end: imports, deterministic events, attention, analytics, demo.
Files expected to change: backend/src/{domain/finance,service/finance,api/v1/finance,database/relational_db/tables/finance.py,migrations}, backend/tests, docs.
Decisions:
- API prefix /api/v1, snake_case fields, integer kopecks, RUB-only MVP.
- Immutable normalized transactions; deterministic events rebuilt atomically on import/resolve. Manual decisions persist on source transactions.
- Event contributions are dated by each original transaction, including negative expense adjustments on refund/reimbursement dates. All periods aggregate the same contributions in Europe/Moscow by default.
- Cash withdrawals count as expenses immediately (explicit policy); no second accounting of cash purchases in this MVP.
- Unknown credits contribute zero income and are explicitly provisional; unknown outgoing person transfers remain provisional expenses until resolved.
- Mock bank imports and CSV/JSON import; no production banking dependencies.
- Existing untracked backend/uv.lock belongs to prior work.

Implemented:
- Immutable accounts/transactions, stored event projections and transaction links; migration c31f20260920.
- Deterministic transfer, marketplace FIFO provenance, debt/partial repayment, shared bill, refund, cash and attention handling.
- 70-operation demo source; per-bank sync; JSON/CSV imports with atomic deduplication/conflict checks.
- Period analytics/custom ranges, previous-period comparison, dashboard balance card, Money Graph, daily digest and one-click resolutions.
- Pulled DESIGN.MD from origin/main (7da40dd); dashboard supplies Total Balance and mobile card data.
- Backend contract is snake_case, documented in docs/BACKEND_API.md and typed OpenAPI.

Verification:
- 27 unit/API tests passed (including existing unit suite). Financial API uses real SQLite async persistence and overridden auth; production app route mounting/auth-required checks are covered.
- Ruff on new modules/tests passed; poetry check --lock passed; PostgreSQL migration compiled with alembic upgrade a629654c84b7:c31f20260920 --sql.
- Docker is unavailable and local PostgreSQL/Redis/MinIO ports are closed, so live PostgreSQL migrations and the existing external-service integration suite were not run here.

Next task: frontend integration against docs/BACKEND_API.md; deploy existing compose and run demo steps.

## [DONE] Mandatory seven scenarios and period reconciliation

Updated withdrawal policy: no expense on withdrawal; a separate cash wallet receives the balance, and actual cash purchases are expenses. Added monthly four-part server reconciliation (1–7, 8–14, 15–21, 22–end), period review status, period-scoped attention and persisted later action. All seven exact demo scenarios covered, including debt progression and unknown incoming payment. Existing persisted events need an idempotent reimport/demo reload to adopt the new accounting policy. Verification: 50 unit/API tests pass; scoped Ruff passes.

## [DONE] T-Bank statements and marketplace purchase imports
Agent: OpenCode, 2026-09-20
Scope: bank PDF/text parser, reported-total reconciliation, statement metadata; buyer order imports for ozon/wildberries/yandex_market and transaction enrichment without duplicate spending.
Files: finance schemas/services/routes/tests, new marketplace table/migration, dependency lock and API docs.
Decisions: supplied private statement is not a repository fixture; synthetic fixtures only. Preserve operation and posting dates and card-currency amount. Internal contract transfers are ambiguous without ownership evidence. Generic Y.M/YandexBank descriptors do not establish Yandex Market purchases. Public seller APIs do not imply buyer-history access; report import support honestly, not simulated live connection.
Implemented: PDF/text preview/import with strict footer reconciliation, ordinal duplicate preservation, merchant aliases; marketplace buyer-order JSON import, candidate links, owner-scoped persistent linkage, item category enrichment without added expenses. Migration d42f20260920, pypdf dependency.
Verification: 43 unit/API tests pass, including statement-to-order-to-analytics and reimport. Original binary PDF unavailable; parser tested using synthetic representations of supplied text/layout. Live marketplace sync is not available (seller APIs are not consumer purchase-history APIs).

## [DONE] PDF statement parser

Agent: Codex
Started: 2026-09-20
Completed: 2026-09-20

Implemented:
- Coordinate-aware parser for multi-page Russian bank statement PDFs with multiline descriptions.
- Full statement JSON and normalized `/api/v1/imports` JSON with stable transaction IDs and integer kopecks.
- Metadata extraction, Moscow timezone handling, CLI, OCR/text-layer error, and parser documentation.
- Focused tests for multiple pages, line wrapping, comma/dot amounts, stable IDs, JSON serialization, and image-only input.

Files changed:
- `backend/src/parser_pdf/`
- `backend/tests/unit/test_parser_pdf.py`
- `backend/pyproject.toml`

Dependencies:
- PyMuPDF for coordinate-aware PDF text extraction.

API/contracts added or changed:
- `parse_pdf(bytes) -> Statement` and `Statement.to_import_dict(account_id)`.
- No HTTP route changed; generated import JSON is accepted by the existing `POST /api/v1/imports` route.

How to test:
- `PYTHONPATH=src python -m pytest tests/unit/test_parser_pdf.py -q`
- Local isolated execution passed all 3 parser scenarios; Python compilation and TOML parsing passed.

Remaining issues:
- The local environment lacks the existing backend dependencies (`boto3`) and package tools, so the full pytest suite could not start.
- PyPI access failed with SSL EOF while trying to install Poetry; `poetry.lock` therefore still needs `poetry lock` in an environment with package access.
- Text-layer PDFs are supported; scanned image-only PDFs require OCR before parsing.

Follow-up fix:
- Added a fixed UTC+03:00 fallback for `Europe/Moscow` when Windows Python has no IANA `tzdata` package.
- Calibrated the six column boundaries against the supplied real T-Bank PDF and corrected reference-number extraction.
- Real-file verification: 6 pages parsed, 115 transactions written to `backend/statement.json`.
- Full statement JSON uses the backend money contract: integer kopecks such as `amount_minor=-12220`.

## [DONE] Voice matching and spending insights

Agent: OpenCode, 2026-09-20

Implemented:
- `POST /api/v1/voice/preview` transcribes audio through an injected DSLab-compatible gateway, validates the JSON draft, and returns exact-amount, same-account expense candidates in a +/-3 day window without persistence.
- `POST /api/v1/voice/confirm` revalidates a selected candidate before categorizing it or imports an explicitly confirmed new `source=voice` operation. It does not duplicate a matched bank expense.
- `GET /api/v1/insights` sends only deterministic aggregate summary/comparison/category/timeline facts to the gateway and validates up to five text recommendations. AI never changes monetary data.
- Added `openai`, locked dependencies, Windows-safe parser timezone fallback, and redacted parser fixture values.
- Verified the supplied local T-Bank PDF: 65 pages, 1661 transactions, computed inflow 51765527 and outflow 51508099 kopecks match statement footer totals.

Verification:
- `pytest tests/unit/test_parser_pdf.py tests/unit/test_voice.py tests/unit/test_finance_api.py::test_voice_preview_matches_expense_and_confirmation_does_not_import_duplicate tests/unit/test_finance_api.py::test_insights_use_server_calculated_spending_dynamics -q` -> 10 passed.
- Scoped Ruff and `poetry check --lock` passed.

Remaining external configuration:
- Replace the exposed DSLab key, set it only as `DSLAB_API_KEY`, and confirm that `DSLAB_VOICE_MODEL` supports OpenAI Responses `input_audio`. No request with the exposed key was made.
