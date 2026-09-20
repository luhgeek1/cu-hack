from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone as fixed_timezone, tzinfo
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .schemas import ExtractedPage, Statement, StatementInfo, StatementTransaction, Word

DATE_PATTERN = r"\d{2}\.\d{2}\.\d{4}"
TIME_PATTERN = r"\d{2}:\d{2}(?::\d{2})?"
DATE_RE = re.compile(rf"^{DATE_PATTERN}$")
SIGNED_MONEY_RE = re.compile(r"^[+\-−–—]?\s*\d[\d\s\u00a0]*(?:[.,]\d{1,2})?\s*(?:₽|Р|P|RUB)?$", re.IGNORECASE)


class PdfParseError(ValueError):
    """The PDF is readable, but does not match the supported statement layout."""


@dataclass
class _Line:
    y: float
    words: list[Word]


@dataclass
class _RawRow:
    page: int
    columns: list[list[Word]]


def parse_pdf(content: bytes, *, timezone: str = "Europe/Moscow") -> Statement:
    """Parse a text-layer PDF statement. The caller remains responsible for file-size limits."""
    if not content.startswith(b"%PDF-"):
        raise PdfParseError("Файл не похож на PDF")
    try:
        import pymupdf
    except ImportError as exc:  # pragma: no cover - depends on deployment packaging
        raise RuntimeError("Для разбора PDF установите зависимость pymupdf") from exc

    try:
        with pymupdf.open(stream=content, filetype="pdf") as document:
            if document.page_count == 0:
                raise PdfParseError("PDF не содержит страниц")
            pages = []
            for page_number, page in enumerate(document, 1):
                raw_words = page.get_text("words", sort=True)
                words = tuple(Word(*item[:5]) for item in raw_words if str(item[4]).strip())
                pages.append(ExtractedPage(page_number, page.rect.width, page.rect.height, words))
    except PdfParseError:
        raise
    except Exception as exc:
        raise PdfParseError("Не удалось прочитать PDF") from exc

    return parse_statement_pages(pages, timezone=timezone)


def parse_statement_pages(pages: list[ExtractedPage], *, timezone: str = "Europe/Moscow") -> Statement:
    """Parse already extracted words; useful for tests and alternate PDF extractors."""
    if not pages:
        raise PdfParseError("PDF не содержит страниц")
    if not any(page.words for page in pages):
        raise PdfParseError("В PDF нет текстового слоя. Сначала выполните OCR")
    tz = _resolve_timezone(timezone)

    info = _parse_info(_document_text(pages))
    raw_rows = _extract_rows(pages)
    if not raw_rows:
        raise PdfParseError("Не найдена таблица операций поддерживаемого формата")

    transactions: list[StatementTransaction] = []
    occurrences: dict[str, int] = {}
    for row in raw_rows:
        columns = [_column_text(column) for column in row.columns]
        try:
            operation_at = _parse_datetime(columns[0], tz)
            posted_at = _parse_datetime(columns[1], tz)
            operation_amount = _parse_money(columns[2])
            card_amount = _parse_money(columns[3])
        except ValueError as exc:
            raise PdfParseError(f"Страница {row.page}: повреждена строка операции: {columns}") from exc
        description = _clean_text(columns[4])
        card_match = re.search(r"\d{4}", columns[5])
        card_last4 = card_match.group(0) if card_match else None
        fingerprint = "|".join([
            info.account_number or "",
            operation_at.isoformat(),
            posted_at.isoformat(),
            str(card_amount),
            description,
            card_last4 or "",
        ])
        occurrence = occurrences.get(fingerprint, 0)
        occurrences[fingerprint] = occurrence + 1
        digest = hashlib.sha256(f"{fingerprint}|{occurrence}".encode()).hexdigest()[:24]
        transactions.append(StatementTransaction(
            external_id=f"pdf-{digest}",
            operation_at=operation_at,
            posted_at=posted_at,
            operation_amount_minor=operation_amount,
            card_amount_minor=card_amount,
            description=description,
            card_last4=card_last4,
            source_page=row.page,
        ))
    return Statement(info=info, transactions=tuple(transactions), page_count=len(pages))


def _extract_rows(pages: list[ExtractedPage]) -> list[_RawRow]:
    rows: list[_RawRow] = []
    active: _RawRow | None = None
    for page in pages:
        lines = _group_lines(page.words)
        started_on_page = False
        last_row_y: float | None = None
        for line in lines:
            columns = _split_columns(line.words, page.width)
            is_start = _is_transaction_start(columns)
            if is_start:
                if active is not None:
                    rows.append(active)
                active = _RawRow(page=page.number, columns=columns)
                started_on_page = True
                last_row_y = line.y
                continue
            close_to_row = last_row_y is not None and line.y - last_row_y <= max(18, page.height * 0.025)
            if active is not None and started_on_page and close_to_row and not _is_footer_or_header(line):
                for index, words in enumerate(columns):
                    active.columns[index].extend(words)
                last_row_y = line.y
    if active is not None:
        rows.append(active)
    return rows


def _group_lines(words: tuple[Word, ...], tolerance: float = 3.0) -> list[_Line]:
    lines: list[_Line] = []
    for word in sorted(words, key=lambda item: ((item.y0 + item.y1) / 2, item.x0)):
        center = (word.y0 + word.y1) / 2
        line = next((candidate for candidate in reversed(lines[-3:]) if abs(candidate.y - center) <= tolerance), None)
        if line is None:
            lines.append(_Line(center, [word]))
        else:
            line.words.append(word)
            line.y = sum((item.y0 + item.y1) / 2 for item in line.words) / len(line.words)
    for line in lines:
        line.words.sort(key=lambda item: item.x0)
    return lines


def _split_columns(words: list[Word], page_width: float) -> list[list[Word]]:
    # Midpoints between the six column anchors in the supplied T-Bank form.
    # Relative values keep the parser independent of PDF page scaling.
    boundaries = (0.19, 0.31, 0.445, 0.605, 0.80)
    columns: list[list[Word]] = [[] for _ in range(6)]
    for word in words:
        position = ((word.x0 + word.x1) / 2) / page_width
        index = next((i for i, boundary in enumerate(boundaries) if position < boundary), 5)
        columns[index].append(word)
    return columns


def _is_transaction_start(columns: list[list[Word]]) -> bool:
    first = _column_text(columns[0]).split()
    second = _column_text(columns[1]).split()
    amounts = (_column_text(columns[2]), _column_text(columns[3]))
    return (
        any(DATE_RE.fullmatch(token) for token in first)
        and any(DATE_RE.fullmatch(token) for token in second)
        and all(SIGNED_MONEY_RE.fullmatch(value.strip()) for value in amounts)
    )


def _is_footer_or_header(line: _Line) -> bool:
    text = _clean_text(" ".join(word.text for word in line.words)).lower()
    return (
        "дата и время" in text
        or "сумма операции" in text
        or "описание операции" in text
        or re.fullmatch(r"(?:страница|page)\s+\d+(?:\s+из\s+\d+)?", text) is not None
    )


def _column_text(words: list[Word]) -> str:
    ordered = sorted(words, key=lambda item: (((item.y0 + item.y1) / 2), item.x0))
    return " ".join(word.text.strip() for word in ordered if word.text.strip())


def _resolve_timezone(name: str) -> tzinfo:
    try:
        return ZoneInfo(name)
    except (ValueError, ZoneInfoNotFoundError, ModuleNotFoundError) as exc:
        if name == "Europe/Moscow":
            return fixed_timezone(timedelta(hours=3), name)
        raise PdfParseError(f"Неизвестная временная зона: {name}") from exc


def _parse_datetime(value: str, tz: tzinfo) -> datetime:
    date_match = re.search(DATE_PATTERN, value)
    time_match = re.search(TIME_PATTERN, value)
    if not date_match or not time_match:
        raise ValueError("missing date or time")
    parsed_date = datetime.strptime(date_match.group(), "%d.%m.%Y").date()
    parsed_time = datetime.strptime(time_match.group(), "%H:%M:%S" if time_match.group().count(":") == 2 else "%H:%M").time()
    return datetime.combine(parsed_date, parsed_time, tzinfo=tz)


def _parse_money(value: str) -> int:
    normalized = value.upper().replace("\u00a0", "").replace(" ", "").replace("₽", "").replace("Р", "")
    normalized = normalized.replace("RUB", "").replace("P", "").replace("−", "-").replace("–", "-").replace("—", "-").replace(",", ".")
    if not re.fullmatch(r"[+-]?\d+(?:\.\d{1,2})?", normalized, re.IGNORECASE):
        raise ValueError("invalid money")
    try:
        return int((Decimal(normalized) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    except InvalidOperation as exc:
        raise ValueError("invalid money") from exc


def _parse_info(text: str) -> StatementInfo:
    def find(pattern: str) -> str | None:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        return _clean_text(match.group(1)) if match else None

    agreement_date = _parse_date_optional(find(r"Дата заключения договора:\s*(\d{2}\.\d{2}\.\d{4})"))
    balance_match = re.search(rf"Сумма доступного остатка на\s*({DATE_PATTERN}):\s*([+\-−–—]?\s*[\d\s\u00a0]+[.,]\d{{1,2}})", text, re.IGNORECASE)
    period_match = re.search(rf"Движение средств за период с\s*({DATE_PATTERN})\s*по\s*({DATE_PATTERN})", text, re.IGNORECASE)
    holder_match = re.search(r"(?:Исх\.\s*№[^\n]*\n)([^\n:]+)\n(?:Адрес места жительства:)", text, re.IGNORECASE)
    return StatementInfo(
        reference_number=find(r"Исх\.\s*№\s*(\S+)"),
        holder_name=_clean_text(holder_match.group(1)) if holder_match else None,
        holder_address=find(r"Адрес места жительства:\s*([^\n]+)"),
        agreement_date=agreement_date,
        agreement_number=find(r"Номер договора:\s*([^\n]+)"),
        account_number=find(r"Номер лицевого счета:\s*([^\n]+)"),
        balance_date=_parse_date_optional(balance_match.group(1) if balance_match else None),
        available_balance_minor=_parse_money(balance_match.group(2)) if balance_match else None,
        period_start=_parse_date_optional(period_match.group(1) if period_match else None),
        period_end=_parse_date_optional(period_match.group(2) if period_match else None),
    )


def _parse_date_optional(value: str | None) -> date | None:
    return datetime.strptime(value, "%d.%m.%Y").date() if value else None


def _document_text(pages: list[ExtractedPage]) -> str:
    page_texts = []
    for page in pages:
        lines = _group_lines(page.words)
        page_texts.append("\n".join(" ".join(word.text for word in line.words) for line in lines))
    return "\n".join(page_texts)


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()
