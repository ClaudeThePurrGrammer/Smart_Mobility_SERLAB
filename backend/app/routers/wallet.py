"""Portafoglio: saldo, transazioni e ricariche."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User, WalletTransaction
from ..schemas import TopUpIn, TransactionOut, WalletOut

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("", response_model=WalletOut)
def get_wallet(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txs = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.user_id == user.id)
        .order_by(WalletTransaction.created_at.desc())
        .all()
    )
    return WalletOut(balance=user.balance, transactions=[TransactionOut.model_validate(t) for t in txs])


@router.post("/topup", response_model=WalletOut)
def topup(data: TopUpIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.balance = round(user.balance + data.amount, 2)
    db.add(WalletTransaction(
        user_id=user.id, type="topup", label="Ricarica wallet", amount=data.amount,
    ))
    db.commit()
    txs = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.user_id == user.id)
        .order_by(WalletTransaction.created_at.desc())
        .all()
    )
    return WalletOut(balance=user.balance, transactions=[TransactionOut.model_validate(t) for t in txs])
