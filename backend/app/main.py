"""CONTROLLER Smart Mobility — API REST (FastAPI)."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .database import Base, SessionLocal, engine, wait_for_db
from .routers import (
    amministrazione, auth, geo, messages, operatore, parking, payment, promotions,
    realtime, reports, restrizioni, rides, segnalazioni, users, vehicles, wallet,
)
from .seed import cleanup_orphans, seed


def _ensure_schema() -> None:
    """Migrazioni idempotende leggere (create_all non aggiunge colonne a tabelle esistenti).

    Per i DB esistenti garantisce le colonne introdotte dai ruoli OPERATORE/AMMINISTRAZIONE.
    Le migrazioni versionate equivalenti vivono in `alembic/versions` (riferimento ufficiale)."""
    stmts = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences TEXT DEFAULT '{}'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'UTENTE'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'ATTIVO'",
        "ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE",
    ]
    with engine.begin() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    wait_for_db()
    Base.metadata.create_all(bind=engine)
    _ensure_schema()
    with SessionLocal() as db:
        cleanup_orphans(db)   # chiude corse orfane prima di ogni altra operazione
        seed(db)
    yield


app = FastAPI(title="Smart Mobility API", version="1.0.0", lifespan=lifespan)

# La VIEW (app mobile) gira su dispositivi diversi: in sviluppo abilitiamo CORS aperto.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(vehicles.router)
app.include_router(parking.router)
app.include_router(rides.router)
app.include_router(wallet.router)
app.include_router(payment.router)
app.include_router(promotions.router)
app.include_router(messages.router)
app.include_router(reports.router)
app.include_router(geo.router)
# Ruoli OPERATORE / AMMINISTRAZIONE (web dashboard)
app.include_router(segnalazioni.router)
app.include_router(restrizioni.router)
app.include_router(operatore.router)
app.include_router(amministrazione.router)
app.include_router(realtime.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "service": "smart-mobility-api"}
