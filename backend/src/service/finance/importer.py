import csv
import io

from pydantic import ValidationError

from core.errors import UnprocessableEntityError
from domain.finance.schemas import TransactionInput


def parse_csv(content: bytes, account_id):
    """Explicit portable statement format, not a claim to parse every bank's export."""
    try:
        text = content.decode("utf-8-sig")
        first = text.splitlines()[0] if text else ""
        reader = csv.DictReader(io.StringIO(text), delimiter=";" if ";" in first else ",")
        required = {"external_id", "amount_minor", "occurred_at"}
        allowed = required | {"description", "merchant", "counterparty", "category", "transfer_reference", "currency"}
        if not reader.fieldnames or not required <= set(reader.fieldnames) or not set(reader.fieldnames) <= allowed:
            raise ValueError("CSV requires external_id,amount_minor,occurred_at; unsupported columns are rejected")
        if len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise ValueError("Duplicate CSV columns")
        transactions = []
        for number, row in enumerate(reader, 2):
            if len(transactions) >= 2000:
                raise ValueError("At most 2000 operations per import")
            if None in row or any(v is None for v in row.values()):
                raise ValueError(f"Malformed CSV row {number}")
            payload = {key: value.strip() for key, value in row.items() if value.strip()}
            try:
                payload["amount_minor"] = int(payload["amount_minor"])
                transactions.append(TransactionInput(account_id=account_id, **payload))
            except (ValueError, KeyError, ValidationError) as exc:
                raise ValueError(f"Invalid CSV row {number}: {exc}") from exc
        if not transactions:
            raise ValueError("CSV must contain at least one operation")
        return transactions
    except (UnicodeDecodeError, ValueError, csv.Error) as exc:
        raise UnprocessableEntityError(str(exc)) from exc
