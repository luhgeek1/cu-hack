from datetime import date, datetime, timezone
from uuid import NAMESPACE_URL, uuid5

import pytest

from domain.finance.schemas import AccountData, TransactionData
from service.finance.engine import reconstruct
from service.finance.analytics import summarize
from service.finance.providers import demo_dataset


def uid(name):
    return uuid5(NAMESPACE_URL, name)


ACCOUNTS = [
    AccountData(id=uid("a"), external_id="a", bank="tbank", name="Main"),
    AccountData(id=uid("b"), external_id="b", bank="sber", name="Other"),
    AccountData(id=uid("o"), external_id="o", bank="ozon", name="Marketplace", account_type="marketplace"),
]


def tx(key, amount, day=1, account="a", description="", merchant=None, counterparty=None, **kw):
    return TransactionData(id=uid(key), external_id=key, account_id=uid(account),
                           amount_minor=amount, occurred_at=datetime(2026, 9, day, 12, tzinfo=timezone.utc),
                           description=description, merchant=merchant, counterparty=counterparty, **kw)


def total(events, start=date(2026, 9, 1), end=date(2026, 9, 30)):
    return summarize(events, start, end)


def test_own_transfer_requires_evidence_and_pairs_once():
    events = reconstruct(ACCOUNTS, [tx("out", -1000000, description="Перевод между своими счетами"),
                                  tx("in", 1000000, account="b", description="Перевод между своими счетами")])
    assert len(events) == 1
    assert events[0].type == "own_transfer"
    assert total(events).real_expense_minor == total(events).real_income_minor == 0
    unrelated = reconstruct(ACCOUNTS, [tx("x", -10000, merchant="Shop"), tx("y", 10000, account="b")])
    assert len(unrelated) == 2
    assert total(unrelated).real_expense_minor == 10000


def test_debt_partial_repayments_over_weeks_are_not_income():
    events = reconstruct(ACCOUNTS, [tx("loan", -300000, description="Дал в долг", counterparty="Антон"),
                                  tx("r1", 150000, 8, description="Возврат долга", counterparty="Антон"),
                                  tx("r2", 150000, 15, description="Возврат долга", counterparty="Антон")])
    assert total(events).real_expense_minor == total(events).real_income_minor == 0
    loan = next(e for e in events if e.type == "debt_given")
    assert loan.remaining_minor == 0
    assert sum(e.type == "debt_repayment" for e in events) == 2


def test_shared_dinner_costs_one_fifth_and_each_source_counts_once():
    transactions = [tx("dinner", -800000, merchant="Ресторан", description="Ужин")]
    transactions += [tx(f"friend{i}", 160000, 2, description="за ужин", counterparty=f"friend{i}") for i in range(4)]
    events = reconstruct(ACCOUNTS, transactions)
    assert len(events) == 1
    assert events[0].type == "shared_expense"
    assert total(events).real_expense_minor == 160000
    assert total(events).real_income_minor == 0
    assert len(events[0].contributions) == 5


def test_unknown_lunch_is_attention_not_income():
    events = reconstruct(ACCOUNTS, [tx("lunch", 50000, description="за обед")])
    assert events[0].status == "needs_attention"
    assert total(events).real_income_minor == 0
    assert total(events).unresolved_inflow_minor == 50000


def test_refund_reduces_spending_on_refund_date_not_income():
    purchase = tx("purchase", -420000, merchant="Shop")
    purchase.occurred_at = datetime(2026, 8, 31, 12, tzinfo=timezone.utc)
    events = reconstruct(ACCOUNTS, [purchase, tx("refund", 420000, description="Возврат товара", merchant="Shop")])
    assert total(events).real_expense_minor == -420000
    assert total(events).real_income_minor == 0
    assert total(events, date(2026, 8, 1), date(2026, 9, 30)).real_expense_minor == 0


def test_marketplace_topup_links_to_categorized_purchases():
    events = reconstruct(ACCOUNTS, [tx("topup-out", -600000, description="Перевод себе"),
                                  tx("topup-in", 600000, account="o", description="Перевод себе"),
                                  tx("groceries", -80000, 2, "o", merchant="Продукты"),
                                  tx("appliance", -230000, 3, "o", merchant="Бытовая техника")])
    assert total(events).real_expense_minor == 310000
    purchases = [e for e in events if e.type == "expense"]
    assert {e.category for e in purchases} == {"groceries", "electronics"}
    assert all(e.funding_links for e in purchases)
    assert sum(link.amount_minor for e in purchases for link in e.funding_links) == 310000


def test_cash_withdrawal_policy_is_expense_immediately():
    events = reconstruct(ACCOUNTS, [tx("cash", -500000, description="Снятие наличных в банкомате")])
    assert events[0].type == "cash_withdrawal"
    assert events[0].category == "cash"
    assert total(events).real_expense_minor == 500000


def test_demo_has_required_scenarios_and_periods_reconcile():
    accounts, transactions = demo_dataset(uid("owner"), date(2026, 9, 1))
    assert len(transactions) >= 50
    events = reconstruct(accounts, transactions)
    assert {"expense", "income", "own_transfer", "marketplace_transfer", "debt_given",
            "debt_repayment", "shared_expense", "unknown", "refund", "cash_withdrawal"} <= {e.type for e in events}
    month = total(events)
    slices = [total(events, date(2026, 9, a), date(2026, 9, b)) for a, b in [(1, 7), (8, 14), (15, 21), (22, 28), (29, 30)]]
    assert sum(s.real_expense_minor for s in slices) == month.real_expense_minor
    assert sum(s.real_income_minor for s in slices) == month.real_income_minor
    assert month.bank_outflow_minor - sum(x.amount_minor for x in month.excluded_breakdown) == month.real_expense_minor
    reverse = reconstruct(accounts, list(reversed(transactions)))
    assert [e.model_dump() for e in reverse] == [e.model_dump() for e in events]


def test_multiple_matching_dinners_are_not_guessed():
    events = reconstruct(ACCOUNTS, [tx("d1", -800000, merchant="Ресторан"),
                                  tx("d2", -700000, merchant="Ресторан"),
                                  tx("amb", 160000, 2, description="за ужин")])
    assert next(e for e in events if e.id == uid("amb")).status == "needs_attention"


def test_schema_rejects_float_money_and_naive_dates():
    with pytest.raises(ValueError):
        tx("bad", 1.1)
    with pytest.raises(ValueError):
        TransactionData(id=uid("bad"), external_id="bad", account_id=uid("a"), amount_minor=1,
                        occurred_at=datetime(2026, 9, 1))


def test_partial_refund_does_not_over_refund_purchase():
    events = reconstruct(ACCOUNTS, [tx("buy", -420000, merchant="Shop"),
                                  tx("r1", 200000, 2, merchant="Shop", description="Возврат"),
                                  tx("r2", 220000, 3, merchant="Shop", description="Возврат"),
                                  tx("r3", 10000, 4, merchant="Shop", description="Возврат")])
    assert total(events).real_expense_minor == 0
    assert next(e for e in events if e.id == uid("r3")).status == "needs_attention"


def test_transfer_ambiguous_candidates_are_not_greedily_paired():
    events = reconstruct(ACCOUNTS, [tx("o1", -10000, description="Перевод себе"),
                                  tx("o2", -10000, description="Перевод себе"),
                                  tx("i1", 10000, account="b", description="Перевод себе")])
    assert all(e.type != "own_transfer" for e in events)
    assert total(events).needs_attention_count == 3


def test_manual_shared_link_survives_new_matching_purchase():
    from domain.finance.schemas import Resolution
    dinner = tx("dinner", -800000, merchant="Ресторан")
    receipt = tx("receipt", 160000, 2, description="за ужин")
    receipt.resolution = Resolution(action="shared_expense_repayment", related_event_id=dinner.id)
    events = reconstruct(ACCOUNTS, [dinner, receipt, tx("other-dinner", -900000, merchant="Ресторан")])
    original = next(e for e in events if e.id == dinner.id)
    assert original.status == "confirmed"
    assert original.expense_impact_minor == 640000


def test_local_day_boundary_and_negative_adjustments_reconcile():
    purchase = tx("late", -800000, merchant="Ресторан")
    purchase.occurred_at = datetime(2026, 8, 31, 22, tzinfo=timezone.utc)
    receipt = tx("early", 160000, 2, description="за ужин")
    events = reconstruct(ACCOUNTS, [purchase, receipt])
    assert total(events).real_expense_minor == 640000
    assert total(events, date(2026, 9, 1), date(2026, 9, 1)).real_expense_minor == 800000
    assert total(events, date(2026, 9, 2), date(2026, 9, 2)).real_expense_minor == -160000


def test_demo_financial_totals_are_known_not_only_self_consistent():
    accounts, transactions = demo_dataset(uid("owner"), date(2026, 9, 1))
    summary = total(reconstruct(accounts, transactions))
    # 24 groceries: sum(25000 + day*713), 24 metro rides, 1600 own dinner,
    # marketplace 4000, cash 5000, subscription 299; refunded purchase nets to zero.
    assert summary.real_expense_minor == 2059800
    assert summary.real_income_minor == 9500000
    assert summary.needs_attention_count == 1
