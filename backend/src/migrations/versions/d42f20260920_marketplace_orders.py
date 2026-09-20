"""Buyer order enrichment without additional monetary transactions."""
from alembic import op
import sqlalchemy as sa

revision = "d42f20260920"
down_revision = "c31f20260920"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("marketplace_orders",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("marketplace", sa.String(30), nullable=False),
        sa.Column("external_id", sa.String(128), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("transaction_id", sa.Uuid(), sa.ForeignKey("finance_transactions.id", ondelete="SET NULL"), unique=True),
        sa.UniqueConstraint("user_id", "marketplace", "external_id", name="uq_marketplace_order_source"))
    op.create_index("ix_marketplace_orders_user_id", "marketplace_orders", ["user_id"])


def downgrade():
    op.drop_table("marketplace_orders")
