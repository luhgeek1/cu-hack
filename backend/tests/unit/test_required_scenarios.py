from datetime import date
from uuid import uuid4

import pytest

from service.finance.providers import demo_dataset
from service.finance.engine import reconstruct
from service.finance.analytics import analytics


def test_all_seven_required_scenarios():
    accounts, txs = demo_dataset(uuid4(), date(2026, 9, 1))
    events = reconstruct(accounts, txs)
    by_key = {t.external_id.split(":")[-1]: next(e for e in events if any(c.transaction_id == t.id for c in e.contributions)) for t in txs}
    assert by_key['own-out'].id == by_key['own-in'].id
    assert by_key['own-out'].expense_impact_minor == by_key['own-out'].income_impact_minor == 0
    assert by_key['market-out'].expense_impact_minor == 0
    assert sum(by_key[k].expense_impact_minor for k in ['market-food', 'market-tech', 'market-home']) == 400000
    for day, remaining in [(4, 300000), (11, 150000), (18, 0)]:
        partial = reconstruct(accounts, [t for t in txs if t.occurred_at.day <= day and t.occurred_at.month == 9])
        assert next(e for e in partial if e.type == 'debt_given').remaining_minor == remaining
    assert by_key['dinner'].expense_impact_minor == 160000
    assert by_key['dinner'].income_impact_minor == 0
    assert by_key['unknown-lunch'].status == 'needs_attention'
    assert by_key['unknown-lunch'].income_impact_minor == 0
    assert by_key['refund'].related_event_id == by_key['purchase'].id
    assert by_key['refund'].expense_impact_minor == -420000
    assert by_key['refund'].income_impact_minor == 0
    assert by_key['cash'].expense_impact_minor == 0
    assert by_key['cash'].cash_wallet_delta_minor == 500000


@pytest.mark.parametrize('year,month,last', [(2026, 9, 30), (2026, 1, 31), (2024, 2, 29), (2026, 2, 28)])
def test_month_reconciliation_has_four_complete_nonoverlapping_segments(year, month, last):
    accounts, txs = demo_dataset(uuid4(), date(year, month, 1))
    report = analytics(reconstruct(accounts, txs), date(year, month, 1), date(year, month, last), period='month')
    proof = report.reconciliation
    assert [(p.start_date.day, p.end_date.day) for p in proof.parts] == [(1, 7), (8, 14), (15, 21), (22, last)]
    assert proof.expense_sum_minor == report.summary.real_expense_minor == 1559800
    assert proof.income_sum_minor == report.summary.real_income_minor == 9500000
    assert proof.matches
