"""Create UPS installations table

Revision ID: 008_create_ups_installs
Revises: 007_link_rmas_tickets
Create Date: 2026-05-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "008_create_ups_installs"
down_revision: Union[str, None] = "007_link_rmas_tickets"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upsinstallstatus') THEN
                CREATE TYPE upsinstallstatus AS ENUM ('pending', 'completed', 'cancelled');
            END IF;
        END $$;
        """
    )
    ups_install_status = postgresql.ENUM(
        "pending",
        "completed",
        "cancelled",
        name="upsinstallstatus",
        create_type=False,
    )

    op.create_table(
        "ups_installations",
        sa.Column("ups_installation_id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("ticket_number", sa.Integer(), nullable=False),
        sa.Column("external_ticket_number", sa.String(length=8), nullable=True),
        sa.Column("school_name", sa.String(length=255), nullable=False),
        sa.Column("tea_code", sa.Integer(), nullable=False),
        sa.Column("created_date", sa.String(), nullable=False),
        sa.Column("status", ups_install_status, nullable=False, server_default="pending"),
        sa.Column("serial_number", sa.String(length=100), nullable=True),
        sa.Column("mac_address", sa.String(length=32), nullable=True),
        sa.Column("asset_tag", sa.String(length=100), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("room_number", sa.String(length=50), nullable=True),
        sa.Column("installed_date", sa.String(), nullable=True),
        sa.Column("installed_by", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.CheckConstraint("tea_code >= 0 AND tea_code <= 999", name="ck_ups_installations_tea_code_3_digits"),
        sa.ForeignKeyConstraint(["ticket_number"], ["tickets.ticket_number"], ondelete="CASCADE"),
        sa.UniqueConstraint("ticket_number", name="uq_ups_installations_ticket_number"),
    )
    op.create_index("ix_ups_installations_ups_installation_id", "ups_installations", ["ups_installation_id"])
    op.create_index("ix_ups_installations_ticket_number", "ups_installations", ["ticket_number"])


def downgrade() -> None:
    op.drop_index("ix_ups_installations_ticket_number", table_name="ups_installations")
    op.drop_index("ix_ups_installations_ups_installation_id", table_name="ups_installations")
    op.drop_table("ups_installations")
    postgresql.ENUM(name="upsinstallstatus").drop(op.get_bind(), checkfirst=True)
