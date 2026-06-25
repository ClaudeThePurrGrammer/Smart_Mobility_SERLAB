"""Ruoli OPERATORE/AMMINISTRAZIONE: role+stato account, profili 1:1,
evoluzione reports→segnalazioni, aree_restrizione, parking_areas, blocco mezzi.

Revision ID: 0001_ruoli
Revises:
Create Date: 2026-06-23

[V] Implementa le decisioni confermate (punti 4 e 5). Migrazione pensata per un DB
con lo schema pre-ruoli (tabella `reports` esistente). Su DB nuovi usare create_all.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_ruoli"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users: ruolo e stato account ──────────────────────────────────────────
    op.add_column("users", sa.Column("role", sa.String(20), server_default="UTENTE", nullable=False))
    op.add_column("users", sa.Column("account_status", sa.String(20), server_default="ATTIVO", nullable=False))
    op.create_index("ix_users_role", "users", ["role"])

    # ── vehicles: blocco remoto (OP.09) ───────────────────────────────────────
    op.add_column("vehicles", sa.Column("locked", sa.Boolean(), server_default=sa.false(), nullable=False))

    # ── Profili 1:1 per ruolo ─────────────────────────────────────────────────
    op.create_table(
        "operatore_profili",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("zona_competenza", sa.String(120), server_default="", nullable=False),
        sa.Column("matricola", sa.String(40), nullable=True),
    )
    op.create_table(
        "amministrazione_profili",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("ente_appartenenza", sa.String(160), server_default="", nullable=False),
        sa.Column("codice_ente", sa.String(40), nullable=True),
    )

    # ── reports → segnalazioni (consolidamento entità di dominio) ─────────────
    op.rename_table("reports", "segnalazioni")
    op.alter_column("segnalazioni", "status", new_column_name="stato", existing_type=sa.String(20))
    op.add_column("segnalazioni", sa.Column("ride_id", sa.Integer(), sa.ForeignKey("rides.id"), nullable=True))
    op.add_column("segnalazioni", sa.Column("tipo", sa.String(40), server_default="ALTRO", nullable=False))
    op.add_column("segnalazioni", sa.Column("gravita", sa.String(10), server_default="MEDIA", nullable=False))
    op.add_column("segnalazioni", sa.Column("gps_lat", sa.Float(), nullable=True))
    op.add_column("segnalazioni", sa.Column("gps_lng", sa.Float(), nullable=True))
    op.add_column("segnalazioni", sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True))
    # Normalizza i valori di stato storici (open/resolved → APERTA/CHIUSA).
    op.execute("UPDATE segnalazioni SET stato = 'APERTA' WHERE stato IN ('open', 'OPEN')")
    op.execute("UPDATE segnalazioni SET stato = 'CHIUSA' WHERE stato IN ('resolved', 'RESOLVED')")
    op.alter_column("segnalazioni", "stato", server_default="APERTA")

    # ── aree_restrizione (AP.04) ──────────────────────────────────────────────
    op.create_table(
        "aree_restrizione",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("tipo", sa.String(20), server_default="NO_GO", nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("radius_m", sa.Integer(), server_default="120", nullable=False),
        sa.Column("vehicle_types", sa.JSON(), nullable=True),
        sa.Column("orario", sa.String(40), nullable=True),
        sa.Column("attiva", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("note", sa.Text(), server_default="", nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── parking_areas (aree di sosta a fine corsa) ────────────────────────────
    op.create_table(
        "parking_areas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("address", sa.String(160), server_default="", nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("radius_m", sa.Integer(), server_default="60", nullable=False),
        sa.Column("capacity", sa.Integer(), server_default="20", nullable=False),
        sa.Column("occupied", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_table("parking_areas")
    op.drop_table("aree_restrizione")

    op.drop_column("segnalazioni", "closed_at")
    op.drop_column("segnalazioni", "gps_lng")
    op.drop_column("segnalazioni", "gps_lat")
    op.drop_column("segnalazioni", "gravita")
    op.drop_column("segnalazioni", "tipo")
    op.drop_column("segnalazioni", "ride_id")
    op.execute("UPDATE segnalazioni SET stato = 'open' WHERE stato = 'APERTA'")
    op.execute("UPDATE segnalazioni SET stato = 'resolved' WHERE stato = 'CHIUSA'")
    op.alter_column("segnalazioni", "stato", new_column_name="status", existing_type=sa.String(20))
    op.rename_table("segnalazioni", "reports")

    op.drop_table("amministrazione_profili")
    op.drop_table("operatore_profili")

    op.drop_column("vehicles", "locked")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "account_status")
    op.drop_column("users", "role")
