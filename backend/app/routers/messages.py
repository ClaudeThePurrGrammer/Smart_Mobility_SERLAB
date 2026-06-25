"""Notifiche/messaggi dell'utente."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Message, User
from ..schemas import MessageCreate, MessageOut

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("", response_model=list[MessageOut])
def list_messages(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(Message)
        .filter(Message.user_id == user.id)
        .order_by(Message.created_at.desc())
        .all()
    )


@router.post("", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def create_message(data: MessageCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = Message(user_id=user.id, type=data.type, title=data.title, body=data.body)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.post("/read-all", response_model=list[MessageOut])
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Message).filter(Message.user_id == user.id, Message.read == False).update({"read": True})  # noqa: E712
    db.commit()
    return (
        db.query(Message)
        .filter(Message.user_id == user.id)
        .order_by(Message.created_at.desc())
        .all()
    )


@router.post("/{message_id}/read", response_model=MessageOut)
def mark_read(message_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = db.get(Message, message_id)
    if not msg or msg.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Messaggio non trovato")
    msg.read = True
    db.commit()
    db.refresh(msg)
    return msg
