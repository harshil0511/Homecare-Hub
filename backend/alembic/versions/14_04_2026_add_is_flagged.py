"""add is_flagged to service_bookings

Revision ID: 14042026_is_flagged
Revises: 13042026_home_members
Branch_labels: None
Depends_on: None
"""

from alembic import op
import sqlalchemy as sa

revision = "14042026_is_flagged"
down_revision = "13042026_society_contracts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "service_bookings",
        sa.Column("is_flagged", sa.Boolean, nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("service_bookings", "is_flagged")
