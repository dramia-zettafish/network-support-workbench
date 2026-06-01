"""Extend UPS installations with phase workflow fields

Revision ID: 010_extend_ups_phase
Revises: 009_add_ups_workflow_fields
Create Date: 2026-05-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "010_extend_ups_phase"
down_revision: Union[str, None] = "009_add_ups_workflow_fields"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # Add missing columns to ups_installations table
    op.add_column('ups_installations', sa.Column('snmp_ip', sa.String(length=100), nullable=True))
    op.add_column('ups_installations', sa.Column('battery_pack_1_asset_tag', sa.String(length=100), nullable=True))
    op.add_column('ups_installations', sa.Column('ups_po', sa.String(length=100), nullable=True))
    op.add_column('ups_installations', sa.Column('bp_po', sa.String(length=100), nullable=True))
    op.add_column('ups_installations', sa.Column('proposed_install_date', sa.String(), nullable=True))
    op.add_column('ups_installations', sa.Column('approved_install_date', sa.String(), nullable=True))
    op.add_column('ups_installations', sa.Column('install_contact', sa.String(length=255), nullable=True))
    op.add_column('ups_installations', sa.Column('install_contact_number', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('ups_installations', 'install_contact_number')
    op.drop_column('ups_installations', 'install_contact')
    op.drop_column('ups_installations', 'approved_install_date')
    op.drop_column('ups_installations', 'proposed_install_date')
    op.drop_column('ups_installations', 'bp_po')
    op.drop_column('ups_installations', 'ups_po')
    op.drop_column('ups_installations', 'battery_pack_1_asset_tag')
    op.drop_column('ups_installations', 'snmp_ip')
