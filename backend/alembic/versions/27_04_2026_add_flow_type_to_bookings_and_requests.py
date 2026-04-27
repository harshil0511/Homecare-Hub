"""add_flow_type_to_bookings_and_requests

Revision ID: b8e3d1f92a45
Revises: 22042026_add_due_time
Create Date: 2026-04-27

"""
from alembic import op
import sqlalchemy as sa

revision = "b8e3d1f92a45"
down_revision = "22042026_add_due_time"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "service_bookings",
        sa.Column("flow_type", sa.String(), nullable=False, server_default="systematic"),
    )
    op.add_column(
        "service_requests",
        sa.Column("flow_type", sa.String(), nullable=False, server_default="systematic"),
    )


def downgrade() -> None:
    op.drop_column("service_bookings", "flow_type")
    op.drop_column("service_requests", "flow_type")
