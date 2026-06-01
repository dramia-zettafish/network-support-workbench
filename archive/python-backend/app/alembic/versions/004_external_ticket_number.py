"""Add external ticket number

Revision ID: 004_external_ticket_number
Revises: 003_on_hold_status
Create Date: 2026-05-05 13:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "004_external_ticket_number"
down_revision: Union[str, None] = "003_on_hold_status"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def _column_exists(bind: sa.Connection, table_name: str, column_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = :table_name
                  AND column_name = :column_name
                """
            ),
            {"table_name": table_name, "column_name": column_name},
        ).scalar()
    )


def _index_exists(bind: sa.Connection, index_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                """
                SELECT 1
                FROM pg_indexes
                WHERE indexname = :index_name
                """
            ),
            {"index_name": index_name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    if not _column_exists(bind, "tickets", "external_ticket_number"):
        op.add_column("tickets", sa.Column("external_ticket_number", sa.String(length=8), nullable=True))

    if not _index_exists(bind, "ix_tickets_external_ticket_number"):
        op.create_index(
            "ix_tickets_external_ticket_number",
            "tickets",
            ["external_ticket_number"],
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _index_exists(bind, "ix_tickets_external_ticket_number"):
        op.drop_index("ix_tickets_external_ticket_number", table_name="tickets")

    if _column_exists(bind, "tickets", "external_ticket_number"):
        op.drop_column("tickets", "external_ticket_number")
