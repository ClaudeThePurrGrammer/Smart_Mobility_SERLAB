"""Aree di sosta autorizzate per il rilascio del mezzo a fine corsa."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ParkingArea
from ..schemas import ParkingAreaOut

router = APIRouter(prefix="/parking", tags=["parking"])


@router.get("", response_model=list[ParkingAreaOut])
def list_parking(
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Elenco delle aree di sosta; se passate lat/lng, ordina per vicinanza all'utente."""
    areas = db.query(ParkingArea).all()
    if lat is not None and lng is not None:
        areas.sort(key=lambda a: (a.lat - lat) ** 2 + (a.lng - lng) ** 2)
    return areas
