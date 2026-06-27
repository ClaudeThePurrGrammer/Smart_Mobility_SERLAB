"""AreaRestrizione: aggiunta periodo di validità (valida_dal, valida_al).

Revision ID: 0003_aree
Revises: 0002_zona
Create Date: 2026-06-26

[V] Supporto a UC-21 (Configurazione Aree con Restrizioni) lato Amministrazione.
Entrambi i campi nullable per non rompere le aree già esistenti (validità indefinita).
In questo progetto l'applicazione effettiva avviene tramite _ensure_schema() in
main.py (idempotente, IF NOT EXISTS). Questa migration è il riferimento ufficiale.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_aree"
down_revision: Union[str, None] = "0002_zona"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("aree_restrizione", sa.Column("valida_dal", sa.Date(), nullable=True))
    op.add_column("aree_restrizione", sa.Column("valida_al",  sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("aree_restrizione", "valida_al")
    op.drop_column("aree_restrizione", "valida_dal")
