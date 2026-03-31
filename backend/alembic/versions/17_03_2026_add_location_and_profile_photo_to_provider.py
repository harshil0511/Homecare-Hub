"""add_location_and_profile_photo_to_provider

Revision ID: f1a2b3c4d5e6
Revises: e018acc20df6
Create Date: 2026-03-17 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e018acc20df6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('service_providers', sa.Column('location', sa.String(), nullable=True))
    op.add_column('service_providers', sa.Column('profile_photo_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('service_providers', 'profile_photo_url')
    op.drop_column('service_providers', 'location')
