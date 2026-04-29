"""add flow_type to emergency_requests

Revision ID: 29042026_emergency_flow_type
Revises: c9f4e2a83b56
Create Date: 2026-04-29

"""
from alembic import op
import sqlalchemy as sa

revision = "29042026_emergency_flow_type"
down_revision = "c9f4e2a83b56"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "emergency_requests",
        sa.Column("flow_type", sa.String(), nullable=False, server_default="systematic"),
    )


def downgrade() -> None:
    op.drop_column("emergency_requests", "flow_type")
