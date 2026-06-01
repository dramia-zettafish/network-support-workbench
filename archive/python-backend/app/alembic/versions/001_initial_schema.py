"""Initial schema - create tickets table

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-05-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'tickets',
        sa.Column('ticket_number', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('external_ticket_number', sa.String(length=8), nullable=False),
        sa.Column('school_name', sa.String(), nullable=False),
        sa.Column('tea_code', sa.Integer(), nullable=False),
        sa.Column('date', sa.String(), nullable=False),
        sa.Column('note', sa.String(), nullable=True),
        sa.Column('device_type', sa.Enum('switch', 'access_point', 'ups', name='device_type'), nullable=False),
        sa.Column('status', sa.Enum('open', 'on_hold', 'closed', name='status'), nullable=False, server_default='open'),
        sa.Column('priority', sa.Enum('low', 'medium', 'high', name='priority'), nullable=True),
        sa.CheckConstraint('tea_code >= 0 AND tea_code <= 999', name='ck_tickets_tea_code_3_digits'),
        sa.CheckConstraint('char_length(external_ticket_number) <= 8', name='ck_tickets_external_ticket_number_len'),
    )
    op.create_index('ix_tickets_ticket_number', 'tickets', ['ticket_number'])
    op.create_index('ix_tickets_external_ticket_number', 'tickets', ['external_ticket_number'])
    op.create_index('ix_tickets_school_name', 'tickets', ['school_name'])


def downgrade() -> None:
    op.drop_index('ix_tickets_school_name', table_name='tickets')
    op.drop_index('ix_tickets_external_ticket_number', table_name='tickets')
    op.drop_index('ix_tickets_ticket_number', table_name='tickets')
    op.drop_table('tickets')
