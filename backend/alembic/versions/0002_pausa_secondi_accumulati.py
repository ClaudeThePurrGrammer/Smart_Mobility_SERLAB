"""Aggiunge colonne pausa alla tabella rides: orario_inizio_pausa e pausa_secondi_accumulati.

Revision ID: 0002_pausa
Revises: 0001_ruoli
Create Date: 2026-06-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_pausa"
down_revision: Union[str, None] = "0001_ruoli"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("rides", sa.Column("orario_inizio_pausa", sa.DateTime(timezone=True), nullable=True))
    op.add_column("rides", sa.Column("pausa_secondi_accumulati", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("rides", "pausa_secondi_accumulati")
    op.drop_column("rides", "orario_inizio_pausa")
