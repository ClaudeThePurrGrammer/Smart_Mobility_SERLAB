"""Corse: avvio, fine e storico. Aggiorna saldo, punti e transazioni."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Message, Ride, User, Vehicle, WalletTransaction
from ..schemas import RideCreate, RideEnd, RideOut

router = APIRouter(prefix="/rides", tags=["rides"])

POINTS_PER_RIDE = 10
ECO_BONUS_KM = 2.0
ECO_BONUS_POINTS = 5
SUPPORTED_VEHICLE_TYPES = {"scooter", "ebike", "car"}


@router.get("", response_model=list[RideOut])
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Ride)
        .filter(Ride.user_id == user.id, Ride.status == "completed")
        .order_by(Ride.started_at.desc())
        .all()
    )


@router.get("/active", response_model=RideOut | None)
def active_ride(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Ride)
        .filter(Ride.user_id == user.id, Ride.status.in_(("active", "paused")))
        .order_by(Ride.started_at.desc())
        .first()
    )


@router.post("", response_model=RideOut, status_code=status.HTTP_201_CREATED)
def start_ride(data: RideCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # ── FIX: impedisce di avviare una nuova corsa se ce n'è già una in corso ──
    existing = (
        db.query(Ride)
        .filter(Ride.user_id == user.id, Ride.status.in_(("active", "paused")))
        .first()
    )
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Hai già una corsa in corso (ID {existing.id}). Termina quella precedente prima di iniziarne una nuova.",
        )

    vehicle = db.get(Vehicle, data.vehicle_id) if data.vehicle_id else None
    if vehicle:
        if vehicle.type not in SUPPORTED_VEHICLE_TYPES:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Mezzo non trovato")
        if vehicle.status != "available":
            raise HTTPException(status.HTTP_409_CONFLICT, "Mezzo non disponibile")
        vehicle.status = "in_use"
    elif data.vehicle_type not in SUPPORTED_VEHICLE_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tipo mezzo non supportato")

    ride = Ride(
        user_id=user.id,
        vehicle_id=data.vehicle_id,
        vehicle_type=vehicle.type if vehicle else data.vehicle_type,
        from_addr=data.from_addr,
        to_addr=data.to_addr,
        status="active",
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)
    return ride


@router.patch("/{ride_id}/pause", response_model=RideOut)
def toggle_pause(ride_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Alterna lo stato della corsa tra 'active' e 'paused', accumulando i secondi di pausa."""
    ride = db.get(Ride, ride_id)
    if not ride or ride.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Corsa non trovata")
    if ride.status not in ("active", "paused"):
        raise HTTPException(status.HTTP_409_CONFLICT, "La corsa non è in corso")
    now = datetime.now(timezone.utc)
    if ride.status == "active":
        ride.status = "paused"
        ride.orario_inizio_pausa = now
    else:
        if ride.orario_inizio_pausa:
            elapsed = int((now - ride.orario_inizio_pausa).total_seconds())
            ride.pausa_secondi_accumulati = (ride.pausa_secondi_accumulati or 0) + elapsed
        ride.orario_inizio_pausa = None
        ride.status = "active"
    db.commit()
    db.refresh(ride)
    return ride


@router.post("/{ride_id}/end", response_model=RideOut)
def end_ride(ride_id: int, data: RideEnd, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ride = db.get(Ride, ride_id)
    if not ride or ride.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Corsa non trovata")
    if ride.status not in ("active", "paused"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Corsa già conclusa")

    now = datetime.now(timezone.utc)

    # ── FIX CRITICO: calcola i minuti server-side da started_at ──────────────
    # Non ci fidiamo del valore inviato dal client (potrebbe essere gonfiato
    # se il timer era partito da una corsa orfana con started_at molto vecchio).
    elapsed_s = max(0.0, (now - ride.started_at).total_seconds())
    minutes = max(1, int(elapsed_s / 60))

    # km: accetta dal client se positivo e ragionevole; altrimenti stima da minuti
    km = data.km if (0 < data.km < 200) else round(minutes * 0.2, 1)

    vehicle = db.get(Vehicle, ride.vehicle_id) if ride.vehicle_id else None
    unlock = vehicle.unlock_fee if vehicle else 1.0
    per_min = vehicle.price_per_min if vehicle else 0.22
    cost = round(unlock + minutes * per_min, 2)
    points = POINTS_PER_RIDE + (ECO_BONUS_POINTS if km >= ECO_BONUS_KM else 0)

    ride.km = km
    ride.minutes = minutes
    ride.cost = cost
    ride.points = points
    ride.status = "completed"
    ride.ended_at = now

    if vehicle:
        vehicle.status = "available"

    # Addebito sul wallet + punti utente
    user.balance = round(user.balance - cost, 2)
    user.points += points
    db.add(WalletTransaction(
        user_id=user.id, type="charge",
        label=f"Corsa · {ride.from_addr or 'Partenza'} → {ride.to_addr or 'Arrivo'}",
        amount=-cost,
    ))
    db.add(Message(
        user_id=user.id, type="ride", title="Corsa terminata",
        body=f"La tua corsa di {km:.1f} km è stata completata. Costo: € {cost:.2f}.",
    ))

    db.commit()
    db.refresh(ride)
    return ride
