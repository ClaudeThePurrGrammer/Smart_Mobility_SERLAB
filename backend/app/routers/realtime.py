"""Aggiornamenti real-time via WebSocket (interfaccia Controller_to_View, §2.3.3).
- OP.05: tracciamento posizione di un mezzo in tempo reale.
- OP.02: notifiche di disponibilità aree all'operatore.
Autenticazione via query param `token` (gli header non sono pratici lato WebSocket browser)."""
import asyncio
import random

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import ParkingArea, User, Vehicle
from ..security import decode_token

router = APIRouter(tags=["realtime"])

_DRIFT = 0.0002       # ampiezza spostamento simulato per tick
_INTERVAL = 2.0       # secondi tra un aggiornamento e l'altro


def _auth(token: str | None, roles: tuple[str, ...]) -> bool:
    """Valida il token e il ruolo per la connessione WebSocket."""
    if not token:
        return False
    uid = decode_token(token)
    if uid is None:
        return False
    db: Session = SessionLocal()
    try:
        user = db.get(User, uid)
        return bool(user and user.role in roles and user.account_status == "ATTIVO")
    finally:
        db.close()


@router.websocket("/ws/mezzi/{vehicle_id}")
async def track_vehicle(websocket: WebSocket, vehicle_id: int, token: str | None = Query(default=None)):
    """OP.05 — Stream della posizione di un mezzo in tragitto (Operatore)."""
    if not _auth(token, ("OPERATORE",)):
        await websocket.close(code=4401)
        return
    await websocket.accept()
    try:
        while True:
            db: Session = SessionLocal()
            try:
                v = db.get(Vehicle, vehicle_id)
                if not v:
                    await websocket.send_json({"error": "vehicle_not_found"})
                    break
                # Simula il movimento del mezzo in tempo reale e persiste la posizione.
                v.lat = round(v.lat + random.uniform(-_DRIFT, _DRIFT), 6)
                v.lng = round(v.lng + random.uniform(-_DRIFT, _DRIFT), 6)
                db.commit()
                payload = {
                    "vehicle_id": v.id, "lat": v.lat, "lng": v.lng,
                    "battery_pct": v.battery_pct, "status": v.status, "locked": v.locked,
                }
            finally:
                db.close()
            await websocket.send_json(payload)
            await asyncio.sleep(_INTERVAL)
    except WebSocketDisconnect:
        return


@router.websocket("/ws/notifiche")
async def notifiche_operatore(websocket: WebSocket, token: str | None = Query(default=None)):
    """OP.02 — Notifiche di aree a diversa disponibilità (soglie densità)."""
    if not _auth(token, ("OPERATORE",)):
        await websocket.close(code=4401)
        return
    await websocket.accept()
    try:
        while True:
            db: Session = SessionLocal()
            try:
                vehicles = db.query(Vehicle).filter(Vehicle.status == "available").all()
                aree = db.query(ParkingArea).all()
                avvisi = []
                for a in aree:
                    deg = a.radius_m / 111000.0
                    count = sum(1 for v in vehicles if abs(v.lat - a.lat) < deg and abs(v.lng - a.lng) < deg)
                    if count < 3:
                        avvisi.append({"area": a.name, "mezzi": count, "livello": "BASSA"})
            finally:
                db.close()
            await websocket.send_json({"tipo": "densita_aree", "avvisi": avvisi})
            await asyncio.sleep(5.0)
    except WebSocketDisconnect:
        return
