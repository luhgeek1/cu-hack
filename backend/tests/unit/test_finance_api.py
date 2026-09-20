"""HTTP tests using real async SQLAlchemy persistence, isolated from external services."""
from types import SimpleNamespace
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.v1.finance.router import router, get_finance_service, current_finance_user, get_insight_service, get_statement_ai_service, get_voice_service
from core.config import get_settings
from core.error_handling import register_exception_handlers
from database.relational_db.tables.finance import FinanceAccount, FinanceTransaction, FinanceEvent, FinanceEventLink, MarketplaceOrder
from database.relational_db.tables.users.users_table import User
from service.finance.service import FinanceService
from service.finance.insights import SpendingInsightService
from service.finance.statement_ai import StatementAiService
from service.finance.voice import VoiceService


@pytest_asyncio.fixture
async def finance_api():
    engine = create_async_engine("sqlite+aiosqlite://")
    tables = [User.__table__, FinanceAccount.__table__, FinanceTransaction.__table__, FinanceEvent.__table__, FinanceEventLink.__table__, MarketplaceOrder.__table__]
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
    assert len(before["accounts"]) == 5
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


@pytest.mark.asyncio
async def test_statement_import_and_marketplace_link_do_not_duplicate_money(finance_api):
    from tests.unit.test_statements import HEADER
    client, _, _ = finance_api
    account = (await client.post("/api/v1/accounts", json={"external_id": "statement", "bank": "tbank", "name": "Statement"})).json()
    text = HEADER + "19.09.2026 12:00 19.09.2026 12:15 -300.00 ₽ -300.00 ₽ Оплата в OZON 1111\nПополнения: 0,00 ₽\nРасходы: 300,00 ₽"
    response = await client.post(f"/api/v1/imports/tbank?account_id={account['id']}", files={"file": ("statement.txt", text.encode(), "text/plain")})
    assert response.status_code == 200, response.text
    assert response.json()["import_result"]["imported_count"] == 1
    order = {"external_id": "order1", "purchased_at": "2026-09-19T12:00:00+03:00", "paid_minor": 30000,
             "items": [{"name": "Milk", "quantity": 1, "total_minor": 10000, "category": "groceries"},
                       {"name": "Cable", "quantity": 1, "total_minor": 20000, "category": "electronics"}]}
    response = await client.post("/api/v1/integrations/ozon/orders", json={"orders": [order]})
    assert response.status_code == 200, response.text
    view = response.json()["orders"][0]
    assert len(view["candidate_transaction_ids"]) == 1
    linked = await client.post(f"/api/v1/marketplace-orders/{view['id']}/link", json={"transaction_id": view["candidate_transaction_ids"][0]})
    assert linked.status_code == 200, linked.text
    report = (await client.get("/api/v1/analytics?date=2026-09-01")).json()["summary"]
    assert report["real_expense_minor"] == 30000
    assert {c["category"]: c["expense_minor"] for c in report["categories"]} == {"groceries": 10000, "electronics": 20000}
    repeat = await client.post(f"/api/v1/imports/tbank?account_id={account['id']}", files={"file": ("statement.txt", text.encode(), "text/plain")})
    assert repeat.json()["import_result"]["duplicate_count"] == 1
    assert (await client.get("/api/v1/transactions")).json()["total"] == 1
    assert all(not i["live_sync_available"] for i in (await client.get("/api/v1/integrations")).json())


@pytest.mark.asyncio
async def test_cash_wallet_and_deferred_attention(finance_api):
    client, _, _ = finance_api
    await client.post('/api/v1/demo/load', json={'month': '2026-09-01'})
    before = (await client.get('/api/v1/dashboard?period=month&date=2026-09-01')).json()
    wallet = next(a for a in before['accounts'] if a['account_type'] == 'cash')
    assert wallet['balance_minor'] == 500000
    pending = (await client.get('/api/v1/attention')).json()['items'][0]
    response = await client.post(f"/api/v1/events/{pending['event']['id']}/resolve", json={'action': 'later'})
    assert response.status_code == 200, response.text
    assert response.json()['needs_attention_count'] == 1
    await client.post('/api/v1/demo/load', json={'month': '2026-09-01'})
    assert (await client.get('/api/v1/attention')).json()['total'] == 1
    response = await client.post('/api/v1/imports', json={'transactions': [{
        'external_id': 'cash-food', 'account_id': wallet['id'], 'amount_minor': -10000,
        'occurred_at': '2026-09-21T12:00:00+03:00', 'merchant': 'Продукты'}]})
    assert response.status_code == 200, response.text
    after = (await client.get('/api/v1/dashboard?period=month&date=2026-09-01')).json()
    assert next(a for a in after['accounts'] if a['id'] == wallet['id'])['balance_minor'] == 490000
    assert after['summary']['real_expense_minor'] == before['summary']['real_expense_minor'] + 10000
    assert after['summary']['bank_outflow_minor'] == before['summary']['bank_outflow_minor']
    assert after['total_balance_minor'] == before['total_balance_minor'] - 10000


@pytest.mark.asyncio
async def test_voice_preview_matches_expense_and_confirmation_does_not_import_duplicate(finance_api):
    client, _, _ = finance_api
    account = (await client.post("/api/v1/accounts", json={"external_id": "voice-card", "bank": "tbank", "name": "Voice card"})).json()
    imported = await client.post("/api/v1/imports", json={"transactions": [{
        "external_id": "bank-expense", "account_id": account["id"], "amount_minor": -45000,
        "occurred_at": "2026-09-19T18:30:00+03:00", "merchant": "Пятерочка",
    }]})
    assert imported.status_code == 200, imported.text
    existing_id = (await client.get("/api/v1/transactions")).json()["items"][0]["id"]

    class Gateway:
        def transcribe(self, content, filename, content_type):
            assert content == b"audio"
            return "Вчера купил продукты в Пятерочке за 450 рублей"

        def extract_transaction(self, transcript, now):
            return {"amount_minor": -45000, "occurred_at": "2026-09-19T18:30:00+03:00",
                    "merchant": "Пятерочка", "description": "Покупка продуктов", "category": "groceries"}

    client._transport.app.dependency_overrides[get_voice_service] = lambda: VoiceService(Gateway())
    preview = await client.post(f"/api/v1/voice/preview?account_id={account['id']}", files={
        "file": ("operation.ogg", b"audio", "audio/ogg"),
    })
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["candidate_transaction_ids"] == [existing_id]
    assert body["transaction"]["source"] == "voice"
    assert (await client.get("/api/v1/transactions")).json()["total"] == 1

    confirmation = await client.post("/api/v1/voice/confirm", json={
        "transaction": body["transaction"], "matched_transaction_id": existing_id,
    })
    assert confirmation.status_code == 200, confirmation.text
    assert confirmation.json()["matched_transaction_id"] == existing_id
    assert (await client.get("/api/v1/transactions")).json()["total"] == 1


@pytest.mark.asyncio
async def test_insights_use_server_calculated_spending_dynamics(finance_api):
    client, _, _ = finance_api
    loaded = await client.post("/api/v1/demo/load", json={"month": "2026-09-01"})
    assert loaded.status_code == 200, loaded.text

    class Gateway:
        def advise(self, facts):
            assert facts["summary"]["real_expense_minor"] > 0
            assert facts["timeline"]
            assert facts["comparison"]["expense_delta_minor"] != 0
            return {"insights": [{
                "title": "Кафе", "message": "Расходы на рестораны выросли относительно прошлого периода.",
                "category": "restaurants", "action": "Установите недельный лимит на кафе.",
            }]}

    client._transport.app.dependency_overrides[get_insight_service] = lambda: SpendingInsightService(Gateway())
    response = await client.get("/api/v1/insights?period=month&date=2026-09-01")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["basis"]["real_expense_minor"] > 0
    assert body["insights"][0]["category"] == "restaurants"


@pytest.mark.asyncio
async def test_statement_ai_preview_returns_suggestions_without_importing_transactions(finance_api):
    from tests.unit.test_statements import FOOTER, HEADER, ROW

    client, _, _ = finance_api
    account = (await client.post("/api/v1/accounts", json={"external_id": "statement-ai", "bank": "tbank", "name": "Statement AI"})).json()

    class Gateway:
        def classify(self, transactions):
            return [{"external_id": transactions[1]["external_id"], "kind": "expense", "category": "groceries",
                     "confidence": 0.92, "reason": "Grocery merchant", "related_external_id": None}]

    client._transport.app.dependency_overrides[get_statement_ai_service] = lambda: StatementAiService(Gateway())
    response = await client.post(f"/api/v1/imports/tbank/ai-preview?account_id={account['id']}", files={
        "file": ("statement.txt", (HEADER + ROW + FOOTER).encode(), "text/plain"),
    })
    assert response.status_code == 200, response.text
    assert response.json()["suggestions"][0]["category"] == "groceries"
    assert (await client.get("/api/v1/transactions")).json()["total"] == 0


@pytest.mark.asyncio
async def test_period_review_queue_and_completion(finance_api):
    client, _, _ = finance_api
    await client.post('/api/v1/demo/load', json={'month': '2026-09-01'})
    await client.post('/api/v1/demo/load', json={'month': '2026-10-01'})
    query = '?start_date=2026-09-01&end_date=2026-09-30'
    queue = (await client.get('/api/v1/attention' + query)).json()
    assert queue['total'] == 1
    report = (await client.get('/api/v1/analytics?period=month&date=2026-09-01')).json()
    assert report['review']['status'] == 'needs_attention'
    event_id = queue['items'][0]['event']['id']
    await client.post(f'/api/v1/events/{event_id}/resolve', json={'action': 'income'})
    report = (await client.get('/api/v1/analytics?period=month&date=2026-09-01')).json()
    assert report['review']['status'] == 'complete'
    assert report['review']['message'] == 'Все операции за период разобраны.'
    assert report['summary']['real_income_minor'] == 9550000
    assert report['reconciliation']['matches']
    assert (await client.get('/api/v1/attention' + query)).json()['total'] == 0
    assert (await client.get('/api/v1/attention')).json()['total'] == 1
