"""T-Bank movement statement parser. Private headers never become transaction data."""
import hashlib
import io
import re
from collections import Counter
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from pydantic import ValidationError

from core.errors import UnprocessableEntityError
from domain.finance.schemas import TransactionInput
from domain.finance.statements import StatementPreview

DATE = r"\d{2}\.\d{2}\.\d{4}"
TIME = r"\d{2}:\d{2}"
AMOUNT = r"[+\-]?\d(?:[\d ]*\d)?[.,]\d{2}"
CURRENCY = r"(?:₽|RUB|USD|EUR|\$|€)"
MONEY_PAIR = re.compile(rf"(?P<original>{AMOUNT})\s*(?P<oc>{CURRENCY})\s+(?P<amount>{AMOUNT})\s*(?P<currency>{CURRENCY})\s*")
ROW_START = re.compile(rf"(?<!\d)(?P<date>{DATE})\s+(?:(?P<time>{TIME})\s+(?P<posted>{DATE})\s+(?P<pt>{TIME})|(?P<posted_layout>{DATE}))\s+")


def money(value):
    return int(Decimal(value.replace(" ", "").replace(",", ".")) * 100)


def bank_date(value):
    return datetime.strptime(value, "%d.%m.%Y").date()


def description_fields(description):
    merchant = None
    match = re.match(r"(?:Оплата в|Оплата услуг|Возврат покупки через СБП|Возврат покупки в)\s+(.+)", description, re.I)
    if match:
        merchant = match[1]
    if merchant and "пополнение кошелька" in merchant.casefold():
        merchant = None
    contract = re.search(r"договор(?:а)?\s+(\d+)", description, re.I)
    phone = re.search(r"\+7\d{10}", description)
    counterparty = f"contract:{contract[1]}" if contract else f"phone:{phone[0]}" if phone else None
    return merchant, counterparty


def _clean(text):
    text = text.replace("\u00a0", " ").replace("\u202f", " ").replace("−", "-").replace("\r", "")
    # Repeated headers/footers are removed before reconstructing wrapped descriptions.
    text = re.sub(r"АО [«\"]ТБанк[»\"] универсальная лицензия[^\n]*", "", text)
    text = re.sub(r"БИК[^\n]*ИНН[^\n]*", "", text)
    text = re.sub(r"(?m)^\s*\d{1,3}\s*$", "", text)
    text = re.sub(r"<PARSED TEXT FOR PAGE:[^>]*>|<IMAGE FOR PAGE:[^>]*>", "", text)
    text = re.sub(r"Дата и время\s+операции\s+Дата\s+списания\s+Сумма в валюте\s+операции\s+Сумма операции\s+в валюте карты\s+Описание\s+операции\s+Номер\s+карты", "", text)
    return text


def parse_tbank_text(text: str, account_id) -> StatementPreview:
    if len(text) > 8_000_000:
        raise UnprocessableEntityError("Statement text is too large")
    text = _clean(text)
    if "Справка о движении средств" not in text or "ТБАНК" not in text.upper():
        raise UnprocessableEntityError("Unsupported statement format: expected T-Bank movement statement")
    account = re.search(r"Номер лицевого счета:\s*(\d{20})", text)
    period = re.search(rf"Движение средств за период с\s+({DATE})\s+по\s+({DATE})", text)
    inflow = re.search(rf"Пополнения:\s*({AMOUNT})\s*₽", text)
    outflow = re.search(rf"Расходы:\s*({AMOUNT})\s*₽", text)
    balance = re.search(rf"Сумма доступного остатка на\s*({DATE}):\s*({AMOUNT})\s*₽", text)
    if not account or not period:
        raise UnprocessableEntityError("Statement account or period is missing")
    if not inflow or not outflow:
        raise UnprocessableEntityError("Statement totals missing: upload all pages including the last page")
    body = text[period.end():inflow.start()]
    starts = list(ROW_START.finditer(body))
    if not starts or len(starts) > 10000:
        raise UnprocessableEntityError("Statement must contain 1–10000 operations")
    counts = Counter()
    transactions = []
    fingerprint = hashlib.sha256(account[1].encode()).hexdigest()
    try:
        start_date, end_date = map(bank_date, period.groups())
        if start_date > end_date:
            raise ValueError("Invalid statement period")
        for i, start in enumerate(starts):
            segment = body[start.end():starts[i+1].start() if i+1 < len(starts) else len(body)].strip()
            amounts = MONEY_PAIR.match(segment)
            if not amounts:
                raise ValueError(f"Cannot parse monetary columns in row {i+1}")
            if amounts["currency"] not in {"₽", "RUB"}:
                raise ValueError("Only RUB card accounts are supported")
            tail = segment[amounts.end():]
            if start["time"]:
                when, posted, posted_time = start["time"], start["posted"], start["pt"]
            else:
                # pypdf layout: dates on first physical line, both times on second.
                times = re.search(rf"(?m)^\s*({TIME})\s+({TIME})\s*", tail)
                if not times:
                    raise ValueError(f"Cannot parse time columns in row {i+1}")
                when, posted, posted_time = times[1], start["posted_layout"], times[2]
                tail = tail[:times.start()] + " " + tail[times.end():]
            # Card may be at end of the first physical line or last line after description wrapping.
            card = re.search(r"(?m)(?:\s|^)(\d{4}|—)\s*$", tail)
            if not card:
                raise ValueError(f"Missing card column in row {i+1}")
            last4 = None if card[1] == "—" else card[1]
            description = " ".join((tail[:card.start()] + " " + tail[card.end():]).split())
            if not description or re.search(DATE, description):
                raise ValueError(f"Malformed description in row {i+1}")
            occurred_at = datetime.strptime(f"{start['date']} {when}", "%d.%m.%Y %H:%M").replace(tzinfo=ZoneInfo("Europe/Moscow"))
            posted_at = datetime.strptime(f"{posted} {posted_time}", "%d.%m.%Y %H:%M").replace(tzinfo=ZoneInfo("Europe/Moscow"))
            if not start_date <= occurred_at.date() <= end_date:
                raise ValueError(f"Operation outside statement period in row {i+1}")
            amount = money(amounts["amount"])
            original = money(amounts["original"])
            if (original > 0) != (amount > 0):
                raise ValueError(f"Amount signs disagree in row {i+1}")
            merchant, counterparty = description_fields(description)
            # Occurrence ordinal preserves identical legitimate transactions; page/range aren't in the ID.
            identity = f"{fingerprint}|{occurred_at.isoformat()}|{posted_at.isoformat()}|{amount}|{description}|{last4}"
            digest = hashlib.sha256(identity.encode()).hexdigest()
            counts[digest] += 1
            transactions.append(TransactionInput(
                external_id=f"tbank:{digest}:{counts[digest]}", account_id=account_id, amount_minor=amount,
                occurred_at=occurred_at, posted_at=posted_at, original_amount_minor=original,
                original_currency={"₽": "RUB", "$": "USD", "€": "EUR"}.get(amounts["oc"], amounts["oc"]),
                description=description, merchant=merchant, counterparty=counterparty, card_last4=last4, source="tbank_statement"))
        computed_in = sum(max(t.amount_minor, 0) for t in transactions)
        computed_out = sum(max(-t.amount_minor, 0) for t in transactions)
        if computed_in != money(inflow[1]) or computed_out != money(outflow[1]):
            raise ValueError("Statement totals mismatch: no operations imported; check document completeness and extraction")
        return StatementPreview(account_fingerprint=fingerprint, account_last4=account[1][-4:], start_date=start_date, end_date=end_date,
            reported_inflow_minor=money(inflow[1]), reported_outflow_minor=money(outflow[1]),
            computed_inflow_minor=computed_in, computed_outflow_minor=computed_out, totals_match=True,
            available_balance_minor=money(balance[2]) if balance else None,
            available_balance_date=bank_date(balance[1]) if balance else None, transactions=transactions,
            warnings=["Доступный остаток может включать блокировки; он не используется для вычисления начального баланса.",
                      "Внутренний перевод на договор не подтверждает принадлежность счёта пользователю."])
    except (ValueError, ValidationError) as exc:
        raise UnprocessableEntityError(str(exc)) from exc


def parse_tbank_pdf(content: bytes, account_id) -> StatementPreview:
    from pypdf import PdfReader
    if not content.startswith(b"%PDF-"):
        raise UnprocessableEntityError("Expected a PDF file")
    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            raise ValueError("Encrypted PDF is not supported; export an unlocked statement")
        if not 1 <= len(reader.pages) <= 200:
            raise ValueError("PDF must contain 1–200 pages")
        pages = []
        for page in reader.pages:
            stream = page.get_contents()
            if stream and len(stream.get_data()) > 10_000_000:
                raise ValueError("PDF page content is too large")
            pages.append(page.extract_text() or "")
        text = "\n".join(pages)
        if not text.strip():
            raise ValueError("PDF has no text layer; OCR is required for scanned statements")
    except Exception as exc:
        raise UnprocessableEntityError("Cannot read PDF: upload an unencrypted, text-based bank statement") from exc
    try:
        return parse_tbank_text(text, account_id)
    except UnprocessableEntityError:
        # Retry positional extraction; still require exact footer reconciliation.
        text = "\n".join(page.extract_text(extraction_mode="layout") or "" for page in reader.pages)
        return parse_tbank_text(text, account_id)
