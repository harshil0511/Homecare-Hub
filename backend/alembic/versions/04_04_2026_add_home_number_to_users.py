"""add home_number and resident_name to users

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('home_number', sa.String(), nullable=True))
    op.add_column('users', sa.Column('resident_name', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'resident_name')
    op.drop_column('users', 'home_number')
