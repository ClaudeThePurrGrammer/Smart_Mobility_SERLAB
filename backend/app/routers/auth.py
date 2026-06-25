"""Autenticazione: registrazione, login email/password e login social."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import (
    ROLES, AmministrazioneProfile, Message, OperatoreProfile, User,
)
from ..schemas import (
    LoginIn, RegisterIn, TokenOut, UserOut, UserUpdate,
)
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _welcome_message(db: Session, user: User) -> None:
    db.add(Message(
        user_id=user.id,
        type="system",
        title="Benvenuto su Smart Mobility 🎉",
        body="Il tuo account è attivo. Trova il mezzo più vicino e inizia a muoverti smart!",
    ))


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email già registrata")

    role = data.role if data.role in ROLES else "UTENTE"

    user = User(
        name=data.name,
        surname=data.surname,
        email=data.email,
        phone=data.phone,
        password_hash=hash_password(data.password),
        provider="email",
        points=0,
        balance=0.0,
        role=role,
    )
    db.add(user)
    db.flush()

    # Profilo 1:1 specifico per ruolo (CU-25 operatore, CU-AP06 amministrazione).
    if role == "OPERATORE":
        db.add(OperatoreProfile(user_id=user.id, zona_competenza=data.zona_competenza or ""))
    elif role == "AMMINISTRAZIONE":
        db.add(AmministrazioneProfile(user_id=user.id, ente_appartenenza=data.ente_appartenenza or ""))
    else:
        _welcome_message(db, user)

    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_access_token(user.id, user.role), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        # [V] Caso alternativo: credenziali non valide senza rivelare quale campo è errato.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email o password non corretti")
    # [V] Caso alternativo: account sospeso/bloccato (CU-24 alt).
    if user.account_status in ("SOSPESO", "BLOCCATO"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account sospeso o bloccato. Contatta il supporto.")
    return TokenOut(access_token=create_access_token(user.id, user.role), user=UserOut.model_validate(user))



from pydantic import BaseModel

class ForgotPasswordIn(BaseModel):
    email: str

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordIn):
    email = data.email.strip()
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "email required")
    # In produzione qui si invierebbe una mail; per demo si risponde sempre OK
    return {"message": "Se l'indirizzo esiste, riceverai le istruzioni."}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(data: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
