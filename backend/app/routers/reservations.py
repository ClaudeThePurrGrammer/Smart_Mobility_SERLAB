"""Prenotazioni: prenota un mezzo per 10 minuti, poi avvia la corsa."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Reservation, Ride, User, Vehicle

router = APIRouter(prefix="/prenotazioni", tags=["prenotazioni"])
RESERVATION_DURATION = timedelta(minutes=10)


class ReservationCreate(BaseModel):
    id_mezzo: int


def _to_dict(r: Reservation, vehicle: Vehicle | None) -> dict:
    return {
        "id": r.id,
        "id_mezzo": r.vehicle_id,
        "ora_creazione": r.created_at.isoformat(),
        "ora_scadenza": r.expires_at.isoformat(),
        "stato": r.status,
        "mezzo": {
            "id": vehicle.id,
            "nome": vehicle.name,
            "modello": vehicle.model,
            "tipo": vehicle.type,
            "livello_carica": vehicle.battery_pct,
            "posizione_gps": {"lat": vehicle.lat, "lng": vehicle.lng},
        } if vehicle else None,
    }


@router.get("/attiva")
def get_active(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Restituisce la prenotazione attiva o null (200 in entrambi i casi)."""
    now = datetime.now(timezone.utc)
    res = (
        db.query(Reservation)
        .filter(
            Reservation.user_id == user.id,
            Reservation.status == "active",
            Reservation.expires_at > now,
        )
        .order_by(Reservation.created_at.desc())
        .first()
    )
    if not res:
        return None
    vehicle = db.get(Vehicle, res.vehicle_id)
    return _to_dict(res, vehicle)


@router.post("", status_code=status.HTTP_201_CREATED)
def create(body: ReservationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    existing = (
        db.query(Reservation)
        .filter(
            Reservation.user_id == user.id,
            Reservation.status == "active",
            Reservation.expires_at > now,
        )
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Hai già una prenotazione attiva.")
    vehicle = db.get(Vehicle, body.id_mezzo)
    if not vehicle:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mezzo non trovato.")
    if vehicle.status != "available":
        # Se il mezzo è in_use ma non esiste una corsa attiva che lo usa,
        # si tratta di uno stato orfano (es. crash o ride non chiusa correttamente).
        # Lo resettiamo automaticamente anziché bloccare la prenotazione.
        active_ride = (
            db.query(Ride)
            .filter(Ride.vehicle_id == body.id_mezzo, Ride.status.in_(("active", "paused")))
            .first()
        )
        if active_ride:
            raise HTTPException(status.HTTP_409_CONFLICT, "Il mezzo è in uso da un altro utente.")
        # Reset stato orfano
        vehicle.status = "available"
        db.commit()
    res = Reservation(
        user_id=user.id,
        vehicle_id=body.id_mezzo,
        expires_at=now + RESERVATION_DURATION,
    )
    db.add(res)
    db.commit()
    db.refresh(res)
    return _to_dict(res, vehicle)


@router.delete("/{res_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel(res_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    res = db.get(Reservation, res_id)
    if not res or res.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prenotazione non trovata.")
    res.status = "cancelled"
    db.commit()
