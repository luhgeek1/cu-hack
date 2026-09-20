from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, JSON, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from .table_base import Base


class FinanceAccount(Base):
    __tablename__ = "finance_accounts"
    __table_args__ = (UniqueConstraint("user_id", "bank", "external_id", name="uq_finance_account_source"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    external_id: Mapped[str] = mapped_column(String(128))
    bank: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(120))
    account_type: Mapped[str] = mapped_column(String(20))
    currency: Mapped[str] = mapped_column(String(3), default="RUB")
    opening_balance_minor: Mapped[int] = mapped_column(BigInteger, default=0)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class FinanceTransaction(Base):
    __tablename__ = "finance_transactions"
    __table_args__ = (
        UniqueConstraint("account_id", "external_id", name="uq_finance_transaction_source"),
        CheckConstraint("amount_minor <> 0", name="ck_finance_transaction_nonzero"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[UUID] = mapped_column(ForeignKey("finance_accounts.id", ondelete="CASCADE"), index=True)
    external_id: Mapped[str] = mapped_column(String(128))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    payload: Mapped[dict] = mapped_column(JSON)
    resolution: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class FinanceEvent(Base):
    __tablename__ = "finance_events"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[str] = mapped_column(String(30), index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    payload: Mapped[dict] = mapped_column(JSON)


class FinanceEventLink(Base):
    __tablename__ = "finance_event_links"

    # A source transaction belongs to exactly one event; provenance edges aren't monetary links.
    transaction_id: Mapped[UUID] = mapped_column(ForeignKey("finance_transactions.id", ondelete="CASCADE"), primary_key=True)
    event_id: Mapped[UUID] = mapped_column(ForeignKey("finance_events.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(40))
    expense_minor: Mapped[int] = mapped_column(BigInteger)
    income_minor: Mapped[int] = mapped_column(BigInteger)
