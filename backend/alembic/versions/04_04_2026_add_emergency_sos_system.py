"""add emergency sos system tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-04 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'emergency_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('callout_fee', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('hourly_rate', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('category'),
    )
    op.create_index('ix_emergency_config_id', 'emergency_config', ['id'])

    op.create_table(
        'emergency_penalty_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('star_deduction', sa.Float(), nullable=False, server_default='0.5'),
        sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_type'),
    )
    op.create_index('ix_emergency_penalty_config_id', 'emergency_penalty_config', ['id'])

    op.create_table(
        'emergency_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('society_name', sa.String(), nullable=False),
        sa.Column('building_name', sa.String(), nullable=False),
        sa.Column('flat_no', sa.String(), nullable=False),
        sa.Column('landmark', sa.String(), nullable=False),
        sa.Column('full_address', sa.Text(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('device_name', sa.String(), nullable=True),
        sa.Column('photos', sa.Text(), nullable=True),
        sa.Column('contact_name', sa.String(), nullable=False),
        sa.Column('contact_phone', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('config_id', sa.Integer(), sa.ForeignKey('emergency_config.id'), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('resulting_booking_id', sa.Integer(), sa.ForeignKey('service_bookings.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_emergency_requests_id', 'emergency_requests', ['id'])
    op.create_index('ix_emergency_requests_user_id', 'emergency_requests', ['user_id'])
    op.create_index('ix_emergency_requests_status', 'emergency_requests', ['status'])

    op.create_table(
        'emergency_responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.Integer(), sa.ForeignKey('emergency_requests.id'), nullable=False),
        sa.Column('provider_id', sa.Integer(), sa.ForeignKey('service_providers.id'), nullable=False),
        sa.Column('arrival_time', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('penalty_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_emergency_responses_id', 'emergency_responses', ['id'])
    op.create_index('ix_emergency_responses_request_id', 'emergency_responses', ['request_id'])
    op.create_index('ix_emergency_responses_status', 'emergency_responses', ['status'])

    op.create_table(
        'emergency_star_adjustments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), sa.ForeignKey('service_providers.id'), nullable=False),
        sa.Column('adjusted_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('delta', sa.Float(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('emergency_request_id', sa.Integer(), sa.ForeignKey('emergency_requests.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_emergency_star_adjustments_id', 'emergency_star_adjustments', ['id'])
    op.create_index('ix_emergency_star_adjustments_provider_id', 'emergency_star_adjustments', ['provider_id'])


def downgrade() -> None:
    op.drop_table('emergency_star_adjustments')
    op.drop_table('emergency_responses')
    op.drop_table('emergency_requests')
    op.drop_table('emergency_penalty_config')
    op.drop_table('emergency_config')
