"""Crea tabella azioni_operatore_log (audit trail azioni operative, OP.08+).

Revision ID: 0004_log
Revises: 0003_aree
Create Date: 2026-06-26

Tabella generica per il log delle azioni eseguite dagli operatori su utenti
e risorse. Attualmente popolata da OP.08 (cambio stato account); estensibile
a future user story operative senza ulteriori migration.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_log"
down_revision: Union[str, None] = "0003_aree"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "azioni_operatore_log",
        sa.Column("id",            sa.Integer(),                              nullable=False, primary_key=True),
        sa.Column("operatore_id",  sa.Integer(), sa.ForeignKey("users.id"),   nullable=False),
        sa.Column("utente_id",     sa.Integer(), sa.ForeignKey("users.id"),   nullable=True),
        sa.Column("azione",        sa.String(60),                             nullable=False),
        sa.Column("motivo",        sa.Text(),                                 nullable=False, server_default=""),
        sa.Column("dettaglio",     sa.Text(),                                 nullable=False, server_default=""),
        sa.Column("timestamp",     sa.DateTime(timezone=True),                nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("azioni_operatore_log")
