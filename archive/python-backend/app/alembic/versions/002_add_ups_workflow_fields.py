"""Add UPS workflow fields

Revision ID: 009_add_ups_workflow_fields
Revises: 008_create_ups_installs
Create Date: 2026-05-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "009_add_ups_workflow_fields"
down_revision: Union[str, None] = "008_create_ups_installs"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ups_installations', sa.Column('defective_battery_pack_serial', sa.String(length=100), nullable=True))
    op.add_column('ups_installations', sa.Column('idf', sa.String(length=100), nullable=True))
    op.add_column('ups_installations', sa.Column('new_serial_number', sa.String(length=100), nullable=True))
    op.add_column('ups_installations', sa.Column('new_webcard_serial', sa.String(length=100), nullable=True))
    op.add_column('ups_installations', sa.Column('hostname', sa.String(length=100), nullable=True))
    op.add_column('ups_installations', sa.Column('new_battery_pack_asset_tag', sa.String(length=100), nullable=True))
    op.add_column('ups_installations', sa.Column('new_battery_pack_serial', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('ups_installations', 'new_battery_pack_serial')
    op.drop_column('ups_installations', 'new_battery_pack_asset_tag')
    op.drop_column('ups_installations', 'hostname')
    op.drop_column('ups_installations', 'new_webcard_serial')
    op.drop_column('ups_installations', 'new_serial_number')
    op.drop_column('ups_installations', 'idf')
    op.drop_column('ups_installations', 'defective_battery_pack_serial')
