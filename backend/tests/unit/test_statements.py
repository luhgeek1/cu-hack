from uuid import uuid4

import pytest

from core.errors import UnprocessableEntityError
from service.finance.statements import parse_tbank_text, parse_tbank_pdf


# Synthetic data using the supplied document layout, no real customer identifiers.
HEADER = """АКЦИОНЕРНОЕ ОБЩЕСТВО «ТБАНК»
Справка о движении средств
Номер лицевого счета: 40817000000000000001
Сумма доступного остатка на 20.09.2026: 3 379.00 ₽
Движение средств за период с 01.09.2026 по 20.09.2026
Дата и время
операции
Дата
списания
Сумма в валюте
операции
Сумма операции
в валюте карты
Описание
операции
Номер
карты
"""
ROW = """19.09.2026
22:05
20.09.2026
03:29
-2.00 ₽ -2.00 ₽ Внутренний перевод на
договор 1000000001
1111
19.09.2026
22:05
20.09.2026
03:17
-108.00 ₽ -108.00 ₽ Оплата в PYATEROCHKA
22500 MOSCOW RUS
1111
19.09.2026
20:17
19.09.2026
20:17
+3 859.00 ₽ +3 859.00 ₽ Перевод себе 1111
"""
FOOTER = """АО «ТБанк» универсальная лицензия Банка России № 2673
БИК 000000000 ИНН 0000000000 КПП 000000000
1
Пополнения: 3 859,00 ₽
Расходы: 110,00 ₽
"""


def test_statement_multiline_metadata_dates_amounts_reconcile():
    parsed = parse_tbank_text(HEADER + ROW + FOOTER, uuid4())
    assert len(parsed.transactions) == 3
    assert parsed.totals_match
    assert parsed.computed_outflow_minor == 11000
    assert parsed.reported_inflow_minor == 385900
    assert parsed.available_balance_minor == 337900
    t = parsed.transactions[1]
    assert t.amount_minor == -10800
    assert t.occurred_at.day == 19 and t.posted_at.day == 20
    assert t.card_last4 == "1111"
    assert "PYATEROCHKA 22500" in t.merchant
    assert parsed.transactions[0].counterparty == "contract:1000000001"
    assert "40817000000000000001" not in parsed.model_dump_json()


def test_duplicate_rows_preserved_but_reimport_ids_stable_and_overlap_stable():
    account = uuid4()
    row = "19.09.2026 12:00 19.09.2026 12:15 -50.00 ₽ -50.00 ₽ Оплата в Metro 1111\n"
    text = HEADER + row * 2 + "Пополнения: 0,00 ₽\nРасходы: 100,00 ₽"
    a = parse_tbank_text(text, account)
    b = parse_tbank_text(text.replace("01.09.2026", "10.09.2026"), account)
    assert len({t.external_id for t in a.transactions}) == 2
    assert [t.external_id for t in a.transactions] == [t.external_id for t in b.transactions]


def test_mismatch_blocks_import_and_missing_totals_reported():
    with pytest.raises(UnprocessableEntityError, match="totals"):
        parse_tbank_text(HEADER + ROW + FOOTER.replace("110,00", "111,00"), uuid4())
    with pytest.raises(UnprocessableEntityError, match="totals"):
        parse_tbank_text(HEADER + ROW, uuid4())


def test_no_silent_skip_of_bad_row():
    with pytest.raises(UnprocessableEntityError):
        parse_tbank_text(HEADER + ROW.replace("-108.00 ₽", "INVALID ₽") + FOOTER, uuid4())


def test_cashback_dash_card_and_foreign_currency_card_amount():
    text = HEADER + "19.09.2026 12:00 19.09.2026 12:15 -2.00 USD -180.25 ₽ Оплата в SHOP 1111\n"
    text += "19.09.2026 10:00 19.09.2026 10:00 +20.00 ₽ +20.00 ₽ Кэшбэк за обычные покупки —\n"
    text += "Пополнения: 20,00 ₽\nРасходы: 180,25 ₽"
    parsed = parse_tbank_text(text, uuid4())
    assert parsed.transactions[0].amount_minor == -18025
    assert parsed.transactions[0].original_currency == "USD"
    assert parsed.transactions[1].card_last4 is None


def test_invalid_pdf_is_validation_error():
    with pytest.raises(UnprocessableEntityError):
        parse_tbank_pdf(b"not a PDF", uuid4())


def test_layout_extraction_dates_and_times_in_separate_rows():
    text = HEADER + "19.09.2026  20.09.2026  -108.00 ₽  -108.00 ₽  Оплата в PYATEROCHKA  1111\n"
    text += "22:05       03:17                              MOSCOW RUS\n"
    text += "Пополнения: 0,00 ₽\nРасходы: 108,00 ₽"
    parsed = parse_tbank_text(text, uuid4())
    assert parsed.transactions[0].merchant == "PYATEROCHKA MOSCOW RUS"
    assert parsed.transactions[0].posted_at.hour == 3
