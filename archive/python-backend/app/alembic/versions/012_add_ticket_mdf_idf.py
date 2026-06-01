"""add ticket mdf idf

Revision ID: 012_add_ticket_mdf_idf
Revises: 011_ups_schedule_status
Create Date: 2026-05-06 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "012_add_ticket_mdf_idf"
down_revision = "011_ups_schedule_status"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tickets", sa.Column("mdf_idf", sa.String(length=100), nullable=True))


def downgrade():
    op.drop_column("tickets", "mdf_idf")
