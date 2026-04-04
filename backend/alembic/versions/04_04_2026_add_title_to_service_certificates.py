# backend/alembic/versions/04_04_2026_add_title_to_service_certificates.py
"""add_title_to_service_certificates

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('service_certificates', sa.Column('title', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('service_certificates', 'title')
