"""add provider_points table

Revision ID: 07042026_provider_points
Revises: z9y8x7w6v5u4
Create Date: 2026-04-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "07042026_provider_points"
down_revision = "z9y8x7w6v5u4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "provider_points",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("provider_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("service_providers.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("delta", sa.Float, nullable=False),
        sa.Column("event_type", sa.String, nullable=False),
        sa.Column("source_id", PG_UUID(as_uuid=True), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime,
                  server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_provider_points_provider_id", "provider_points", ["provider_id"])


def downgrade() -> None:
    op.drop_index("ix_provider_points_provider_id", table_name="provider_points")
    op.drop_table("provider_points")
