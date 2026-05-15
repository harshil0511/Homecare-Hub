"""widen_ifsc_code_to_30

Revision ID: cfa0eb60778f
Revises: 29042026_emg_targeted
Create Date: 2026-05-15 11:02:18.769472

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cfa0eb60778f'
down_revision: Union[str, None] = '29042026_emg_targeted'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("payment_profiles", "ifsc_code",
                    existing_type=sa.String(11),
                    type_=sa.String(30),
                    existing_nullable=False)


def downgrade() -> None:
    op.alter_column("payment_profiles", "ifsc_code",
                    existing_type=sa.String(30),
                    type_=sa.String(11),
                    existing_nullable=False)
