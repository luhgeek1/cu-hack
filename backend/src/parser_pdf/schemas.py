from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date, datetime
from typing import Any


@dataclass(frozen=True)
class Word:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str


@dataclass(frozen=True)
class ExtractedPage:
    number: int
    width: float
    height: float
    words: tuple[Word, ...]


@dataclass(frozen=True)
class StatementInfo:
    reference_number: str | None = None
    holder_name: str | None = None
    holder_address: str | None = None
    agreement_date: date | None = None
    agreement_number: str | None = None
    account_number: str | None = None
    balance_date: date | None = None
    available_balance_minor: int | None = None
    period_start: date | None = None
    period_end: date | None = None
    currency: str = "RUB"


@dataclass(frozen=True)
class StatementTransaction:
    external_id: str
    operation_at: datetime
    posted_at: datetime
    operation_amount_minor: int
    card_amount_minor: int
    description: str
    card_last4: str | None
    source_page: int

    def to_import_dict(self, account_id: str) -> dict[str, Any]:
        return {
            "external_id": self.external_id,
            "account_id": account_id,
            "amount_minor": self.card_amount_minor,
            "occurred_at": self.operation_at.isoformat(),
            "currency": "RUB",
            "description": self.description,
            "source": "tbank_statement",
        }


@dataclass(frozen=True)
class Statement:
    info: StatementInfo
    transactions: tuple[StatementTransaction, ...]
    page_count: int

    def to_dict(self) -> dict[str, Any]:
        return _json_ready(asdict(self))

    def to_import_dict(self, account_id: str) -> dict[str, Any]:
        return {
            "transactions": [transaction.to_import_dict(account_id) for transaction in self.transactions],
        }


def _json_ready(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_ready(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_ready(item) for item in value]
    return value
