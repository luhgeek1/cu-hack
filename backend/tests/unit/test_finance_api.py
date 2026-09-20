"""HTTP tests using real async SQLAlchemy persistence, isolated from external services."""
from types import SimpleNamespace
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.v1.finance.router import router, get_finance_service, current_finance_user
from core.config import get_settings
from core.error_handling import register_exception_handlers
from database.relational_db.tables.finance import FinanceAccount, FinanceTransaction, FinanceEvent, FinanceEventLink
from database.relational_db.tables.users.users_table import User
from service.finance.service import FinanceService


@pytest_asyncio.fixture
async def finance_api():
    engine = create_async_engine("sqlite+aiosqlite://")
    tables = [User.__table__, FinanceAccount.__table__, FinanceTransaction.__table__, FinanceEvent.__table__, FinanceEventLink.__table__]
    async with engine.begin() as conn:
        for table in tables:
            # User's PostgreSQL trigram indices are unnecessary in this isolated test database.
            from sqlalchemy.schema import CreateTable
            await conn.execute(CreateTable(table))
    factory = async_sessionmaker(engine, expire_on_commit=False)
    user_id = uuid4()
    async with factory() as session:
        session.add(User(id=user_id, email=f"{user_id}@example.com", password_hash="test"))
        await session.commit()
    identity = SimpleNamespace(id=user_id)
    app = FastAPI()
    register_exception_handlers(app, get_settings())
    app.include_router(router, prefix="/api/v1")

    async def service():
        async with factory() as session:
            async with session.begin():
                yield FinanceService(session, identity.id)

    app.dependency_overrides[get_finance_service] = service
    app.dependency_overrides[current_finance_user] = lambda: identity
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, identity, factory
    await engine.dispose()


@pytest.mark.asyncio
async def test_complete_demo_resolve_resync_persistence_and_isolation(finance_api):
    client, identity, factory = finance_api
    loaded = await client.post("/api/v1/demo/load", json={"month": "2026-09-01"})
    assert loaded.status_code == 200, loaded.text
    assert loaded.json()["imported_count"] >= 50
    before = (await client.get("/api/v1/dashboard?period=month&date=2026-09-01")).json()
    assert before["summary"]["needs_attention_count"] == 1
    assert len(before["accounts"]) == 4
    assert before["total_balance_minor"] == sum(a["balance_minor"] for a in before["accounts"])
    attention = (await client.get("/api/v1/attention")).json()
    event_id = attention["items"][0]["event"]["id"]
    resolved = await client.post(f"/api/v1/events/{event_id}/resolve", json={"action": "income"})
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["needs_attention_count"] == 0
    after = (await client.get("/api/v1/analytics?period=month&date=2026-09-01")).json()
    assert after["summary"]["real_income_minor"] - before["summary"]["real_income_minor"] == 50000
    again = await client.post("/api/v1/demo/load", json={"month": "2026-09-01"})
    assert again.json()["imported_count"] == 0
    assert again.json()["needs_attention_count"] == 0
    assert (await client.get(f"/api/v1/events/{event_id}")).json()["event"]["status"] == "confirmed"
    digest = await client.get("/api/v1/digest?date=2026-09-20")
    assert digest.status_code == 200
    assert digest.json()["outstanding_debt_minor"] == 0
    identity.id = uuid4()
    async with factory() as session:
        session.add(User(id=identity.id, email=f"{identity.id}@example.com", password_hash="test"))
        await session.commit()
    assert (await client.get(f"/api/v1/events/{event_id}")).status_code == 404
    assert (await client.post(f"/api/v1/events/{event_id}/resolve", json={"action": "income"})).status_code == 404
    assert (await client.get("/api/v1/transactions")).json()["total"] == 0


@pytest.mark.asyncio
async def test_import_csv_idempotency_conflict_and_atomic_validation(finance_api):
    client, _, _ = finance_api
    account = await client.post("/api/v1/accounts", json={"external_id": "my-card", "bank": "tbank", "name": "Карта"})
    assert account.status_code == 201, account.text
    account_id = account.json()["id"]
    csv = "external_id,amount_minor,occurred_at,description,merchant\na1,-12345,2026-09-01T12:00:00Z,Покупка,Продукты\n"
    response = await client.post(f"/api/v1/imports/csv?account_id={account_id}", files={"file": ("statement.csv", csv.encode(), "text/csv")})
    assert response.status_code == 200, response.text
    assert response.json()["imported_count"] == 1
    response = await client.post(f"/api/v1/imports/csv?account_id={account_id}", files={"file": ("statement.csv", csv.encode(), "text/csv")})
    assert response.json()["duplicate_count"] == 1
    payload = {"external_id": "a1", "account_id": account_id, "amount_minor": -99999, "occurred_at": "2026-09-01T12:00:00Z", "merchant": "Продукты"}
    response = await client.post("/api/v1/imports", json={"transactions": [payload]})
    assert response.status_code == 409, response.text
    payload["external_id"] = "new"
    bad = {**payload, "external_id": "bad", "account_id": str(uuid4())}
    response = await client.post("/api/v1/imports", json={"transactions": [payload, bad]})
    assert response.status_code == 404, response.text
    assert (await client.get("/api/v1/transactions")).json()["total"] == 1
    response = await client.get("/api/v1/analytics?start_date=2026-09-03&end_date=2026-09-01")
    assert response.status_code == 422
    assert (await client.get("/api/v1/analytics?timezone=not-a-timezone")).status_code == 422


@pytest.mark.asyncio
async def test_bank_sync_sequentially_reconstructs_cross_bank_transfer(finance_api):
    client, _, _ = finance_api
    first = await client.post("/api/v1/banks/tbank/connect-and-sync", json={"month": "2026-09-01"})
    assert first.status_code == 200, first.text
    second = await client.post("/api/v1/banks/sber/sync", json={"month": "2026-09-01"})
    assert second.status_code == 200, second.text
    events = (await client.get("/api/v1/events?type=own_transfer")).json()
    assert events["total"] == 1
    detail = (await client.get(f"/api/v1/events/{events['items'][0]['id']}")).json()
    assert len(detail["transactions"]) == 2
    assert len(detail["edges"]) >= 2


@pytest.mark.asyncio
async def test_invalid_resolution_does_not_mutate_and_openapi_is_typed(finance_api):
    client, _, _ = finance_api
    await client.post("/api/v1/demo/load", json={"month": "2026-09-01"})
    attention = (await client.get("/api/v1/attention")).json()["items"][0]
    event_id = attention["event"]["id"]
    bad = await client.post(f"/api/v1/events/{event_id}/resolve", json={"action": "expense"})
    assert bad.status_code == 422, bad.text
    bad = await client.post(f"/api/v1/events/{event_id}/resolve", json={"action": "refund", "related_event_id": str(uuid4())})
    assert bad.status_code == 422
    assert (await client.get("/api/v1/attention")).json()["total"] == 1
    schema = (await client.get("/openapi.json")).json()
    assert "Dashboard" in schema["components"]["schemas"]
    assert "FinancialEvent" in schema["components"]["schemas"]


@pytest.mark.asyncio
async def test_attention_options_are_valid_and_group_resolution_recalculates(finance_api):
    client, _, _ = finance_api
    await client.post("/api/v1/demo/load", json={"month": "2026-09-01"})
    item = (await client.get("/api/v1/attention")).json()["items"][0]
    option = next(o for o in item["options"] if o["action"] == "shared_expense_repayment")
    before = (await client.get("/api/v1/analytics?date=2026-09-01")).json()["summary"]
    response = await client.post(f"/api/v1/events/{item['event']['id']}/resolve", json={k: v for k, v in option.items() if k != "label"})
    assert response.status_code == 200, response.text
    assert response.json()["event"]["id"] == option["related_event_id"]
    after = (await client.get("/api/v1/analytics?date=2026-09-01")).json()["summary"]
    assert after["real_expense_minor"] == before["real_expense_minor"] - 50000
    assert after["real_income_minor"] == before["real_income_minor"]
    assert after["needs_attention_count"] == 0
    repeat = await client.post("/api/v1/demo/load", json={"month": "2026-09-01"})
    assert repeat.json()["needs_attention_count"] == 0


@pytest.mark.asyncio
async def test_dates_validation_and_pagination(finance_api):
    client, _, _ = finance_api
    for query in ("date=0001-01-01", "date=9999-12-31", "start_date=2026-01-01"):
        assert (await client.get(f"/api/v1/analytics?{query}")).status_code == 422
    assert (await client.post("/api/v1/demo/load", json={"month": "0001-01-01"})).status_code == 422
    assert (await client.get("/api/v1/events?limit=0")).status_code == 422
    await client.post("/api/v1/demo/load", json={"month": "2026-09-01"})
    one = (await client.get("/api/v1/events?limit=2")).json()
    two = (await client.get("/api/v1/events?limit=2&offset=2")).json()
    assert len(one["items"]) == len(two["items"]) == 2
    assert {e["id"] for e in one["items"]}.isdisjoint(e["id"] for e in two["items"])
