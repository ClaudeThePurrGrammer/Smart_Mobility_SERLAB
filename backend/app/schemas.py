"""Schemi Pydantic — contratto REST View_to_Controller (HTTPS/JSON)."""
import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


# ─── Auth ───────────────────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    name: str
    surname: str = ""
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str | None = None
    # [V] Ruolo scelto in registrazione (UTENTE | OPERATORE | AMMINISTRAZIONE).
    role: str = "UTENTE"
    # Campi profilo specifici per ruolo (opzionali).
    ente_appartenenza: str | None = None   # AMMINISTRAZIONE
    zona_competenza: str | None = None      # OPERATORE
    # [V] Codice placeholder 5 cifre — obbligatorio per OPERATORE/AMMINISTRAZIONE.
    codice_attivazione: str | None = None

    @model_validator(mode="after")
    def _check_codice_attivazione(self) -> "RegisterIn":
        if self.role in ("OPERATORE", "AMMINISTRAZIONE"):
            if not self.codice_attivazione or not re.fullmatch(r"\d{5}", self.codice_attivazione):
                raise ValueError("Il codice di attivazione deve essere di esattamente 5 cifre numeriche")
        return self


class LoginIn(BaseModel):
    email: EmailStr
    password: str





class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    surname: str
    email: EmailStr
    phone: str | None
    provider: str
    points: int
    balance: float
    notifications_enabled: bool
    role: str
    account_status: str
    created_at: datetime


class UserUpdate(BaseModel):
    name: str | None = None
    surname: str | None = None
    phone: str | None = None
    notifications_enabled: bool | None = None


class UserSelfUpdate(BaseModel):
    """Aggiornamenti del proprio profilo dalla View mobile (es. riscatto punti)."""
    points: int | None = None
    name: str | None = None
    surname: str | None = None
    phone: str | None = None
    notifications_enabled: bool | None = None


# ─── Vehicles ───────────────────────────────────────────────────────────────
class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    model: str
    type: str
    lat: float
    lng: float
    battery_pct: int
    status: str
    unlock_fee: float
    price_per_min: float
    locked: bool = False


# ─── Parking areas ──────────────────────────────────────────────────────────
class ParkingAreaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    address: str
    lat: float
    lng: float
    radius_m: int
    capacity: int
    occupied: int


# ─── Rides ──────────────────────────────────────────────────────────────────
class RideCreate(BaseModel):
    vehicle_id: int | None = None
    vehicle_type: str = "scooter"
    from_addr: str = ""
    to_addr: str = ""


class RideEnd(BaseModel):
    km: float = 0.0
    minutes: int = 0


class RideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vehicle_id: int | None
    vehicle_type: str
    from_addr: str
    to_addr: str
    km: float
    minutes: int
    cost: float
    points: int
    status: str
    started_at: datetime
    ended_at: datetime | None


# ─── Wallet ─────────────────────────────────────────────────────────────────
class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    type: str
    label: str
    amount: float
    created_at: datetime


class TopUpIn(BaseModel):
    amount: float = Field(gt=0)


class WalletOut(BaseModel):
    balance: float
    transactions: list[TransactionOut]


# ─── Payment methods ────────────────────────────────────────────────────────
class PaymentMethodIn(BaseModel):
    kind: str            # card | apple | paypal
    label: str
    last4: str | None = None
    is_default: bool = False


class PaymentMethodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kind: str
    label: str
    last4: str | None
    is_default: bool


# ─── Promotions ─────────────────────────────────────────────────────────────
class PromotionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str | None
    title: str
    body: str
    reward: str
    icon: str
    color: str
    kind: str
    expiry: str | None
    used: int
    total: int


class PromotionRedeem(BaseModel):
    code: str


# ─── Messages ───────────────────────────────────────────────────────────────
class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    type: str
    title: str
    body: str
    read: bool
    created_at: datetime


class MessageCreate(BaseModel):
    type: str = "system"
    title: str
    body: str


# ─── Geo (geocoding / routing) ──────────────────────────────────────────────
class GeocodeResult(BaseModel):
    label: str
    lat: float
    lng: float


class RoutePoint(BaseModel):
    latitude: float
    longitude: float


class RouteOption(BaseModel):
    """Un'alternativa di percorso per un tipo di mezzo, valutata sui vincoli geografici."""
    points: list[RoutePoint]
    distance_m: float
    duration_min: int
    restricted: bool                 # attraversa almeno un'area vietata al transito
    aree_vietate: list[str]          # nomi delle aree di restrizione attraversate
    label: str                       # es. "Percorso consigliato" / "Alternativa"


# ─── Preferenze utente ──────────────────────────────────────────────────────
class PreferencesIn(BaseModel):
    notif_ride: bool | None = None
    notif_promo: bool | None = None
    notif_system: bool | None = None
    location_bg: bool | None = None
    biometric: bool | None = None


class PreferencesOut(BaseModel):
    notif_ride: bool = True
    notif_promo: bool = True
    notif_system: bool = False
    location_bg: bool = True
    biometric: bool = False


# ─── Segnalazioni (ex Report) ─────────────────────────────────────────────────
class ReportIn(BaseModel):
    """Input dalla View mobile (retro-compatibile)."""
    category: str
    description: str = ""
    tipo: str = "ALTRO"
    gravita: str = "MEDIA"
    ride_id: int | None = None
    gps_lat: float | None = None
    gps_lng: float | None = None


class ReportOut(BaseModel):
    """Output retro-compatibile per la View mobile: `status` ⇐ `stato`."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    category: str
    description: str
    status: str = Field(validation_alias="stato")
    created_at: datetime


class SegnalazioneOut(BaseModel):
    """Output completo per le dashboard Operatore/Amministrazione."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    ride_id: int | None
    category: str
    description: str
    tipo: str
    gravita: str
    stato: str
    gps_lat: float | None
    gps_lng: float | None
    zona: str | None = None
    created_at: datetime
    closed_at: datetime | None


# ─── Segnala Zona (UC-19) ────────────────────────────────────────────────────
class SegnalazioneZonaIn(BaseModel):
    zona: str = Field(min_length=3, max_length=200)
    descrizione: str = Field(default="", max_length=1000)
    valida_dal: date
    valida_al: date
    gps_lat: float | None = None
    gps_lng: float | None = None
    gravita: str = Field(default="MEDIA")

    @model_validator(mode="after")
    def _check_period(self) -> "SegnalazioneZonaIn":
        if self.valida_al < self.valida_dal:
            raise ValueError("La data di fine deve essere uguale o successiva alla data di inizio")
        if self.gravita not in {"BASSA", "MEDIA", "ALTA"}:
            raise ValueError("Gravità non valida. Valori ammessi: BASSA, MEDIA, ALTA")
        return self


class SegnalazioneZonaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    zona: str | None
    descrizione: str
    valida_dal: date | None
    valida_al: date | None
    gps_lat: float | None
    gps_lng: float | None
    created_at: datetime


# ─── Aree di restrizione ──────────────────────────────────────────────────────
_TIPI_RESTRIZIONE = {"NO_GO", "NO_PARKING", "ZTL", "PEDONALE", "LIMITE_VELOCITA"}
_VEICOLI_VALIDI   = {"scooter", "bike", "ebike", "car"}


class AreaRestrizioneIn(BaseModel):
    nome: str
    tipo: str = "NO_GO"
    lat: float
    lng: float
    radius_m: int = 120
    vehicle_types: list[str] = []
    orario: str | None = None
    attiva: bool = True
    note: str = ""


class AreaRestrizioneConfiguraIn(BaseModel):
    """Input UC-21: indirizzo da geocodificare → area a cerchio con periodo di validità."""
    indirizzo: str = Field(min_length=3, max_length=200)
    radius_m: int = Field(default=100, ge=1, le=50000)
    tipo: str = "NO_GO"
    vehicle_types: list[str] = Field(default_factory=list)
    note: str = Field(default="", max_length=1000)
    valida_dal: date | None = None
    valida_al: date | None = None

    @model_validator(mode="after")
    def _validate(self) -> "AreaRestrizioneConfiguraIn":
        if self.tipo not in _TIPI_RESTRIZIONE:
            raise ValueError(
                f"Tipo non valido. Valori ammessi: {', '.join(sorted(_TIPI_RESTRIZIONE))}"
            )
        if not self.vehicle_types:
            raise ValueError("Selezionare almeno una tipologia di mezzo")
        invalid = [v for v in self.vehicle_types if v not in _VEICOLI_VALIDI]
        if invalid:
            raise ValueError(f"Tipologie non valide: {', '.join(invalid)}")
        if self.valida_dal and self.valida_al and self.valida_al < self.valida_dal:
            raise ValueError("La data di fine deve essere uguale o successiva alla data di inizio")
        return self


class AreaRestrizioneUpdate(BaseModel):
    nome: str | None = None
    tipo: str | None = None
    lat: float | None = None
    lng: float | None = None
    radius_m: int | None = None
    vehicle_types: list[str] | None = None
    orario: str | None = None
    attiva: bool | None = None
    note: str | None = None


class AreaRestrizioneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nome: str
    tipo: str
    lat: float
    lng: float
    radius_m: int
    vehicle_types: list[str]
    orario: str | None
    attiva: bool
    note: str
    valida_dal: date | None = None
    valida_al: date | None = None


# ─── Azioni Operatore ─────────────────────────────────────────────────────────
class AccountStatusIn(BaseModel):
    account_status: str  # ATTIVO | SOSPESO | BLOCCATO
    motivo: str          # motivazione obbligatoria per il log e la notifica all'utente


class VehicleLockIn(BaseModel):
    locked: bool


class UserAdminOut(BaseModel):
    """Vista utente per la gestione operativa (OP.08)."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    surname: str
    email: EmailStr
    role: str
    account_status: str
    points: int
    created_at: datetime
