"""GestioneOperatore — funzionalità operative (user story OP.01–OP.09).
Tutte le route richiedono ruolo OPERATORE. Il Controller coordina il Model."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_role
from ..models import AzioneOperatoreLog, Message, ParkingArea, Ride, Segnalazione, User, Vehicle
from ..schemas import (
    AccountStatusIn, SegnalazioneOut, UserAdminOut, VehicleLockIn, VehicleOut,
)

router = APIRouter(prefix="/operatore", tags=["operatore"], dependencies=[Depends(require_role("OPERATORE"))])

# Soglie OP.02 (densità mezzi per area). // [DA VERIFICARE] valori soglia col team.
SOGLIA_BASSA = 3   # sotto → area a bassa disponibilità (serve redistribuzione)
SOGLIA_ALTA = 12   # sopra → area in sovrannumero
# OP.07 — utenti virtuosi: corse completate consecutive senza segnalazioni ALTA.
BONUS_SOGLIA_CORSE = 5
BONUS_PUNTI = 50


_GRAVITA_ORD = {"ALTA": 0, "MEDIA": 1, "BASSA": 2}


@router.get("/segnalazioni", response_model=list[SegnalazioneOut])
def segnalazioni_mezzi(db: Session = Depends(get_db)):
    """OP.03 — Dashboard malfunzionamenti: segnalazioni APERTE escluse quelle
    di tipo PERCORSO (manutenzioni urbane create dall'Amministrazione Pubblica).
    Il filtro è imposto lato backend — il frontend non può modificarlo."""
    items = (
        db.query(Segnalazione)
        .filter(Segnalazione.stato == "APERTA", Segnalazione.tipo == "MALFUNZIONAMENTO")
        .all()
    )
    items.sort(key=lambda s: (_GRAVITA_ORD.get(s.gravita, 1), -s.id))
    return items


@router.get("/flotta", response_model=list[VehicleOut])
def flotta(db: Session = Depends(get_db)):
    """Stato completo della flotta (posizione, batteria, stato, blocco)."""
    return db.query(Vehicle).order_by(Vehicle.id).all()


@router.get("/mezzi-rilascio", response_model=list[VehicleOut])
def mezzi_rilascio(db: Session = Depends(get_db)):
    """OP.04 — Posizione dei mezzi a fine corsa (mezzi liberi sulla mappa)."""
    return (
        db.query(Vehicle)
        .filter(Vehicle.status == "parked", Vehicle.locked == False)  # noqa: E712
        .order_by(Vehicle.id)
        .all()
    )


@router.get("/aree-densita")
def aree_densita(db: Session = Depends(get_db)):
    """OP.02 — Densità mezzi disponibili per area di sosta, con livello di disponibilità."""
    vehicles = db.query(Vehicle).filter(Vehicle.status == "parked", Vehicle.locked == False).all()  # noqa: E712
    aree = db.query(ParkingArea).all()
    out = []
    for a in aree:
        # Mezzi entro il raggio dell'area (approssimazione su gradi, adeguata per la demo).
        deg = a.radius_m / 111000.0
        count = sum(1 for v in vehicles if abs(v.lat - a.lat) < deg and abs(v.lng - a.lng) < deg)
        livello = "BASSA" if count < SOGLIA_BASSA else "ALTA" if count > SOGLIA_ALTA else "OK"
        out.append({
            "area_id": a.id, "nome": a.name, "lat": a.lat, "lng": a.lng,
            "mezzi": count, "capienza": a.capacity, "livello": livello,
        })
    return out


@router.get("/utenti", response_model=list[UserAdminOut])
def lista_utenti(db: Session = Depends(get_db)):
    """Elenco utenti finali per la gestione (OP.08)."""
    return db.query(User).filter(User.role == "UTENTE").order_by(User.id).all()


@router.post("/utenti/{user_id}/stato", response_model=UserAdminOut)
def cambia_stato_utente(
    user_id: int,
    data: AccountStatusIn,
    operatore: User = Depends(require_role("OPERATORE")),
    db: Session = Depends(get_db),
):
    """OP.08 — Sospensione/blocco/riattivazione di un account utente."""
    if data.account_status not in ("ATTIVO", "SOSPESO", "BLOCCATO"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Stato non valido")
    target = db.get(User, user_id)
    if not target or target.role != "UTENTE":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utente non trovato")

    vecchio_stato = target.account_status
    target.account_status = data.account_status

    # Log audit
    db.add(AzioneOperatoreLog(
        operatore_id=operatore.id,
        utente_id=target.id,
        azione="CAMBIO_STATO_ACCOUNT",
        motivo=data.motivo,
        dettaglio=f"{vecchio_stato} → {data.account_status}",
    ))

    # Notifica in-app all'utente (solo se lo stato cambia effettivamente)
    if data.account_status != vecchio_stato:
        if data.account_status == "SOSPESO":
            titolo = "Account sospeso"
            corpo = f"Il tuo account è stato sospeso temporaneamente. Motivo: {data.motivo}"
        elif data.account_status == "BLOCCATO":
            titolo = "Account bloccato"
            corpo = f"Il tuo account è stato bloccato definitivamente. Motivo: {data.motivo}"
        else:  # ATTIVO
            titolo = "Account riattivato"
            corpo = "Il tuo account è stato riattivato. Puoi tornare a usare il servizio."
        db.add(Message(user_id=target.id, type="alert", title=titolo, body=corpo))

    db.commit()
    db.refresh(target)
    return target


@router.post("/mezzi/{vehicle_id}/blocco", response_model=VehicleOut)
def blocco_remoto(
    vehicle_id: int,
    data: VehicleLockIn,
    operatore: User = Depends(require_role("OPERATORE")),
    db: Session = Depends(get_db),
):
    """OP.09 — Blocco/sblocco remoto di un mezzo, anche durante una corsa attiva."""
    v = db.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mezzo non trovato")

    ride_interrotta_id: int | None = None

    if data.locked:
        # Interrompi la corsa attiva sul mezzo (se esiste), invece di rifiutare il blocco.
        corsa_attiva = (
            db.query(Ride)
            .filter(Ride.vehicle_id == vehicle_id, Ride.status.in_(["active", "paused"]))
            .first()
        )
        if corsa_attiva:
            corsa_attiva.status = "interrupted"
            corsa_attiva.ended_at = datetime.now(timezone.utc)
            ride_interrotta_id = corsa_attiva.id
            db.add(Message(
                user_id=corsa_attiva.user_id,
                type="alert",
                title="Corsa interrotta",
                body=(
                    "La tua corsa è stata interrotta perché il mezzo è stato bloccato "
                    "dall'operatore per motivi di sicurezza. Contatta l'assistenza per informazioni."
                ),
            ))

        v.locked = True
        v.status = "parked"  # rimane in area ma non prelevabile (locked=True lo blocca)
        azione = "BLOCCO_REMOTO_MEZZO"
        dettaglio = f"vehicle_id={vehicle_id}"
        if ride_interrotta_id:
            dettaglio += f", ride_id={ride_interrotta_id} interrotta"
    else:
        # Sblocco: il mezzo torna parcheggiato e prelevabile dagli utenti.
        v.locked = False
        v.status = "parked"
        azione = "SBLOCCO_REMOTO_MEZZO"
        dettaglio = f"vehicle_id={vehicle_id}"

    db.add(AzioneOperatoreLog(
        operatore_id=operatore.id,
        utente_id=None,
        azione=azione,
        motivo="",
        dettaglio=dettaglio,
    ))

    db.commit()
    db.refresh(v)
    return v


@router.post("/bonus")
def assegna_bonus(db: Session = Depends(get_db)):
    """OP.07 — Assegnazione automatica bonus agli utenti virtuosi."""
    premiati = []
    for u in db.query(User).filter(User.role == "UTENTE", User.account_status == "ATTIVO").all():
        corse = db.query(Ride).filter(Ride.user_id == u.id, Ride.status == "completed").count()
        if corse >= BONUS_SOGLIA_CORSE:
            u.points += BONUS_PUNTI
            db.add(Message(
                user_id=u.id, type="promo", title="🎁 Bonus fedeltà",
                body=f"Complimenti! Hai ricevuto {BONUS_PUNTI} punti bonus per le tue corse corrette.",
            ))
            premiati.append(u.id)
    db.commit()
    return {"premiati": premiati, "punti_assegnati": BONUS_PUNTI}
