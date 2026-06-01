"""Add ticket field limits

Revision ID: 005_ticket_field_limits
Revises: 004_external_ticket_number
Create Date: 2026-05-05 13:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "005_ticket_field_limits"
down_revision: Union[str, None] = "004_external_ticket_number"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def _constraint_exists(bind: sa.Connection, constraint_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                """
                SELECT 1
                FROM information_schema.table_constraints
                WHERE table_name = 'tickets'
                  AND constraint_name = :constraint_name
                """
            ),
            {"constraint_name": constraint_name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    if not _constraint_exists(bind, "ck_tickets_tea_code_3_digits"):
        op.execute(
            """
            ALTER TABLE tickets
            ADD CONSTRAINT ck_tickets_tea_code_3_digits
            CHECK (tea_code >= 0 AND tea_code <= 999)
            NOT VALID
            """
        )

    if not _constraint_exists(bind, "ck_tickets_external_ticket_number_len"):
        op.execute(
            """
            ALTER TABLE tickets
            ADD CONSTRAINT ck_tickets_external_ticket_number_len
            CHECK (external_ticket_number IS NULL OR char_length(external_ticket_number) <= 8)
            NOT VALID
            """
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _constraint_exists(bind, "ck_tickets_external_ticket_number_len"):
        op.drop_constraint("ck_tickets_external_ticket_number_len", "tickets", type_="check")

    if _constraint_exists(bind, "ck_tickets_tea_code_3_digits"):
        op.drop_constraint("ck_tickets_tea_code_3_digits", "tickets", type_="check")
