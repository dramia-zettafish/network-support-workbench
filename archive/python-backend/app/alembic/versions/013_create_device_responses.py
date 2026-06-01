"""create device responses

Revision ID: 013_create_device_responses
Revises: 012_add_ticket_mdf_idf
Create Date: 2026-05-08 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "013_create_device_responses"
down_revision = "012_add_ticket_mdf_idf"
branch_labels = None
depends_on = None


resolution_type_enum = sa.Enum("permanent", "temp_rma", name="deviceresponseresolutiontype")
response_status_enum = sa.Enum("open", "temp_placed", "closed", name="deviceresponsestatus")


def upgrade():
    op.create_table(
        "device_responses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("resolution_type", resolution_type_enum, nullable=False),
        sa.Column("status", response_status_enum, nullable=False),
        sa.Column("response_note", sa.String(), nullable=True),
        sa.Column("temp_response_note", sa.String(), nullable=True),
        sa.Column("rma_response_note", sa.String(), nullable=True),
        sa.Column("defective_model", sa.String(length=100), nullable=True),
        sa.Column("defective_sn", sa.String(length=100), nullable=True),
        sa.Column("defective_mac", sa.String(length=32), nullable=True),
        sa.Column("defective_asset_tag", sa.String(length=100), nullable=True),
        sa.Column("defective_room", sa.String(length=50), nullable=True),
        sa.Column("replacement_model", sa.String(length=100), nullable=True),
        sa.Column("replacement_sn", sa.String(length=100), nullable=True),
        sa.Column("replacement_mac", sa.String(length=32), nullable=True),
        sa.Column("replacement_hostname", sa.String(length=100), nullable=True),
        sa.Column("replacement_ip", sa.String(length=100), nullable=True),
        sa.Column("replacement_asset_tag", sa.String(length=100), nullable=True),
        sa.Column("replacement_room", sa.String(length=50), nullable=True),
        sa.Column("temp_model", sa.String(length=100), nullable=True),
        sa.Column("temp_sn", sa.String(length=100), nullable=True),
        sa.Column("temp_mac", sa.String(length=32), nullable=True),
        sa.Column("temp_hostname", sa.String(length=100), nullable=True),
        sa.Column("temp_ip", sa.String(length=100), nullable=True),
        sa.Column("temp_asset_tag", sa.String(length=100), nullable=True),
        sa.Column("temp_room", sa.String(length=50), nullable=True),
        sa.Column("resolution_locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.ticket_number"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ticket_id", name="uq_device_responses_ticket_id"),
    )
    op.create_index("ix_device_responses_id", "device_responses", ["id"])
    op.create_index("ix_device_responses_ticket_id", "device_responses", ["ticket_id"])


def downgrade():
    op.drop_index("ix_device_responses_ticket_id", table_name="device_responses")
    op.drop_index("ix_device_responses_id", table_name="device_responses")
    op.drop_table("device_responses")

    bind = op.get_bind()
    response_status_enum.drop(bind, checkfirst=True)
    resolution_type_enum.drop(bind, checkfirst=True)
