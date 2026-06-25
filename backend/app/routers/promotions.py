"""Promozioni e bonus (globali)."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Message, Promotion, User
from ..schemas import PromotionOut, PromotionRedeem

router = APIRouter(prefix="/promotions", tags=["promotions"])


@router.get("", response_model=list[PromotionOut])
def list_promotions(db: Session = Depends(get_db)):
    return db.query(Promotion).order_by(Promotion.kind.desc(), Promotion.id).all()


@router.post("/redeem", response_model=PromotionOut)
def redeem_promotion(
    data: PromotionRedeem,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    code = data.code.strip().upper()
    promo = db.query(Promotion).filter(Promotion.code == code).first()
    if not promo:
        raise HTTPException(404, "Codice non valido")
    if promo.expiry and promo.expiry < date.today().isoformat():
        raise HTTPException(400, "Codice scaduto")
    if promo.total > 0 and promo.used >= promo.total:
        raise HTTPException(400, "Codice esaurito")
    promo.used += 1
    # Registra l'applicazione come messaggio in bacheca per l'utente.
    db.add(Message(
        user_id=user.id,
        type="promo",
        title="Codice applicato!",
        body=f'Promo "{promo.code}" applicata: {promo.reward}',
    ))
    db.commit()
    db.refresh(promo)
    return promo
