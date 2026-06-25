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
    vehicle = db.get(Vehicle, data.vehicle_id) if data.vehicle_id else None
    if vehicle:
        if vehicle.status != "available":
            raise HTTPException(status.HTTP_409_CONFLICT, "Mezzo non disponibile")
        vehicle.status = "in_use"

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
    """Alterna lo stato della corsa tra 'active' e 'paused'."""
    ride = db.get(Ride, ride_id)
    if not ride or ride.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Corsa non trovata")
    if ride.status not in ("active", "paused"):
        raise HTTPException(status.HTTP_409_CONFLICT, "La corsa non è in corso")
    ride.status = "paused" if ride.status == "active" else "active"
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

    vehicle = db.get(Vehicle, ride.vehicle_id) if ride.vehicle_id else None
    unlock = vehicle.unlock_fee if vehicle else 1.0
    per_min = vehicle.price_per_min if vehicle else 0.22
    cost = round(unlock + data.minutes * per_min, 2)
    points = POINTS_PER_RIDE + (ECO_BONUS_POINTS if data.km >= ECO_BONUS_KM else 0)

    ride.km = data.km
    ride.minutes = data.minutes
    ride.cost = cost
    ride.points = points
    ride.status = "completed"
    ride.ended_at = datetime.now(timezone.utc)

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
        body=f"La tua corsa di {data.km:.1f} km è stata completata. Costo: € {cost:.2f}.",
    ))

    db.commit()
    db.refresh(ride)
    return ride
