from datetime import date

from pydantic import Field

from .schemas import Contract, ImportResult, Money, TransactionInput


class StatementPreview(Contract):
    format: str = "tbank_movement_statement"
    account_fingerprint: str
    account_last4: str
    start_date: date
    end_date: date
    available_balance_minor: Money | None = None
    available_balance_date: date | None = None
    reported_inflow_minor: Money
    reported_outflow_minor: Money
    computed_inflow_minor: Money
    computed_outflow_minor: Money
    totals_match: bool
    transactions: list[TransactionInput]
    warnings: list[str] = Field(default_factory=list)


class StatementResult(Contract):
    import_result: ImportResult
    statement: StatementPreview
