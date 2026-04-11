"""add secretary_complaints table

Revision ID: 11042026_secretary_complaints
Revises: 09042026_negotiation
Create Date: 2026-04-11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "11042026_secretary_complaints"
down_revision = "09042026_negotiation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "secretary_complaints",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("society_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("societies.id"), nullable=False),
        sa.Column("filed_by", PG_UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="OPEN"),
        sa.Column("admin_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
        sa.Column("resolved_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_secretary_complaints_society_id", "secretary_complaints", ["society_id"])
    op.create_index("ix_secretary_complaints_filed_by", "secretary_complaints", ["filed_by"])


def downgrade() -> None:
    op.drop_index("ix_secretary_complaints_filed_by", table_name="secretary_complaints")
    op.drop_index("ix_secretary_complaints_society_id", table_name="secretary_complaints")
    op.drop_table("secretary_complaints")
