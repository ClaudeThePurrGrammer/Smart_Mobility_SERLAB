"""GestioneSegnalazioni — dashboard malfunzionamenti (OP.03/CU-26, OP.06).
Accessibile a Operatore e Amministrazione. Il Controller coordina il Model."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_role
from ..models import Message, Segnalazione, User
from ..schemas import SegnalazioneOut

router = APIRouter(prefix="/segnalazioni", tags=["segnalazioni"])

# Operatore e Amministrazione possono consultare le segnalazioni.
_lettura = require_role("OPERATORE", "AMMINISTRAZIONE")
# Solo l'Operatore chiude le segnalazioni risolte (OP.06).
_operatore = require_role("OPERATORE")

_GRAVITA_ORD = {"ALTA": 0, "MEDIA": 1, "BASSA": 2}


@router.get("", response_model=list[SegnalazioneOut])
def list_segnalazioni(
    stato: str | None = Query(default=None),
    gravita: str | None = Query(default=None),
    tipo: str | None = Query(default=None),
    _: User = Depends(_lettura),
    db: Session = Depends(get_db),
):
    """Aggrega le segnalazioni (CU-26), ordinate per gravità e data. Filtri opzionali."""
    q = db.query(Segnalazione)
    if stato:
        q = q.filter(Segnalazione.stato == stato)
    if gravita:
        q = q.filter(Segnalazione.gravita == gravita)
    if tipo:
        q = q.filter(Segnalazione.tipo == tipo)
    items = q.all()
    items.sort(key=lambda s: (_GRAVITA_ORD.get(s.gravita, 1), -s.id))
    return items


@router.get("/{segn_id}", response_model=SegnalazioneOut)
def get_segnalazione(segn_id: int, _: User = Depends(_lettura), db: Session = Depends(get_db)):
    segn = db.get(Segnalazione, segn_id)
    if not segn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Segnalazione non trovata")
    return segn


@router.patch("/{segn_id}/chiudi", response_model=SegnalazioneOut)
def chiudi_segnalazione(segn_id: int, _: User = Depends(_operatore), db: Session = Depends(get_db)):
    """OP.06 — Chiusura di una segnalazione risolta."""
    segn = db.get(Segnalazione, segn_id)
    if not segn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Segnalazione non trovata")
    if segn.stato == "CHIUSA":
        raise HTTPException(status.HTTP_409_CONFLICT, "Segnalazione già chiusa")
    segn.stato = "CHIUSA"
    segn.closed_at = datetime.now(timezone.utc)
    db.add(Message(
        user_id=segn.user_id, type="system", title="Segnalazione risolta",
        body="La segnalazione che hai inviato è stata gestita e chiusa. Grazie!",
    ))
    db.commit()
    db.refresh(segn)
    return segn
