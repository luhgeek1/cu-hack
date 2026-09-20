from datetime import date

import pytest

from parser_pdf import ExtractedPage, PdfParseError, Word, parse_statement_pages
from parser_pdf.parser import _resolve_timezone


def _line(y, *items):
    return tuple(Word(x, y, x + max(len(text) * 4, 12), y + 8, text) for x, text in items)


def _page(number, lines):
    return ExtractedPage(number=number, width=700, height=900, words=tuple(word for line in lines for word in line))


def test_parses_multiline_rows_across_multiple_pages_and_builds_import_json():
    first = _page(1, [
        _line(20, (55, "Исх."), (82, "№"), (95, "a7144630")),
        _line(35, (55, "Зайцев"), (105, "Константин"), (175, "Андреевич")),
        _line(50, (55, "Адрес места жительства:"), (190, "Москва")),
        _line(70, (55, "Дата заключения договора:"), (220, "13.09.2023")),
        _line(85, (55, "Номер договора:"), (165, "5260454676")),
        _line(100, (55, "Номер лицевого счета:"), (190, "40817810400095910010")),
        _line(115, (55, "Сумма доступного остатка на"), (235, "20.09.2026:"), (310, "4 381.08"), (370, "₽")),
        _line(130, (55, "Движение средств за период с"), (250, "20.08.2026"), (330, "по"), (350, "20.09.2026")),
        _line(200, (55, "20.09.2026"), (145, "20.09.2026"), (238, "-122.20 ₽"), (360, "-122.20 ₽"), (480, "Оплата в FUNPAY"), (620, "5377")),
        _line(212, (55, "12:15"), (145, "12:16")),
        _line(230, (55, "19.09.2026"), (145, "20.09.2026"), (238, "+2.00 ₽"), (360, "+2.00 ₽"), (480, "Перевод с договора"), (620, "5377")),
        _line(242, (55, "23:49"), (145, "04:02"), (480, "5718630956")),
    ])
    second = _page(2, [
        _line(40, (55, "Дата и время операции"), (480, "Описание операции")),
        _line(80, (55, "18.09.2026"), (145, "18.09.2026"), (238, "-63,96 ₽"), (360, "-63,96 ₽"), (480, "Оплата в WHOOSH 100"), (620, "5377")),
        _line(92, (55, "22:58"), (145, "03:36"), (480, "MOSKVA RUS")),
        _line(850, (55, "Страница 2 из 2")),
    ])

    statement = parse_statement_pages([first, second])

    assert statement.page_count == 2
    assert statement.info.account_number == "40817810400095910010"
    assert statement.info.period_start == date(2026, 8, 20)
    assert statement.info.available_balance_minor == 438108
    assert [item.card_amount_minor for item in statement.transactions] == [-12220, 200, -6396]
    assert statement.transactions[1].description == "Перевод с договора 5718630956"
    assert statement.transactions[2].description == "Оплата в WHOOSH 100 MOSKVA RUS"
    assert statement.transactions[0].operation_at.isoformat() == "2026-09-20T12:15:00+03:00"
    payload = statement.to_import_dict("account-uuid")
    assert payload["transactions"][0]["account_id"] == "account-uuid"
    assert payload["transactions"][0]["amount_minor"] == -12220
    assert payload["transactions"][0]["external_id"].startswith("pdf-")
    assert statement.to_dict()["info"]["period_start"] == "2026-08-20"
    assert statement.to_dict()["transactions"][0]["operation_at"] == "2026-09-20T12:15:00+03:00"


def test_repeated_parse_produces_stable_external_ids():
    page = _page(1, [
        _line(100, (55, "20.09.2026"), (145, "20.09.2026"), (238, "-44.06 ₽"), (360, "-44.06 ₽"), (480, "Оплата"), (620, "5377")),
        _line(112, (55, "11:33"), (145, "11:34"), (480, "в FUNPAY")),
    ])
    first = parse_statement_pages([page])
    second = parse_statement_pages([page])
    assert first.transactions[0].external_id == second.transactions[0].external_id


def test_rejects_image_only_pdf_extraction():
    page = ExtractedPage(number=1, width=700, height=900, words=())
    with pytest.raises(PdfParseError, match="OCR"):
        parse_statement_pages([page])


def test_moscow_timezone_has_windows_safe_fallback(monkeypatch):
    def unavailable(_name):
        raise ModuleNotFoundError("tzdata")

    monkeypatch.setattr("parser_pdf.parser.ZoneInfo", unavailable)
    assert _resolve_timezone("Europe/Moscow").utcoffset(None).total_seconds() == 3 * 60 * 60
