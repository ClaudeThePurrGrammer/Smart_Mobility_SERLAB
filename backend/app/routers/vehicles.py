"""Mezzi disponibili sulla mappa (CU-02)."""
import random

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Vehicle
from ..schemas import VehicleOut

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

# Ampiezza del drift GPS simulato ad ogni refresh (~10 m).
_DRIFT = 0.0001
SUPPORTED_VEHICLE_TYPES = ("scooter", "ebike", "car")


@router.get("", response_model=list[VehicleOut])
def list_vehicles(
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    only_available: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    q = db.query(Vehicle).filter(Vehicle.type.in_(SUPPORTED_VEHICLE_TYPES))
    if only_available:
        q = q.filter(Vehicle.status == "available")
    vehicles = q.order_by(Vehicle.id).all()

    changed = False

    if lat is not None and lng is not None:
        available_vehicles = [v for v in vehicles if v.status == "available"]
        # Garantiamo SEMPRE almeno 8 mezzi nelle immediate vicinanze dell'utente.
        # Soglia ~1 km (0.011°): i mezzi già vicini contano, gli altri vengono
        # spostati casualmente entro ~900 m. Avviene una sola volta: ai poll
        # successivi risultano già "nearby" e non saltano (resta solo il drift).
        NEAR = 0.011
        nearby = [v for v in available_vehicles if ((v.lat - lat)**2 + (v.lng - lng)**2)**0.5 < NEAR]
        if len(nearby) < 8 and available_vehicles:
            far = [v for v in available_vehicles if v not in nearby]
            random.shuffle(far)
            for v in far[: 8 - len(nearby)]:
                v.lat = round(lat + random.uniform(-0.008, 0.008), 6)
                v.lng = round(lng + random.uniform(-0.008, 0.008), 6)
            changed = True

    # Simula il movimento in tempo reale della flotta: piccolo jitter sui mezzi liberi.
    for v in vehicles:
        if v.status == "available":
            v.lat = round(v.lat + random.uniform(-_DRIFT, _DRIFT), 6)
            v.lng = round(v.lng + random.uniform(-_DRIFT, _DRIFT), 6)
            changed = True

    if changed:
        db.commit()

    return vehicles


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    v = db.get(Vehicle, vehicle_id)
    if not v or v.type not in SUPPORTED_VEHICLE_TYPES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mezzo non trovato")
    return v
