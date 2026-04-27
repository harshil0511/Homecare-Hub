"""add due_time to maintenance_tasks

Revision ID: 22042026_add_due_time
Revises: 14042026_is_flagged
Branch_labels: None
Depends_on: None
"""

from alembic import op
import sqlalchemy as sa

revision = "22042026_add_due_time"
down_revision = "14042026_is_flagged"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "maintenance_tasks",
        sa.Column("due_time", sa.Time, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("maintenance_tasks", "due_time")
