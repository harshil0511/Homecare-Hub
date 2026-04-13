"""add society_contracts and society_dispatches tables

Revision ID: 13042026_society_contracts
Revises: 13042026_home_members
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "13042026_society_contracts"
down_revision = "13042026_home_members"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "society_contracts",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("society_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("societies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("service_providers.id"), nullable=False),
        sa.Column("proposed_by", PG_UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("duration_months", sa.Integer, nullable=False),
        sa.Column("counter_duration_months", sa.Integer, nullable=True),
        sa.Column("monthly_rate", sa.Float, nullable=False),
        sa.Column("start_date", sa.DateTime, nullable=True),
        sa.Column("end_date", sa.DateTime, nullable=True),
        sa.Column("status", sa.String(50), server_default="PENDING", nullable=False),
        sa.Column("secretary_notes", sa.Text, nullable=True),
        sa.Column("servicer_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_society_contracts_society_id", "society_contracts", ["society_id"])
    op.create_index("ix_society_contracts_provider_id", "society_contracts", ["provider_id"])
    op.create_index("ix_society_contracts_status", "society_contracts", ["status"])

    op.create_table(
        "society_dispatches",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("contract_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("society_contracts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("society_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("societies.id"), nullable=False),
        sa.Column("provider_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("service_providers.id"), nullable=False),
        sa.Column("member_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("service_type", sa.String(200), nullable=False),
        sa.Column("scheduled_at", sa.DateTime, nullable=False),
        sa.Column("job_price", sa.Float, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("status", sa.String(50), server_default="ASSIGNED", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_society_dispatches_contract_id", "society_dispatches", ["contract_id"])
    op.create_index("ix_society_dispatches_provider_id", "society_dispatches", ["provider_id"])
    op.create_index("ix_society_dispatches_member_id", "society_dispatches", ["member_id"])
    op.create_index("ix_society_dispatches_status", "society_dispatches", ["status"])


def downgrade() -> None:
    op.drop_index("ix_society_dispatches_status", table_name="society_dispatches")
    op.drop_index("ix_society_dispatches_member_id", table_name="society_dispatches")
    op.drop_index("ix_society_dispatches_provider_id", table_name="society_dispatches")
    op.drop_index("ix_society_dispatches_contract_id", table_name="society_dispatches")
    op.drop_table("society_dispatches")
    op.drop_index("ix_society_contracts_status", table_name="society_contracts")
    op.drop_index("ix_society_contracts_provider_id", table_name="society_contracts")
    op.drop_index("ix_society_contracts_society_id", table_name="society_contracts")
    op.drop_table("society_contracts")
