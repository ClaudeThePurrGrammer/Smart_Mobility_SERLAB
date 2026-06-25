"""GestioneRestrizioni — aree di restrizione geografica (AP.04).
Lettura aperta a operatore/amministrazione; scrittura solo Amministrazione."""
import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_role
from ..models import AreaRestrizione, User
from ..schemas import AreaRestrizioneIn, AreaRestrizioneOut, AreaRestrizioneUpdate

router = APIRouter(prefix="/aree-restrizione", tags=["restrizioni"])

_lettura = require_role("OPERATORE", "AMMINISTRAZIONE")
_admin = require_role("AMMINISTRAZIONE")


def _meters(lat1, lng1, lat2, lng2) -> float:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@router.get("", response_model=list[AreaRestrizioneOut])
def list_aree(_: User = Depends(_lettura), db: Session = Depends(get_db)):
    return db.query(AreaRestrizione).order_by(AreaRestrizione.id).all()


@router.get("/verifica")
def verifica_posizione(
    lat: float = Query(...),
    lng: float = Query(...),
    vehicle_type: str | None = Query(default=None),
    _: User = Depends(_lettura),
    db: Session = Depends(get_db),
):
    """Verifica se una posizione ricade in un'area di restrizione attiva per il tipo di mezzo."""
    hits = []
    for a in db.query(AreaRestrizione).filter(AreaRestrizione.attiva.is_(True)).all():
        if a.vehicle_types and vehicle_type and vehicle_type not in a.vehicle_types:
            continue
        if _meters(lat, lng, a.lat, a.lng) <= a.radius_m:
            hits.append({"id": a.id, "nome": a.nome, "tipo": a.tipo})
    return {"restricted": len(hits) > 0, "aree": hits}


@router.post("", response_model=AreaRestrizioneOut, status_code=status.HTTP_201_CREATED)
def crea_area(data: AreaRestrizioneIn, user: User = Depends(_admin), db: Session = Depends(get_db)):
    """AP.04 — Configurazione di una nuova area con restrizioni."""
    area = AreaRestrizione(**data.model_dump(), created_by=user.id)
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.patch("/{area_id}", response_model=AreaRestrizioneOut)
def aggiorna_area(area_id: int, data: AreaRestrizioneUpdate, _: User = Depends(_admin), db: Session = Depends(get_db)):
    area = db.get(AreaRestrizione, area_id)
    if not area:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Area non trovata")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(area, field, value)
    db.commit()
    db.refresh(area)
    return area


@router.delete("/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def elimina_area(area_id: int, _: User = Depends(_admin), db: Session = Depends(get_db)):
    area = db.get(AreaRestrizione, area_id)
    if not area:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Area non trovata")
    db.delete(area)
    db.commit()
