"""add targeted_provider_ids to emergency_requests

Revision ID: 29042026_emg_targeted
Revises: 29042026_emergency_flow_type
Create Date: 2026-04-29

"""
from alembic import op
import sqlalchemy as sa

revision = "29042026_emg_targeted"
down_revision = "29042026_emergency_flow_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "emergency_requests",
        sa.Column("targeted_provider_ids", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("emergency_requests", "targeted_provider_ids")
