"""Dependency di autenticazione: estrae l'utente corrente dal token JWT."""
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_token


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token mancante")

    token = authorization.split(" ", 1)[1]
    user_id = decode_token(token)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token non valido o scaduto")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utente non trovato")
    # [V] Account sospeso/bloccato: nessun accesso (OP.08, CU-24 alt).
    if user.account_status in ("SOSPESO", "BLOCCATO"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account sospeso o bloccato")
    return user


def require_role(*roles: str):
    """Route guard per ruolo: consente l'accesso solo agli utenti con uno dei ruoli dati."""
    def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Permessi insufficienti per il ruolo")
        return user
    return _guard
