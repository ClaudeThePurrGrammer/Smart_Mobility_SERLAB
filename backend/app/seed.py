"""Popola il database con dati reali iniziali (eseguito una sola volta, se vuoto)."""
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from .models import (
    AmministrazioneProfile, AreaRestrizione, Message, OperatoreProfile, ParkingArea,
    PaymentMethod, Promotion, Ride, Segnalazione, User, Vehicle, WalletTransaction,
)
from .security import hash_password


def _ago(days=0, hours=0):
    return datetime.now(timezone.utc) - timedelta(days=days, hours=hours)


import math

BARI_CENTER = (41.1177, 16.8718)
TYPES = [
    ("scooter", "Smart S1",  "Pro 2024",  1.00, 0.22),
    ("scooter", "Smart S2",  "Lite",      0.80, 0.19),
    ("ebike",   "EcoBike E1","Urban 500", 1.20, 0.18),
    ("ebike",   "EcoBike E2","Compact",   1.00, 0.16),
    ("bike",    "CityBike B1","Classic",  0.50, 0.10),
]

def rand_coord(center, radius_km=2.5):
    r = radius_km / 111.0
    angle = random.uniform(0, 2 * math.pi)
    dist  = random.uniform(0, r)
    return center[0] + dist * math.cos(angle), center[1] + dist * math.sin(angle)

PROMOTIONS = [
    dict(kind="active", code="SMART2026", title="Codice attivo", body="3 corse gratuite",
         reward="3 corse gratuite", icon="gift", color="#7C3AED",
         expiry="31 maggio 2026", used=1, total=3),
    dict(kind="offer", code=None, title="Invita un amico",
         body="Per ogni amico che si registra con il tuo codice ottieni 2 corse gratis.",
         reward="+2 corse", icon="people-outline", color="#A78BFA"),
    dict(kind="offer", code=None, title="Weekend rider",
         body="Ogni sabato e domenica il primo sblocco è gratuito per tutto maggio 2026.",
         reward="Gratis", icon="sunny-outline", color="#F59E0B"),
    dict(kind="offer", code=None, title="Prima corsa gratis",
         body="La tua primissima corsa è completamente gratuita. Nessun limite di distanza.",
         reward="1 corsa free", icon="flash-outline", color="#22C55E"),
    dict(kind="offer", code=None, title="Fedeltà Gold",
         body="Raggiungi 50 corse e ottieni lo status Gold con il 10% di sconto permanente.",
         reward="-10%", icon="trophy-outline", color="#F59E0B"),
]

def seed(db: Session) -> None:
    if db.query(Vehicle).count() == 0:
        for i in range(40):
            vtype, name, model, fee, ppm = TYPES[i % len(TYPES)]
            lat, lng = rand_coord(BARI_CENTER)
            db.add(Vehicle(
                name=f"{name}-{i+1:02d}",
                model=model,
                type=vtype,
                lat=lat,
                lng=lng,
                battery_pct=random.randint(30, 100),
                status="available",
                unlock_fee=fee,
                price_per_min=ppm,
            ))

    if db.query(ParkingArea).count() == 0:
        parkings = [
            ("Parcheggio Piazza Moro", "Piazza Aldo Moro", 41.1171, 16.8693, 70, 25, 4),
            ("Sosta Teatro Petruzzelli", "Corso Cavour", 41.1235, 16.8705, 60, 18, 9),
            ("Hub Lungomare Nazario Sauro", "Lungomare N. Sauro", 41.1208, 16.8760, 80, 30, 12),
            ("Parcheggio Murat", "Via Sparano", 41.1218, 16.8688, 50, 15, 7),
            ("Sosta Politecnico", "Via Orabona", 41.1085, 16.8800, 65, 22, 3),
            ("Hub Stazione Centrale", "Piazza Moro (stazione)", 41.1163, 16.8710, 90, 35, 20),
        ]
        for name, address, lat, lng, radius, cap, occ in parkings:
            db.add(ParkingArea(
                name=name, address=address, lat=lat, lng=lng,
                radius_m=radius, capacity=cap, occupied=occ,
            ))

    if db.query(Promotion).count() == 0:
        for p in PROMOTIONS:
            db.add(Promotion(**p))

    if db.query(AreaRestrizione).count() == 0:
        aree = [
            ("ZTL Centro Storico", "ZTL", 41.1258, 16.8690, 350, ["scooter", "ebike", "bike"], "08:00-20:00"),
            ("Zona pedonale Sparano", "PEDONALE", 41.1210, 16.8688, 180, [], None),
            ("No-parking Lungomare", "NO_PARKING", 41.1205, 16.8765, 220, ["scooter"], None),
            ("Area vietata Porto", "NO_GO", 41.1320, 16.8650, 300, [], None),
            ("Limite velocità Università", "LIMITE_VELOCITA", 41.1085, 16.8800, 250, ["scooter", "ebike"], None),
        ]
        for nome, tipo, lat, lng, radius, vtypes, orario in aree:
            db.add(AreaRestrizione(
                nome=nome, tipo=tipo, lat=lat, lng=lng, radius_m=radius,
                vehicle_types=vtypes, orario=orario, attiva=True,
            ))

    # Account demo per i ruoli della web dashboard.
    if not db.query(User).filter(User.email == "operatore@smartmobility.it").first():
        op = User(
            name="Marco", surname="Operatore", email="operatore@smartmobility.it",
            phone="+39 080 111 2233", password_hash=hash_password("password123"),
            provider="email", role="OPERATORE", created_at=_ago(days=90),
        )
        db.add(op)
        db.flush()
        db.add(OperatoreProfile(user_id=op.id, zona_competenza="Bari Centro", matricola="OP-001"))

    if not db.query(User).filter(User.email == "comune@bari.it").first():
        admin = User(
            name="Lucia", surname="Bianchi", email="comune@bari.it",
            phone="+39 080 555 6677", password_hash=hash_password("password123"),
            provider="email", role="AMMINISTRAZIONE", created_at=_ago(days=120),
        )
        db.add(admin)
        db.flush()
        db.add(AmministrazioneProfile(
            user_id=admin.id, ente_appartenenza="Comune di Bari", codice_ente="BA-COM-01",
        ))

    db.commit()

    # ── Utente demo con dati reali ──────────────────────────────────────────
    if db.query(User).filter(User.email == "claudio@smartmobility.it").first():
        return

    user = User(
        name="Claudio", surname="Andriani",
        email="claudio@smartmobility.it",
        phone="+39 333 123 4567",
        password_hash=hash_password("password123"),
        provider="email",
        points=430, balance=8.90,
        created_at=_ago(days=160),
    )
    db.add(user)
    db.flush()

    rides = [
        ("scooter", "Via Roma 12", "Porta Romana", 2.4, 12, 3.60, 18, _ago(hours=4)),
        ("bike", "Stazione Centrale", "Corso Italia", 1.8, 9, 2.80, 12, _ago(days=1)),
        ("ebike", "Piazza Garibaldi", "Viale Europa", 3.2, 18, 4.50, 24, _ago(days=10)),
        ("scooter", "Via Napoli 5", "Università", 2.1, 11, 3.20, 16, _ago(days=12)),
        ("bike", "Casa", "Lavoro", 4.1, 22, 5.10, 30, _ago(days=15)),
        ("scooter", "Centro Commerciale", "Parco Cittadino", 1.5, 8, 2.40, 10, _ago(days=23)),
    ]
    for vtype, frm, to, km, mins, cost, pts, when in rides:
        db.add(Ride(
            user_id=user.id, vehicle_type=vtype, from_addr=frm, to_addr=to,
            km=km, minutes=mins, cost=cost, points=pts,
            status="completed", started_at=when, ended_at=when,
        ))

    txs = [
        ("charge", "Corsa · Via Roma → Porta Romana", -3.60, _ago(hours=4)),
        ("charge", "Corsa · Stazione → Corso Italia", -2.80, _ago(days=1)),
        ("topup", "Ricarica wallet", 20.00, _ago(days=11)),
        ("charge", "Corsa · P.za Garibaldi → V.le Europa", -4.50, _ago(days=10)),
        ("refund", "Rimborso · Veicolo non disponibile", 2.00, _ago(days=13)),
        ("topup", "Ricarica wallet", 10.00, _ago(days=19)),
    ]
    for ttype, label, amount, when in txs:
        db.add(WalletTransaction(user_id=user.id, type=ttype, label=label, amount=amount, created_at=when))

    db.add(PaymentMethod(user_id=user.id, kind="card", label="Visa", last4="4242", is_default=True))

    messages = [
        ("promo", "🎁 Offerta speciale", "Hai guadagnato 50 punti bonus! Usali entro il 31 maggio.", False, _ago(hours=0)),
        ("ride", "Corsa terminata", "La tua corsa di 2,4 km è stata completata. Costo: €3,60.", False, _ago(hours=4)),
        ("alert", "⚠️ Area ristretta vicina", "Sei a 200m da una zona a velocità limitata. Rallenta a 6 km/h.", True, _ago(days=1)),
        ("system", "Aggiornamento termini", "Abbiamo aggiornato i termini di servizio. Clicca per leggere.", True, _ago(days=1)),
        ("promo", "⚡ Weekend gratis", "Questo weekend sblocco gratuito per tutti i mezzi. Approfitta!", True, _ago(days=2)),
    ]
    for mtype, title, body, read, when in messages:
        db.add(Message(user_id=user.id, type=mtype, title=title, body=body, read=read, created_at=when))

    # Segnalazioni demo (per la dashboard malfunzionamenti OP.03 e zone critiche AP.02).
    segnalazioni = [
        ("Veicolo danneggiato", "Manubrio rotto sul monopattino", "MALFUNZIONAMENTO", "ALTA", "APERTA", 41.1190, 16.8730),
        ("Ostacolo", "Cantiere blocca la pista ciclabile", "PERCORSO", "MEDIA", "APERTA", 41.1230, 16.8705),
        ("Parcheggio pieno", "Hub Stazione al completo", "ALTRO", "BASSA", "APERTA", 41.1163, 16.8710),
        ("Veicolo danneggiato", "Freno non funzionante", "MALFUNZIONAMENTO", "ALTA", "CHIUSA", 41.1150, 16.8755),
    ]
    for cat, desc, tipo, grav, stato, lat, lng in segnalazioni:
        db.add(Segnalazione(
            user_id=user.id, category=cat, description=desc, tipo=tipo,
            gravita=grav, stato=stato, gps_lat=lat, gps_lng=lng,
        ))

    db.commit()
    print("[seed] Dati iniziali inseriti. Utente demo: claudio@smartmobility.it / password123")
