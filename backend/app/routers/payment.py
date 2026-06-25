"""Metodi di pagamento dell'utente."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import PaymentMethod, User
from ..schemas import PaymentMethodIn, PaymentMethodOut

router = APIRouter(prefix="/payment-methods", tags=["payment"])


@router.get("", response_model=list[PaymentMethodOut])
def list_methods(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(PaymentMethod)
        .filter(PaymentMethod.user_id == user.id)
        .order_by(PaymentMethod.is_default.desc(), PaymentMethod.id)
        .all()
    )


@router.post("", response_model=PaymentMethodOut, status_code=status.HTTP_201_CREATED)
def add_method(data: PaymentMethodIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.is_default:
        for m in db.query(PaymentMethod).filter(PaymentMethod.user_id == user.id).all():
            m.is_default = False
    method = PaymentMethod(user_id=user.id, **data.model_dump())
    db.add(method)
    db.commit()
    db.refresh(method)
    return method


@router.delete("/{method_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_method(method_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    method = db.get(PaymentMethod, method_id)
    if not method or method.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Metodo non trovato")
    db.delete(method)
    db.commit()
