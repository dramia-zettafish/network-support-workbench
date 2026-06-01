"""Link RMAs to tickets

Revision ID: 007_link_rmas_tickets
Revises: 006_create_rmas
Create Date: 2026-05-05 14:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "007_link_rmas_tickets"
down_revision: Union[str, None] = "006_create_rmas"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # This migration is now redundant because ticket_number is already created in
    # 006_create_rmas. Keep this as a no-op to preserve the revision history.
    pass


def downgrade() -> None:
    pass
