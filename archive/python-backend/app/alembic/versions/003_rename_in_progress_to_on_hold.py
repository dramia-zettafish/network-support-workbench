"""Rename in progress status to on hold

Revision ID: 003_on_hold_status
Revises: 002_fix_ticket_enum_and_priority
Create Date: 2026-05-05 13:35:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "003_on_hold_status"
down_revision: Union[str, None] = "002_fix_ticket_enum_and_priority"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = 'status'
                  AND e.enumlabel = 'in_progress'
            ) THEN
                ALTER TYPE status RENAME VALUE 'in_progress' TO 'on_hold';
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = 'status'
                  AND e.enumlabel = 'on_hold'
            ) THEN
                ALTER TYPE status RENAME VALUE 'on_hold' TO 'in_progress';
            END IF;
        END $$;
        """
    )
