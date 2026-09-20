# Honest Month Backend Implementation Plan

**Goal:** Deliver the supplied CU@Hack PDF case through a documented, persistent API.
**Architecture:** Existing FastAPI auth and async SQLAlchemy. A pure deterministic engine projects raw transactions into events with dated contributions. PostgreSQL stores inputs, manual decisions and projections in one transaction; user row locks serialize writes. Import sources are independent of the engine.
**Tech Stack:** Python, Pydantic, FastAPI, SQLAlchemy, Alembic, pytest.

## Execution (inline)
- [x] Add scenario tests in backend/tests/unit/test_money_engine.py: own transfers, marketplace purchases, partial debt, shared dinner, unknown lunch, refund, cash, cross-month arithmetic, deterministic ordering.
- [x] Implement domain/finance/schemas.py, service/finance/engine.py and analytics.py, providers.py (>=50 deterministic demo operations).
- [x] Add SQLAlchemy financial accounts, transactions, events and links; Alembic migration following a629654c84b7. Store manual resolution on raw transaction and stable event IDs on anchors.
- [x] Add service/finance/service.py: owner-scoped reads, locked atomic import/rebuild, external-ID dedup with conflict detection, validated resolution and persistence.
- [x] Add api/v1/finance/router.py: accounts, banks/sync, demo, JSON/CSV import, transaction/event feeds, details/graph, attention/resolve, period dashboard and digest.
- [x] Test HTTP contract with actual SQLite async persistence when PostgreSQL is unavailable, plus pure engine regression cases. Run existing unit suite and Ruff on added files.
- [x] Document API requests, response conventions, cash/date policies, runnable demo and limitations in docs/BACKEND_API.md; update coordination log.

## Acceptance
`python -m pytest tests/unit -q` and finance API tests pass. The dataset has at least 50 operations and every required scenario. Reimport yields zero additions. Resolving ambiguous income updates attention and income, survives resync, and affects only the authenticated owner. Daily/weekly/custom slices add up to month totals. OpenAPI exposes typed responses.
