"""GestioneRestrizioni — aree di restrizione geografica (AP.04).
Lettura aperta a operatore/amministrazione; scrittura solo Amministrazione."""
import json
import math
import urllib.parse
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import AreaRestrizione, User
from ..schemas import AreaRestrizioneConfiguraIn, AreaRestrizioneIn, AreaRestrizioneOut, AreaRestrizioneUpdate

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
def list_aree(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Lettura aperta a qualsiasi utente autenticato: le zone di restrizione sono
    # informazioni pubbliche (mostrate sulla mappa utente come le aree di sosta).
    return db.query(AreaRestrizione).order_by(AreaRestrizione.id).all()


@router.get("/verifica")
def verifica_posizione(
    lat: float = Query(...),
    lng: float = Query(...),
    vehicle_type: str | None = Query(default=None),
    _: User = Depends(get_current_user),
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


def _geocode_first(address: str) -> tuple[float, float] | None:
    """Nominatim OSM: restituisce (lat, lng) del primo risultato, o None."""
    url = (
        "https://nominatim.openstreetmap.org/search?"
        + urllib.parse.urlencode({"q": address, "format": "json", "limit": 1})
    )
    req = urllib.request.Request(url, headers={"User-Agent": "SmartMobilityApp/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            results = json.loads(resp.read())
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception:
        pass
    return None


@router.post("/configura", response_model=AreaRestrizioneOut, status_code=status.HTTP_201_CREATED)
def configura_area(
    data: AreaRestrizioneConfiguraIn,
    user: User = Depends(_admin),
    db: Session = Depends(get_db),
):
    """UC-21 — Configura un'area di restrizione.

    Se l'amministrazione ha già scelto il punto sulla mappa (lat/lng presenti)
    si usano quelle coordinate; altrimenti si geocodifica l'indirizzo.
    """
    if data.lat is not None and data.lng is not None:
        lat, lng = data.lat, data.lng
    else:
        coords = _geocode_first(data.indirizzo)
        if coords is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Indirizzo non trovato: verifica l'indirizzo e riprova",
            )
        lat, lng = coords
    area = AreaRestrizione(
        nome=data.indirizzo[:120],
        tipo=data.tipo,
        lat=lat,
        lng=lng,
        radius_m=data.radius_m,
        vehicle_types=data.vehicle_types,
        note=data.note,
        valida_dal=data.valida_dal,
        valida_al=data.valida_al,
        attiva=True,
        created_by=user.id,
    )
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


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
