"""add payment profiles table

Revision ID: c9f4e2a83b56
Revises: b8e3d1f92a45
Create Date: 2026-04-27

"""
from alembic import op
import sqlalchemy as sa

revision = "c9f4e2a83b56"
down_revision = "b8e3d1f92a45"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payment_profiles",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("account_holder_name", sa.String(60), nullable=False),
        sa.Column("account_number_encrypted", sa.Text(), nullable=False),
        sa.Column("account_number_last4", sa.String(4), nullable=False),
        sa.Column("ifsc_code", sa.String(11), nullable=False),
        sa.Column("branch", sa.String(100), nullable=False),
        sa.Column("upi_id", sa.String(100), nullable=True),
        sa.Column("upi_qr_image_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("payment_profiles")
