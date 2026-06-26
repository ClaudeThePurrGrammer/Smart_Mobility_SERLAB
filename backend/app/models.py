"""Modelli del dominio (tabelle PostgreSQL)."""
from datetime import datetime, timezone

from sqlalchemy import (
    JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Vocabolari di dominio (valori persistiti come stringhe) ──────────────────
# [V] Ruoli account — enum confermato dal team (stringhe maiuscole).
ROLE_UTENTE = "UTENTE"
ROLE_OPERATORE = "OPERATORE"
ROLE_AMMINISTRAZIONE = "AMMINISTRAZIONE"
ROLES = (ROLE_UTENTE, ROLE_OPERATORE, ROLE_AMMINISTRAZIONE)

# [V] Stato account — gestione casi alternativi login (sospeso/bloccato), OP.08.
ACCOUNT_ATTIVO = "ATTIVO"
ACCOUNT_SOSPESO = "SOSPESO"
ACCOUNT_BLOCCATO = "BLOCCATO"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    surname: Mapped[str] = mapped_column(String(80), default="")
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Provenienza account: 'email' | 'google' | 'facebook' | 'apple'
    provider: Mapped[str] = mapped_column(String(20), default="email")
    provider_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    points: Mapped[int] = mapped_column(Integer, default=0)
    balance: Mapped[float] = mapped_column(Float, default=0.0)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # Preferenze impostazioni (toggle notifiche, posizione, biometria, ...).
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)

    # [V] Ruolo account (UTENTE | OPERATORE | AMMINISTRAZIONE) — base auth role-based.
    role: Mapped[str] = mapped_column(String(20), default=ROLE_UTENTE, index=True)
    # [V] Stato account — login bloccato se SOSPESO/BLOCCATO (OP.08, CU-24 alt).
    account_status: Mapped[str] = mapped_column(String(20), default=ACCOUNT_ATTIVO)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    rides = relationship("Ride", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("WalletTransaction", back_populates="user", cascade="all, delete-orphan")
    payment_methods = relationship("PaymentMethod", back_populates="user", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="user", cascade="all, delete-orphan")
    segnalazioni = relationship("Segnalazione", back_populates="user", cascade="all, delete-orphan")
    # Profili 1:1 specifici per ruolo (Class Table Inheritance, vedi [#redmine]).
    profilo_operatore = relationship("OperatoreProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    profilo_amministrazione = relationship("AmministrazioneProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")


class OperatoreProfile(Base):
    """[INF] Profilo 1:1 con User (role=OPERATORE): dati operativi specifici."""
    __tablename__ = "operatore_profili"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    zona_competenza: Mapped[str] = mapped_column(String(120), default="")  # area operativa
    matricola: Mapped[str | None] = mapped_column(String(40), nullable=True)

    user = relationship("User", back_populates="profilo_operatore")


class AmministrazioneProfile(Base):
    """[INF] Profilo 1:1 con User (role=AMMINISTRAZIONE): dati ente comunale."""
    __tablename__ = "amministrazione_profili"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    ente_appartenenza: Mapped[str] = mapped_column(String(160), default="")  # es. "Comune di Bari"
    codice_ente: Mapped[str | None] = mapped_column(String(40), nullable=True)

    user = relationship("User", back_populates="profilo_amministrazione")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    model: Mapped[str] = mapped_column(String(80))
    type: Mapped[str] = mapped_column(String(20))           # scooter | bike | ebike | car
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    battery_pct: Mapped[int] = mapped_column(Integer, default=100)
    status: Mapped[str] = mapped_column(String(20), default="available")  # available | in_use | maintenance
    unlock_fee: Mapped[float] = mapped_column(Float, default=1.0)
    price_per_min: Mapped[float] = mapped_column(Float, default=0.22)
    # [V] Blocco remoto del mezzo da parte dell'operatore (OP.09): se True non prenotabile.
    locked: Mapped[bool] = mapped_column(Boolean, default=False)


class ParkingArea(Base):
    """Area di sosta autorizzata dove rilasciare il mezzo a fine corsa (CU-02 / end-ride)."""
    __tablename__ = "parking_areas"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[str] = mapped_column(String(160), default="")
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    radius_m: Mapped[int] = mapped_column(Integer, default=60)   # raggio area consentita
    capacity: Mapped[int] = mapped_column(Integer, default=20)    # posti totali
    occupied: Mapped[int] = mapped_column(Integer, default=0)     # posti occupati


class Ride(Base):
    __tablename__ = "rides"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id"), nullable=True)
    vehicle_type: Mapped[str] = mapped_column(String(20), default="scooter")
    from_addr: Mapped[str] = mapped_column(String(160), default="")
    to_addr: Mapped[str] = mapped_column(String(160), default="")
    km: Mapped[float] = mapped_column(Float, default=0.0)
    minutes: Mapped[int] = mapped_column(Integer, default=0)
    cost: Mapped[float] = mapped_column(Float, default=0.0)
    points: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="completed")  # active | paused | completed
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    orario_inizio_pausa: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pausa_secondi_accumulati: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    user = relationship("User", back_populates="rides")


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | cancelled | used


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String(20))   # charge | refund | topup
    label: Mapped[str] = mapped_column(String(160))
    amount: Mapped[float] = mapped_column(Float)     # negativo per addebiti
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user = relationship("User", back_populates="transactions")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(20))    # card | apple | paypal
    label: Mapped[str] = mapped_column(String(80))
    last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    user = relationship("User", back_populates="payment_methods")


class Promotion(Base):
    __tablename__ = "promotions"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text, default="")
    reward: Mapped[str] = mapped_column(String(60), default="")
    icon: Mapped[str] = mapped_column(String(60), default="gift-outline")
    color: Mapped[str] = mapped_column(String(20), default="#A78BFA")
    kind: Mapped[str] = mapped_column(String(20), default="offer")  # offer | active
    expiry: Mapped[str | None] = mapped_column(String(60), nullable=True)
    used: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String(20))   # promo | ride | alert | system
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text, default="")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user = relationship("User", back_populates="messages")


class Segnalazione(Base):
    """[INF, deciso] Evoluzione di Report → entità di dominio Segnalazione (CU-11/27/30).
    Consolida le segnalazioni utente e operative con GPS, gravità, stato e tipo."""
    __tablename__ = "segnalazioni"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # FK alla corsa correlata (la segnalazione nasce spesso durante/dopo una corsa).
    ride_id: Mapped[int | None] = mapped_column(ForeignKey("rides.id"), nullable=True)

    # Campi storici (retro-compatibilità con la View mobile /reports).
    category: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(Text, default="")

    # Nuovi campi di dominio.
    tipo: Mapped[str] = mapped_column(String(40), default="ALTRO")     # MALFUNZIONAMENTO | OSTACOLO | PERCORSO | ALTRO
    gravita: Mapped[str] = mapped_column(String(10), default="MEDIA")  # BASSA | MEDIA | ALTA
    stato: Mapped[str] = mapped_column(String(10), default="APERTA")   # APERTA | CHIUSA
    gps_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="segnalazioni")


class AreaRestrizione(Base):
    """[INF] Zona geografica con regole di transito/parcheggio (AP.04 / GestioneRestrizioni).
    Geometria a cerchio (lat/lng/raggio) per coerenza con ComponenteMappa e parcheggi."""
    __tablename__ = "aree_restrizione"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    tipo: Mapped[str] = mapped_column(String(20), default="NO_GO")  # NO_GO | NO_PARKING | ZTL | PEDONALE | LIMITE_VELOCITA
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    radius_m: Mapped[int] = mapped_column(Integer, default=120)
    # Tipi di mezzo a cui si applica la restrizione (lista JSON; vuota = tutti).
    vehicle_types: Mapped[list] = mapped_column(JSON, default=list)
    # Finestra oraria opzionale (es. "08:00-20:00"); vuota = sempre attiva.
    orario: Mapped[str | None] = mapped_column(String(40), nullable=True)
    attiva: Mapped[bool] = mapped_column(Boolean, default=True)
    note: Mapped[str] = mapped_column(Text, default="")

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
