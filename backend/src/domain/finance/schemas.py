from datetime import date, datetime
from typing import Annotated, Generic, Literal, TypeVar
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

Money = Annotated[int, Field(strict=True, ge=-10**14, le=10**14)]
FinanceDate = Annotated[date, Field(ge=date(1970, 1, 1), le=date(2100, 12, 31))]
EventType = Literal["expense", "income", "own_transfer", "marketplace_transfer", "debt_given",
                    "debt_repayment", "shared_expense", "refund", "cash_withdrawal", "unknown"]
EventStatus = Literal["auto", "needs_attention", "confirmed"]
Category = Literal["groceries", "restaurants", "transport", "electronics", "household",
                   "subscriptions", "health", "shopping", "cash", "other"]
ResolutionAction = Literal["expense", "income", "own_transfer", "debt_given", "debt_repayment",
                           "shared_expense_repayment", "refund", "later"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


class AccountCreate(Contract):
    external_id: str = Field(min_length=1, max_length=128)
    bank: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=120)
    account_type: Literal["card", "marketplace", "cash"] = "card"
    currency: Literal["RUB"] = "RUB"
    opening_balance_minor: Money = 0


class AccountData(AccountCreate):
    id: UUID


class AccountView(AccountData):
    balance_minor: Money
    last_synced_at: datetime | None = None


class Resolution(Contract):
    action: ResolutionAction
    related_event_id: UUID | None = None
    category: Category | None = None

    @model_validator(mode="after")
    def validate_target(self):
        linked = self.action in {"own_transfer", "debt_repayment", "shared_expense_repayment", "refund"}
        if linked != (self.related_event_id is not None):
            raise ValueError("related_event_id is required only for linked resolutions")
        return self


class TransactionInput(Contract):
    external_id: str = Field(min_length=1, max_length=128)
    account_id: UUID
    amount_minor: Money
    occurred_at: AwareDatetime
    currency: Literal["RUB"] = "RUB"
    description: str = Field(default="", max_length=1000)
    merchant: str | None = Field(default=None, max_length=200)
    counterparty: str | None = Field(default=None, max_length=200)
    category: Category | None = None
    transfer_reference: str | None = Field(default=None, max_length=128)
    posted_at: AwareDatetime | None = None
    card_last4: str | None = Field(default=None, pattern=r"^\d{4}$")
    original_amount_minor: Money | None = None
    original_currency: str | None = Field(default=None, max_length=8)
    source: Literal["manual", "tbank_statement", "voice"] = "manual"

    @model_validator(mode="after")
    def nonzero(self):
        if self.amount_minor == 0:
            raise ValueError("Zero-value operations are not supported")
        return self


class TransactionData(TransactionInput):
    id: UUID
    resolution: Resolution | None = None


class Contribution(Contract):
    transaction_id: UUID
    occurred_at: AwareDatetime
    amount_minor: Money
    expense_minor: Money = 0
    income_minor: Money = 0
    role: str
    category: Category = "other"
    category_allocations: dict[Category, int] = Field(default_factory=dict)
    is_cash: bool = False


class FundingLink(Contract):
    event_id: UUID
    amount_minor: Money


class FinancialEvent(Contract):
    id: UUID
    type: EventType
    status: EventStatus = "auto"
    title: str
    occurred_at: AwareDatetime
    currency: Literal["RUB"] = "RUB"
    category: Category = "other"
    confidence: float = Field(ge=0, le=1)
    reason: str
    related_event_id: UUID | None = None
    remaining_minor: Money | None = None
    contributions: list[Contribution]
    funding_links: list[FundingLink] = Field(default_factory=list)
    expense_impact_minor: Money = 0
    income_impact_minor: Money = 0
    bank_outflow_minor: Money = 0
    bank_inflow_minor: Money = 0
    marketplace_orders: list[dict] = Field(default_factory=list)
    cash_wallet_delta_minor: Money = 0


class GraphNode(Contract):
    id: str
    kind: Literal["event", "transaction"]
    label: str
    amount_minor: Money


class GraphEdge(Contract):
    source: str
    target: str
    role: str
    amount_minor: Money | None = None


class EventDetail(Contract):
    event: FinancialEvent
    transactions: list[TransactionData]
    related_events: list[FinancialEvent]
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class Breakdown(Contract):
    type: str
    amount_minor: Money
    event_ids: list[UUID] = Field(default_factory=list)


class CategoryTotal(Contract):
    category: Category
    expense_minor: Money


class TimelinePoint(Contract):
    date: date
    expense_minor: Money = 0
    income_minor: Money = 0


class PeriodSummary(Contract):
    start_date: date
    end_date: date
    timezone: str = "Europe/Moscow"
    currency: Literal["RUB"] = "RUB"
    bank_outflow_minor: Money = 0
    bank_inflow_minor: Money = 0
    real_expense_minor: Money = 0
    real_income_minor: Money = 0
    net_income_minor: Money = 0
    excluded_minor: Money = 0
    unresolved_inflow_minor: Money = 0
    needs_attention_count: int = 0
    is_provisional: bool = False
    excluded_breakdown: list[Breakdown] = Field(default_factory=list)
    categories: list[CategoryTotal] = Field(default_factory=list)
    timeline: list[TimelinePoint] = Field(default_factory=list)


class Comparison(Contract):
    previous_start_date: date
    previous_end_date: date
    previous_expense_minor: Money
    previous_income_minor: Money
    expense_delta_minor: Money
    income_delta_minor: Money
    expense_change_percent: float | None


class Reconciliation(Contract):
    parts: list[PeriodSummary]
    expense_sum_minor: Money
    income_sum_minor: Money
    matches: bool


class PeriodReview(Contract):
    status: Literal["needs_attention", "complete"]
    needs_attention_count: int
    message: str


class Analytics(Contract):
    summary: PeriodSummary
    comparison: Comparison
    cash_policy: Literal["transfer_to_cash_wallet"] = "transfer_to_cash_wallet"
    reconciliation: Reconciliation
    review: PeriodReview
    accounting_policy: Literal["adjustments_on_receipt_date"] = "adjustments_on_receipt_date"
    last_synced_at: datetime | None = None


class ImportRequest(Contract):
    transactions: list[TransactionInput] = Field(min_length=1, max_length=2000)


class ImportResult(Contract):
    imported_count: int
    duplicate_count: int
    event_count: int
    needs_attention_count: int
    synced_at: datetime


class VoicePreview(Contract):
    transcript: str = Field(min_length=1, max_length=4000)
    transaction: TransactionInput
    candidate_transaction_ids: list[UUID] = Field(default_factory=list)
    requires_confirmation: bool = True


class DemoRequest(Contract):
    month: FinanceDate = Field(default_factory=lambda: date.today().replace(day=1))


class BankView(Contract):
    code: str
    name: str
    mode: Literal["demo"] = "demo"
    connected: bool
    last_synced_at: datetime | None = None


class ResolutionOption(Contract):
    action: ResolutionAction
    label: str
    related_event_id: UUID | None = None


class AttentionItem(Contract):
    event: FinancialEvent
    question: str = "Что это за операция?"
    options: list[ResolutionOption]


class ResolveResult(Contract):
    event: FinancialEvent
    needs_attention_count: int
    refresh: list[str] = Field(default_factory=lambda: ["events", "attention", "analytics", "digest"])


class VoiceConfirmation(Contract):
    transaction: TransactionInput
    matched_transaction_id: UUID | None = None

    @model_validator(mode="after")
    def validate_voice_source(self):
        if self.transaction.source != "voice":
            raise ValueError("Voice confirmation requires a voice transaction")
        return self


class VoiceConfirmationResult(Contract):
    matched_transaction_id: UUID | None = None
    import_result: ImportResult | None = None
    resolution: ResolveResult | None = None


class SpendingInsight(Contract):
    title: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=500)
    category: Category | None = None
    action: str = Field(min_length=1, max_length=300)


class SpendingAdvice(Contract):
    basis: PeriodSummary
    insights: list[SpendingInsight] = Field(min_length=1, max_length=5)
    disclaimer: str = "Советы основаны на подтвержденной финансовой динамике и не являются финансовой консультацией."


class Digest(Contract):
    date: date
    summary: PeriodSummary
    attention: list[AttentionItem]
    outstanding_debt_minor: Money
    message: str
    normal_day_actions: int = 0
    actions_per_ambiguous_operation: int = 1


class Dashboard(Analytics):
    total_balance_minor: Money
    accounts: list[AccountView]
    recent_events: list[FinancialEvent]
    attention_preview: list[AttentionItem]


T = TypeVar("T")


class Page(Contract, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
