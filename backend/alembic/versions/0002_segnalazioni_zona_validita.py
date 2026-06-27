"""Segnalazioni: aggiunta zona testuale e periodo di validità (valida_dal, valida_al).

Revision ID: 0002_zona
Revises: 0001_ruoli
Create Date: 2026-06-26

[V] Supporto a UC-19 (Segnalazione Manutenzioni Urbane) lato Amministrazione.
Tutti i campi nullable per non rompere righe esistenti.
In questo progetto l'applicazione effettiva avviene tramite _ensure_schema() in
main.py (idempotente, IF NOT EXISTS). Questa migration è il riferimento ufficiale.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_zona"
down_revision: Union[str, None] = "0001_ruoli"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("segnalazioni", sa.Column("zona", sa.String(200), nullable=True))
    op.add_column("segnalazioni", sa.Column("valida_dal", sa.Date(), nullable=True))
    op.add_column("segnalazioni", sa.Column("valida_al",  sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("segnalazioni", "valida_al")
    op.drop_column("segnalazioni", "valida_dal")
    op.drop_column("segnalazioni", "zona")
