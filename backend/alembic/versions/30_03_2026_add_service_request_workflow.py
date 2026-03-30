"""add service request workflow

Revision ID: a1b2c3d4e5f6
Revises: 90393c05f34f
Create Date: 2026-03-30 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '90393c05f34f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'service_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('contact_name', sa.String(), nullable=False),
        sa.Column('contact_mobile', sa.String(), nullable=False),
        sa.Column('location', sa.String(), nullable=False),
        sa.Column('device_or_issue', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('photos', sa.Text(), nullable=True),
        sa.Column('preferred_dates', sa.Text(), nullable=True),
        sa.Column('urgency', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('resulting_booking_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['resulting_booking_id'], ['service_bookings.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_service_requests_id'), 'service_requests', ['id'])
    op.create_index('ix_service_requests_user_id', 'service_requests', ['user_id'])
    op.create_index('ix_service_requests_status', 'service_requests', ['status'])

    op.create_table(
        'service_request_recipients',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=True),
        sa.Column('notified_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['request_id'], ['service_requests.id']),
        sa.ForeignKeyConstraint(['provider_id'], ['service_providers.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_service_request_recipients_id'), 'service_request_recipients', ['id'])
    op.create_index('ix_srr_request_provider', 'service_request_recipients', ['request_id', 'provider_id'])

    op.create_table(
        'service_request_responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=False),
        sa.Column('proposed_date', sa.DateTime(), nullable=False),
        sa.Column('proposed_price', sa.Float(), nullable=False),
        sa.Column('estimated_hours', sa.Float(), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['request_id'], ['service_requests.id']),
        sa.ForeignKeyConstraint(['provider_id'], ['service_providers.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_service_request_responses_id'), 'service_request_responses', ['id'])
    op.create_index('ix_srresp_request_id', 'service_request_responses', ['request_id'])


def downgrade() -> None:
    op.drop_index('ix_srresp_request_id', table_name='service_request_responses')
    op.drop_index(op.f('ix_service_request_responses_id'), table_name='service_request_responses')
    op.drop_table('service_request_responses')
    op.drop_index('ix_srr_request_provider', table_name='service_request_recipients')
    op.drop_index(op.f('ix_service_request_recipients_id'), table_name='service_request_recipients')
    op.drop_table('service_request_recipients')
    op.drop_index('ix_service_requests_status', table_name='service_requests')
    op.drop_index('ix_service_requests_user_id', table_name='service_requests')
    op.drop_index(op.f('ix_service_requests_id'), table_name='service_requests')
    op.drop_table('service_requests')
