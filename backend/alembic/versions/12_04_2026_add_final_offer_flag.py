"""add is_final_offer flag to negotiation tables

Revision ID: 12042026_final_offer
Revises: 11042026_secretary_complaints
Create Date: 2026-04-12
"""

from alembic import op
import sqlalchemy as sa

revision = "12042026_final_offer"
down_revision = "11042026_secretary_complaints"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_final_offer to negotiation_offers (counter offers)
    op.add_column(
        "negotiation_offers",
        sa.Column("is_final_offer", sa.Boolean, nullable=False, server_default="false"),
    )
    # Add is_final_offer to service_request_responses (initial offers)
    op.add_column(
        "service_request_responses",
        sa.Column("is_final_offer", sa.Boolean, nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("negotiation_offers", "is_final_offer")
    op.drop_column("service_request_responses", "is_final_offer")
