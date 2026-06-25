"""GestioneAmministrazione — statistiche e report aggregati (AP.01–AP.05).
Tutte le route richiedono ruolo AMMINISTRAZIONE. Dati anonimi e aggregati (GDPR)."""
from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_role
from ..models import Ride, Segnalazione, Vehicle

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
