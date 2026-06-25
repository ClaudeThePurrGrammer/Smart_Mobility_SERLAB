"""GestioneOperatore — funzionalità operative (user story OP.01–OP.09).
Tutte le route richiedono ruolo OPERATORE. Il Controller coordina il Model."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_role
from ..models import Message, ParkingArea, Ride, User, Vehicle
from ..schemas import (
    AccountStatusIn, UserAdminOut, VehicleLockIn, VehicleOut,
)

router = APIRouter(prefix="/operatore", tags=["operatore"], dependencies=[Depends(require_role("OPERATORE"))])

# Soglie OP.02 (densità mezzi per area). // [DA VERIFICARE] valori soglia col team.
SOGLIA_BASSA = 3   # sotto → area a bassa disponibilità (serve redistribuzione)
SOGLIA_ALTA = 12   # sopra → area in sovrannumero
# OP.07 — utenti virtuosi: corse completate consecutive senza segnalazioni ALTA.
BONUS_SOGLIA_CORSE = 5
BONUS_PUNTI = 50


@router.get("/flotta", response_model=list[VehicleOut])
def flotta(db: Session = Depends(get_db)):
    """Stato completo della flotta (posizione, batteria, stato, blocco)."""
    return db.query(Vehicle).order_by(Vehicle.id).all()


@router.get("/mezzi-rilascio", response_model=list[VehicleOut])
def mezzi_rilascio(db: Session = Depends(get_db)):
    """OP.04 — Posizione dei mezzi a fine corsa (mezzi liberi sulla mappa)."""
    return db.query(Vehicle).filter(Vehicle.status == "available").order_by(Vehicle.id).all()


@router.get("/aree-densita")
def aree_densita(db: Session = Depends(get_db)):
    """OP.02 — Densità mezzi disponibili per area di sosta, con livello di disponibilità."""
    vehicles = db.query(Vehicle).filter(Vehicle.status == "available").all()
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
def cambia_stato_utente(user_id: int, data: AccountStatusIn, db: Session = Depends(get_db)):
    """OP.08 — Sospensione/blocco/riattivazione di un account utente."""
    if data.account_status not in ("ATTIVO", "SOSPESO", "BLOCCATO"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Stato non valido")
    target = db.get(User, user_id)
    if not target or target.role != "UTENTE":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utente non trovato")
    target.account_status = data.account_status
    db.commit()
    db.refresh(target)
    return target


@router.post("/mezzi/{vehicle_id}/blocco", response_model=VehicleOut)
def blocco_remoto(vehicle_id: int, data: VehicleLockIn, db: Session = Depends(get_db)):
    """OP.09 — Blocco/sblocco remoto di un mezzo non in uso."""
    v = db.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mezzo non trovato")
    if data.locked and v.status == "in_use":
        raise HTTPException(status.HTTP_409_CONFLICT, "Impossibile bloccare un mezzo in uso")
    v.locked = data.locked
    v.status = "maintenance" if data.locked else "available"
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
