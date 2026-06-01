"""Create RMAs table

Revision ID: 006_create_rmas
Revises: 005_ticket_field_limits
Create Date: 2026-05-05 14:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "006_create_rmas"
down_revision: Union[str, None] = "005_ticket_field_limits"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rmas",
        sa.Column("rma_id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("ticket_number", sa.Integer(), nullable=True),
        sa.Column("customer", sa.String(length=255), nullable=False),
        sa.Column("campus", sa.String(length=255), nullable=False),
        sa.Column("dynamics_case_number", sa.String(length=32), nullable=False),
        sa.Column("part_number_model", sa.String(length=100), nullable=False),
        sa.Column("defective_serial_number", sa.String(length=100), nullable=False),
        sa.Column("issue", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["ticket_number"], ["tickets.ticket_number"]),
    )
    op.create_index("ix_rmas_rma_id", "rmas", ["rma_id"])
    op.create_index("ix_rmas_ticket_number", "rmas", ["ticket_number"])
    op.create_index("ix_rmas_dynamics_case_number", "rmas", ["dynamics_case_number"])


def downgrade() -> None:
    op.drop_index("ix_rmas_dynamics_case_number", table_name="rmas")
    op.drop_index("ix_rmas_ticket_number", table_name="rmas")
    op.drop_index("ix_rmas_rma_id", table_name="rmas")
    op.drop_table("rmas")
