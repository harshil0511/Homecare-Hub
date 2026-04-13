"""add home_members table

Revision ID: 13042026_home_members
Revises: 12042026_final_offer
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "13042026_home_members"
down_revision = "12042026_final_offer"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "home_members",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("society_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("societies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("family_members", sa.Integer, nullable=False),
        sa.Column("house_no", sa.String(100), nullable=False),
        sa.Column("mobile", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_home_members_society_id", "home_members", ["society_id"])


def downgrade() -> None:
    op.drop_index("ix_home_members_society_id", table_name="home_members")
    op.drop_table("home_members")
