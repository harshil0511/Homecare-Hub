"""add alert fields to maintenance tasks and bookings

Revision ID: f2a3b4c5d6e7
Revises: e5f6a7b8c9d0
Create Date: 2026-04-05 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f2a3b4c5d6e7'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # MaintenanceTask — alert lifecycle tracking fields
    op.add_column('maintenance_tasks', sa.Column('warning_sent', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('maintenance_tasks', sa.Column('final_sent', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('maintenance_tasks', sa.Column('overdue_sent', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('maintenance_tasks', sa.Column('completed_at', sa.DateTime(), nullable=True))
    op.add_column('maintenance_tasks', sa.Column('completion_method', sa.String(50), nullable=True))

    # ServiceBooking — track when booking originated from an alert
    op.add_column('service_bookings', sa.Column('source_type', sa.String(50), nullable=True))
    op.add_column('service_bookings', sa.Column('source_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('maintenance_tasks', 'warning_sent')
    op.drop_column('maintenance_tasks', 'final_sent')
    op.drop_column('maintenance_tasks', 'overdue_sent')
    op.drop_column('maintenance_tasks', 'completed_at')
    op.drop_column('maintenance_tasks', 'completion_method')
    op.drop_column('service_bookings', 'source_type')
    op.drop_column('service_bookings', 'source_id')
