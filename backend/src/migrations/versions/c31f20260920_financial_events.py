"""Honest Month immutable inputs and deterministic financial projections."""
from alembic import op
import sqlalchemy as sa

revision = "c31f20260920"
down_revision = "a629654c84b7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "finance_accounts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("external_id", sa.String(128), nullable=False),
        sa.Column("bank", sa.String(40), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("account_type", sa.String(20), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("opening_balance_minor", sa.BigInteger(), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("user_id", "bank", "external_id", name="uq_finance_account_source"),
    )
    op.create_table(
        "finance_transactions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_id", sa.Uuid(), sa.ForeignKey("finance_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("external_id", sa.String(128), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("resolution", sa.JSON()),
        sa.UniqueConstraint("account_id", "external_id", name="uq_finance_transaction_source"),
        sa.CheckConstraint("amount_minor <> 0", name="ck_finance_transaction_nonzero"),
    )
    op.create_table(
        "finance_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(40), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_table(
        "finance_event_links",
        sa.Column("transaction_id", sa.Uuid(), sa.ForeignKey("finance_transactions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("event_id", sa.Uuid(), sa.ForeignKey("finance_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(40), nullable=False),
        sa.Column("expense_minor", sa.BigInteger(), nullable=False),
        sa.Column("income_minor", sa.BigInteger(), nullable=False),
    )
    for table, columns in {
        "finance_accounts": ["user_id"],
        "finance_transactions": ["user_id", "account_id", "occurred_at"],
        "finance_events": ["user_id", "type", "status", "occurred_at"],
        "finance_event_links": ["event_id"],
    }.items():
        for column in columns:
            op.create_index(f"ix_{table}_{column}", table, [column])


def downgrade():
    for table in ("finance_event_links", "finance_events", "finance_transactions", "finance_accounts"):
        op.drop_table(table)
