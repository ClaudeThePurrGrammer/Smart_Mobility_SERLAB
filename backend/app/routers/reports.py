"""Segnalazioni degli utenti (View mobile). Persistono su entità Segnalazione."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Message, Segnalazione, User
from ..schemas import ReportIn, ReportOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=list[ReportOut])
def list_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Segnalazione)
        .filter(Segnalazione.user_id == user.id)
        .order_by(Segnalazione.created_at.desc())
        .all()
    )


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def create_report(data: ReportIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    segn = Segnalazione(
        user_id=user.id,
        ride_id=data.ride_id,
        category=data.category,
        description=data.description,
        tipo=data.tipo,
        gravita=data.gravita,
        gps_lat=data.gps_lat,
        gps_lng=data.gps_lng,
        attachments=data.attachments,
        stato="APERTA",
    )
    db.add(segn)
    db.add(Message(
        user_id=user.id, type="system", title="Segnalazione ricevuta",
        body="Grazie! Abbiamo registrato la tua segnalazione e la esamineremo a breve.",
    ))
    db.commit()
    db.refresh(segn)
    return segn
