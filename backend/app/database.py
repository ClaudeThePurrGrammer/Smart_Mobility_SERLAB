"""Connessione al database PostgreSQL (SQLAlchemy)."""
import time

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency FastAPI: fornisce una sessione DB per richiesta."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def wait_for_db(retries: int = 30, delay: float = 1.0) -> None:
    """Attende che PostgreSQL sia pronto (il container db può avviarsi dopo l'API)."""
    for attempt in range(1, retries + 1):
        try:
            with engine.connect():
                return
        except OperationalError:
            print(f"[db] in attesa di PostgreSQL... tentativo {attempt}/{retries}")
            time.sleep(delay)
    raise RuntimeError("Impossibile connettersi al database dopo vari tentativi.")
