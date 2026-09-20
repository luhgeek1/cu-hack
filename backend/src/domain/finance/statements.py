from datetime import date

from pydantic import Field

from .schemas import Category, Contract, EventType, ImportResult, Money, TransactionInput


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


class StatementAiSuggestion(Contract):
    external_id: str
    kind: EventType
    category: Category | None = None
    confidence: float = Field(ge=0, le=1)
    reason: str = Field(min_length=1, max_length=500)
    related_external_id: str | None = None


class StatementAiPreview(Contract):
    statement: StatementPreview
    suggestions: list[StatementAiSuggestion] = Field(default_factory=list)
    requires_confirmation: bool = True
