"""Promozioni e bonus (globali)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Promotion
from ..schemas import PromotionOut

router = APIRouter(prefix="/promotions", tags=["promotions"])


@router.get("", response_model=list[PromotionOut])
def list_promotions(db: Session = Depends(get_db)):
    return db.query(Promotion).order_by(Promotion.kind.desc(), Promotion.id).all()
