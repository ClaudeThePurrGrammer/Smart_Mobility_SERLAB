"""Aree di sosta autorizzate per il rilascio del mezzo a fine corsa."""
import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ParkingArea
from ..schemas import ParkingAreaOut

router = APIRouter(prefix="/parking", tags=["parking"])


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distanza in km tra due coordinate (formula haversine)."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


@router.get("", response_model=list[ParkingAreaOut])
def list_parking(
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    radius_km: float = Query(default=5.0, ge=0.5, le=50.0),
    db: Session = Depends(get_db),
):
    """Elenco delle aree di sosta.

    Se passate lat/lng, restituisce SOLO le aree entro radius_km (default 5 km)
    ordinate per vicinanza. Senza lat/lng restituisce tutte le aree.
    """
    areas = db.query(ParkingArea).all()
    if lat is not None and lng is not None:
        areas = [a for a in areas if _haversine_km(lat, lng, a.lat, a.lng) <= radius_km]
        areas.sort(key=lambda a: _haversine_km(lat, lng, a.lat, a.lng))
    return areas
