"""Fix ticket device type enum values and add priority

Revision ID: 002_fix_ticket_enum_and_priority
Revises: 001_initial_schema
Create Date: 2026-05-05 13:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "002_fix_ticket_enum_and_priority"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def _enum_labels(bind: sa.Connection, enum_name: str) -> list[str]:
    return list(
        bind.execute(
            sa.text(
                """
                SELECT e.enumlabel
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = :enum_name
                ORDER BY e.enumsortorder
                """
            ),
            {"enum_name": enum_name},
        ).scalars()
    )


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


def upgrade() -> None:
    bind = op.get_bind()

    if _enum_labels(bind, "device_type") == ["Switch", "Access Point", "UPS"]:
        op.execute("CREATE TYPE device_type_new AS ENUM ('switch', 'access_point', 'ups')")
        op.execute(
            """
            ALTER TABLE tickets
            ALTER COLUMN device_type TYPE device_type_new
            USING (
                CASE device_type::text
                    WHEN 'Switch' THEN 'switch'
                    WHEN 'Access Point' THEN 'access_point'
                    WHEN 'UPS' THEN 'ups'
                    ELSE device_type::text
                END
            )::device_type_new
            """
        )
        op.execute("DROP TYPE device_type")
        op.execute("ALTER TYPE device_type_new RENAME TO device_type")

    if not _column_exists(bind, "tickets", "priority"):
        priority_enum = sa.Enum("low", "medium", "high", name="priority")
        priority_enum.create(bind, checkfirst=True)
        op.add_column("tickets", sa.Column("priority", priority_enum, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()

    if _column_exists(bind, "tickets", "priority"):
        op.drop_column("tickets", "priority")
    sa.Enum(name="priority").drop(bind, checkfirst=True)

    if _enum_labels(bind, "device_type") == ["switch", "access_point", "ups"]:
        op.execute("CREATE TYPE device_type_old AS ENUM ('Switch', 'Access Point', 'UPS')")
        op.execute(
            """
            ALTER TABLE tickets
            ALTER COLUMN device_type TYPE device_type_old
            USING (
                CASE device_type::text
                    WHEN 'switch' THEN 'Switch'
                    WHEN 'access_point' THEN 'Access Point'
                    WHEN 'ups' THEN 'UPS'
                    ELSE device_type::text
                END
            )::device_type_old
            """
        )
        op.execute("DROP TYPE device_type")
        op.execute("ALTER TYPE device_type_old RENAME TO device_type")
