"""Preferenze utente (impostazioni dell'app)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import PreferencesIn, PreferencesOut

router = APIRouter(prefix="/users", tags=["users"])

DEFAULTS = PreferencesOut().model_dump()


def _merged(prefs: dict | None) -> PreferencesOut:
    return PreferencesOut(**{**DEFAULTS, **(prefs or {})})


@router.get("/me/preferences", response_model=PreferencesOut)
def get_preferences(user: User = Depends(get_current_user)):
    return _merged(user.preferences)


@router.patch("/me/preferences", response_model=PreferencesOut)
def update_preferences(data: PreferencesIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current = {**DEFAULTS, **(user.preferences or {})}
    current.update(data.model_dump(exclude_unset=True))
    user.preferences = current
    flag_modified(user, "preferences")  # forza l'UPDATE della colonna JSON
    db.commit()
    return _merged(user.preferences)
