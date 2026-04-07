"""recalculate_provider_ratings_from_points

Revision ID: 4e0ab3776917
Revises: 07042026_provider_points
Create Date: 2026-04-07 21:40:49.377963

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '4e0ab3776917'
down_revision: Union[str, None] = '07042026_provider_points'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Recalculate every provider's rating from their actual accumulated points.
    # Providers with no points get 0.0 (shows as "★ New" in the UI).
    # Formula: rating = GREATEST(0.0, SUM(delta) / 100.0)
    op.execute("""
        UPDATE service_providers
        SET rating = GREATEST(0.0, COALESCE(
            (SELECT SUM(delta) FROM provider_points WHERE provider_id = service_providers.id),
            0.0
        ) / 100.0)
    """)


def downgrade() -> None:
    # Restore the old hardcoded 5.0 default for providers with no points
    op.execute("""
        UPDATE service_providers
        SET rating = 5.0
        WHERE id NOT IN (SELECT DISTINCT provider_id FROM provider_points)
    """)
