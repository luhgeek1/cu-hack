from datetime import datetime, timezone
from uuid import uuid4

import pytest

from domain.finance.marketplaces import OrderInput
from service.finance.marketplaces import detect_marketplace, enrich_events
from domain.finance.schemas import AccountData, TransactionData
from service.finance.engine import reconstruct


def test_provider_detection_does_not_confuse_yandex_services_or_payment_gateway():
    assert detect_marketplace("YANDEX*5399*MARKET Moscow RUS") == "yandex_market"
    assert detect_marketplace("Оплата в Озон") == "ozon"
    assert detect_marketplace("WILDBERRIES") == "wildberries"
    for text in ["YandexBank_C2A", "YANDEX*4121*GO", "YM*play2go", "Digital Market", "Пополнение кошелька"]:
        assert detect_marketplace(text) is None


def test_item_enrichment_preserves_money_and_splits_categories():
    account = AccountData(id=uuid4(), external_id="a", bank="tbank", name="Card")
    t = TransactionData(id=uuid4(), account_id=account.id, external_id="payment", amount_minor=-30000,
                        occurred_at=datetime(2026, 9, 1, tzinfo=timezone.utc), merchant="OZON")
    events = reconstruct([account], [t])
    order = dict(id=str(uuid4()), marketplace="ozon", transaction_id=str(t.id),
                 items=[dict(name="Milk", quantity=1, total_minor=10000, category="groceries"),
                        dict(name="Cable", quantity=1, total_minor=20000, category="electronics")])
    enrich_events(events, [order])
    assert events[0].expense_impact_minor == 30000
    assert events[0].bank_outflow_minor == 30000
    assert events[0].contributions[0].category_allocations == {"groceries": 10000, "electronics": 20000}


def test_order_totals_validation():
    with pytest.raises(ValueError):
        OrderInput(external_id="x", purchased_at=datetime.now(timezone.utc), paid_minor=20000,
                   items=[dict(name="x", quantity=1, total_minor=10000)])
