"""add completion fields to bookings

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('service_bookings', sa.Column('actual_hours', sa.Float(), nullable=True))
    op.add_column('service_bookings', sa.Column('completion_notes', sa.Text(), nullable=True))
    op.add_column('service_bookings', sa.Column('completion_photos', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('service_bookings', 'completion_photos')
    op.drop_column('service_bookings', 'completion_notes')
    op.drop_column('service_bookings', 'actual_hours')
