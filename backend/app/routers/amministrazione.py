"""GestioneAmministrazione — statistiche e report aggregati (AP.01–AP.05).
Tutte le route richiedono ruolo AMMINISTRAZIONE. Dati anonimi e aggregati (GDPR)."""
import json
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Ride, Segnalazione, User, Vehicle
from ..schemas import SegnalazioneZonaIn, SegnalazioneZonaOut

router = APIRouter(
    prefix="/amministrazione", tags=["amministrazione"],
    dependencies=[Depends(require_role("AMMINISTRAZIONE"))],
)


@router.get("/statistiche/utilizzo")
def utilizzo_per_tipo(db: Session = Depends(get_db)):
    """AP.01 — Frequenza di utilizzo per tipologia di mezzo (corse, km, minuti)."""
    rows = (
        db.query(
            Ride.vehicle_type,
            func.count(Ride.id),
            func.coalesce(func.sum(Ride.km), 0.0),
            func.coalesce(func.sum(Ride.minutes), 0),
        )
        .filter(Ride.status == "completed")
        .group_by(Ride.vehicle_type)
        .all()
    )
    return [
        {"tipo": t, "corse": n, "km_totali": round(float(km), 1), "minuti_totali": int(mins)}
        for t, n, km, mins in rows
    ]


@router.get("/statistiche/tratte")
def tratte_piu_usate(limit: int = Query(default=10, ge=1, le=50), db: Session = Depends(get_db)):
    """AP.03 — Tratte (partenza→arrivo) più utilizzate per pianificare la manutenzione."""
    rides = db.query(Ride.from_addr, Ride.to_addr).filter(Ride.status == "completed").all()
    counter = Counter(
        (f or "—", t or "—") for f, t in rides
    )
    return [
        {"from_addr": f, "to_addr": t, "corse": n}
        for (f, t), n in counter.most_common(limit)
    ]


@router.get("/statistiche/zone-critiche")
def zone_critiche(db: Session = Depends(get_db)):
    """AP.02 — Zone critiche: cluster di segnalazioni georeferenziate aperte."""
    segn = (
        db.query(Segnalazione)
        .filter(Segnalazione.gps_lat.isnot(None), Segnalazione.gps_lng.isnot(None))
        .all()
    )
    return [
        {
            "id": s.id, "tipo": s.tipo, "gravita": s.gravita, "stato": s.stato,
            "lat": s.gps_lat, "lng": s.gps_lng, "descrizione": s.description,
        }
        for s in segn
    ]


_VEHICLE_TYPES = {"scooter", "bike", "ebike", "car"}


def _count_corse(
    db: Session,
    vehicle_type: str,
    dt_from: "datetime | None",
    dt_to: "datetime | None",
) -> int:
    """Conta corse completate per tipo e periodo (date già validate dal chiamante)."""
    q = db.query(func.count(Ride.id)).filter(
        Ride.vehicle_type == vehicle_type,
        Ride.status == "completed",
    )
    if dt_from is not None:
        q = q.filter(Ride.started_at >= dt_from)
    if dt_to is not None:
        q = q.filter(Ride.started_at <= dt_to)
    return q.scalar() or 0


def _top_tratte(
    db: Session,
    vehicle_type: str,
    dt_from: "datetime | None",
    dt_to: "datetime | None",
    limit: int = 3,
) -> list[dict]:
    """Top-N tratte per tipo e periodo (date già validate dal chiamante)."""
    q = db.query(
        Ride.from_addr,
        Ride.to_addr,
        func.count(Ride.id).label("corse"),
    ).filter(
        Ride.vehicle_type == vehicle_type,
        Ride.status == "completed",
    )
    if dt_from is not None:
        q = q.filter(Ride.started_at >= dt_from)
    if dt_to is not None:
        q = q.filter(Ride.started_at <= dt_to)
    rows = (
        q.group_by(Ride.from_addr, Ride.to_addr)
        .order_by(func.count(Ride.id).desc())
        .limit(limit)
        .all()
    )
    return [{"from_addr": f or "—", "to_addr": t or "—", "corse": n} for f, t, n in rows]


@router.get("/monitoraggio/frequenza")
def monitoraggio_frequenza(
    vehicle_type: str = Query(..., description="Tipo mezzo: scooter|bike|ebike|car"),
    from_date: str | None = Query(default=None, description="ISO date inizio (YYYY-MM-DD)"),
    to_date: str | None = Query(default=None, description="ISO date fine (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """UC-18 — Frequenza di utilizzo per tipologia di mezzo in un periodo dato."""
    if vehicle_type not in _VEHICLE_TYPES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Tipo non valido. Valori ammessi: {', '.join(sorted(_VEHICLE_TYPES))}",
        )

    dt_from = dt_to = None
    if from_date:
        try:
            dt_from = datetime.fromisoformat(from_date)
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Formato data inizio non valido (atteso YYYY-MM-DD)",
            )
    if to_date:
        try:
            dt_to = datetime.fromisoformat(to_date).replace(
                hour=23, minute=59, second=59, microsecond=999999,
            )
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Formato data fine non valido (atteso YYYY-MM-DD)",
            )

    if dt_from and dt_to and dt_from > dt_to:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "La data di inizio deve essere precedente alla data di fine",
        )

    return {
        "tipo": vehicle_type,
        "da": from_date,
        "a": to_date,
        "totale_corse": _count_corse(db, vehicle_type, dt_from, dt_to),
    }


@router.get("/tratte/frequenza")
def tratte_frequenza(
    vehicle_type: str = Query(..., description="Tipo mezzo: scooter|bike|ebike|car"),
    from_date: str | None = Query(default=None, description="ISO date inizio (YYYY-MM-DD)"),
    to_date: str | None = Query(default=None, description="ISO date fine (YYYY-MM-DD)"),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """UC-20 — Tratte più utilizzate per tipologia di mezzo e periodo, ordinate per frequenza."""
    if vehicle_type not in _VEHICLE_TYPES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Tipo non valido. Valori ammessi: {', '.join(sorted(_VEHICLE_TYPES))}",
        )

    dt_from = dt_to = None
    if from_date:
        try:
            dt_from = datetime.fromisoformat(from_date)
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Formato data inizio non valido (atteso YYYY-MM-DD)",
            )
    if to_date:
        try:
            dt_to = datetime.fromisoformat(to_date).replace(
                hour=23, minute=59, second=59, microsecond=999999,
            )
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Formato data fine non valido (atteso YYYY-MM-DD)",
            )

    if dt_from and dt_to and dt_from > dt_to:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "La data di inizio deve essere precedente alla data di fine",
        )

    return _top_tratte(db, vehicle_type, dt_from, dt_to, limit)


def _geocode_first(address: str) -> tuple[float, float] | None:
    """Chiama Nominatim OSM per risolvere un indirizzo testuale in coordinate.
    Restituisce (lat, lng) del primo risultato, o None se nessun risultato."""
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


@router.get("/report/mobilita")
def report_mobilita(
    vehicle_type: str = Query(..., description="Tipo mezzo: scooter|bike|ebike|car"),
    from_date: str | None = Query(default=None, description="ISO date inizio (YYYY-MM-DD)"),
    to_date: str | None = Query(default=None, description="ISO date fine (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """UC-22 — Report aggregato: totale corse + top-3 tratte.
    Riusa _count_corse e _top_tratte: logica identica a /monitoraggio/frequenza e /tratte/frequenza."""
    if vehicle_type not in _VEHICLE_TYPES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Tipo non valido. Valori ammessi: {', '.join(sorted(_VEHICLE_TYPES))}",
        )

    dt_from = dt_to = None
    if from_date:
        try:
            dt_from = datetime.fromisoformat(from_date)
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Formato data inizio non valido (atteso YYYY-MM-DD)",
            )
    if to_date:
        try:
            dt_to = datetime.fromisoformat(to_date).replace(
                hour=23, minute=59, second=59, microsecond=999999,
            )
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Formato data fine non valido (atteso YYYY-MM-DD)",
            )
    if dt_from and dt_to and dt_from > dt_to:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "La data di inizio deve essere precedente alla data di fine",
        )

    return {
        "tipo": vehicle_type,
        "da": from_date,
        "a": to_date,
        "totale_corse": _count_corse(db, vehicle_type, dt_from, dt_to),
        "tratte": _top_tratte(db, vehicle_type, dt_from, dt_to, limit=3),
    }


@router.post("/segnala-zona", response_model=SegnalazioneZonaOut, status_code=status.HTTP_201_CREATED)
def segnala_zona(
    payload: SegnalazioneZonaIn = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """UC-19 — Segnalazione manutenzione urbana su zona testuale con periodo di validità."""
    lat = payload.gps_lat
    lng = payload.gps_lng
    if lat is None or lng is None:
        coords = _geocode_first(payload.zona)
        if coords:
            lat, lng = coords

    segn = Segnalazione(
        user_id=current_user.id,
        ride_id=None,
        category="MANUTENZIONE_URBANA",
        description=payload.descrizione,
        tipo="PERCORSO",
        gravita=payload.gravita,
        stato="APERTA",
        gps_lat=lat,
        gps_lng=lng,
        zona=payload.zona,
        valida_dal=payload.valida_dal,
        valida_al=payload.valida_al,
    )
    db.add(segn)
    db.commit()
    db.refresh(segn)

    return {
        "id":         segn.id,
        "zona":       segn.zona,
        "descrizione": segn.description,
        "valida_dal": segn.valida_dal,
        "valida_al":  segn.valida_al,
        "gps_lat":    segn.gps_lat,
        "gps_lng":    segn.gps_lng,
        "created_at": segn.created_at,
    }


@router.get("/report")
def report_aggregato(
    from_date: str | None = Query(default=None, description="ISO date inizio"),
    to_date: str | None = Query(default=None, description="ISO date fine"),
    db: Session = Depends(get_db),
):
    """AP.05 — Report aggregato sulla mobilità con filtri temporali. Dati anonimi/aggregati."""
    q = db.query(Ride).filter(Ride.status == "completed")
    if from_date:
        try:
            q = q.filter(Ride.started_at >= datetime.fromisoformat(from_date))
        except ValueError:
            pass
    if to_date:
        try:
            q = q.filter(Ride.started_at <= datetime.fromisoformat(to_date))
        except ValueError:
            pass
    rides = q.all()

    tot_corse = len(rides)
    tot_km = round(sum(r.km for r in rides), 1)
    tot_min = sum(r.minutes for r in rides)
    per_tipo = Counter(r.vehicle_type for r in rides)
    mezzi_attivi = db.query(Vehicle).filter(Vehicle.status != "maintenance").count()
    segn_aperte = db.query(Segnalazione).filter(Segnalazione.stato == "APERTA").count()

    return {
        "periodo": {"da": from_date, "a": to_date},
        "totale_corse": tot_corse,
        "km_totali": tot_km,
        "minuti_totali": tot_min,
        "km_medi_corsa": round(tot_km / tot_corse, 2) if tot_corse else 0,
        "corse_per_tipo": dict(per_tipo),
        "mezzi_attivi": mezzi_attivi,
        "segnalazioni_aperte": segn_aperte,
    }
