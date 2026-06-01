"""add no replacement response type

Revision ID: 014_no_replacement_response
Revises: 013_create_device_responses
Create Date: 2026-05-08 00:00:00.000000
"""

from alembic import op


revision = "014_no_replacement_response"
down_revision = "013_create_device_responses"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE deviceresponseresolutiontype ADD VALUE IF NOT EXISTS 'no_replacement'")


def downgrade():
    # PostgreSQL does not support removing enum values directly. Leaving the value
    # in place keeps downgrades non-destructive for existing response records.
    pass
