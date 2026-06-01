"""add ups scheduling statuses

Revision ID: 011_ups_schedule_status
Revises: 010_extend_ups_phase
Create Date: 2026-05-06 00:00:00.000000
"""

from alembic import op


revision = "011_ups_schedule_status"
down_revision = "010_extend_ups_phase"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE ups_installations ALTER COLUMN status DROP DEFAULT")
    op.execute("CREATE TYPE upsinstallstatus_new AS ENUM ('intake', 'servicing', 'scheduled', 'fulfilled')")
    op.execute(
        """
        ALTER TABLE ups_installations
        ALTER COLUMN status TYPE upsinstallstatus_new
        USING 'intake'::upsinstallstatus_new
        """
    )
    op.execute("ALTER TABLE ups_installations ALTER COLUMN status SET DEFAULT 'intake'")
    op.execute("DROP TYPE upsinstallstatus")
    op.execute("ALTER TYPE upsinstallstatus_new RENAME TO upsinstallstatus")


def downgrade():
    op.execute("ALTER TABLE ups_installations ALTER COLUMN status DROP DEFAULT")
    op.execute("CREATE TYPE upsinstallstatus_old AS ENUM ('pending', 'completed', 'cancelled')")
    op.execute(
        """
        ALTER TABLE ups_installations
        ALTER COLUMN status TYPE upsinstallstatus_old
        USING CASE
            WHEN status::text = 'fulfilled' THEN 'completed'::upsinstallstatus_old
            ELSE 'pending'::upsinstallstatus_old
        END
        """
    )
    op.execute("ALTER TABLE ups_installations ALTER COLUMN status SET DEFAULT 'pending'")
    op.execute("DROP TYPE upsinstallstatus")
    op.execute("ALTER TYPE upsinstallstatus_old RENAME TO upsinstallstatus")
