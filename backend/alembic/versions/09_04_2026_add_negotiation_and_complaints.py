"""add negotiation_offers and booking_complaints tables

Revision ID: 09042026_negotiation
Revises: 4e0ab3776917
Create Date: 2026-04-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "09042026_negotiation"
down_revision = "4e0ab3776917"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add negotiation columns to service_request_responses
    op.add_column("service_request_responses",
        sa.Column("negotiation_status", sa.String, nullable=False, server_default="NONE"))
    op.add_column("service_request_responses",
        sa.Column("agreed_price", sa.Float, nullable=True))
    op.add_column("service_request_responses",
        sa.Column("agreed_date", sa.DateTime, nullable=True))
    op.add_column("service_request_responses",
        sa.Column("current_round", sa.Integer, nullable=False, server_default="0"))

    # 2. Add completed_at to service_bookings
    op.add_column("service_bookings",
        sa.Column("completed_at", sa.DateTime, nullable=True))

    # 3. Create negotiation_offers table
    op.create_table(
        "negotiation_offers",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("response_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("service_request_responses.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("offered_by", sa.String, nullable=False),
        sa.Column("round_number", sa.Integer, nullable=False),
        sa.Column("proposed_date", sa.DateTime, nullable=False),
        sa.Column("proposed_time", sa.String(50), nullable=False),
        sa.Column("proposed_price", sa.Float, nullable=False),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("status", sa.String, nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_negotiation_offers_response_id", "negotiation_offers", ["response_id"])

    # 4. Create booking_complaints table
    op.create_table(
        "booking_complaints",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("booking_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("service_bookings.id"), nullable=False),
        sa.Column("filed_by", PG_UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("status", sa.String, nullable=False, server_default="OPEN"),
        sa.Column("admin_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
        sa.Column("resolved_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_booking_complaints_booking_id", "booking_complaints", ["booking_id"])
    op.create_index("ix_booking_complaints_filed_by", "booking_complaints", ["filed_by"])


def downgrade() -> None:
    op.drop_index("ix_booking_complaints_filed_by", table_name="booking_complaints")
    op.drop_index("ix_booking_complaints_booking_id", table_name="booking_complaints")
    op.drop_table("booking_complaints")
    op.drop_index("ix_negotiation_offers_response_id", table_name="negotiation_offers")
    op.drop_table("negotiation_offers")
    op.drop_column("service_bookings", "completed_at")
    op.drop_column("service_request_responses", "current_round")
    op.drop_column("service_request_responses", "agreed_date")
    op.drop_column("service_request_responses", "agreed_price")
    op.drop_column("service_request_responses", "negotiation_status")
