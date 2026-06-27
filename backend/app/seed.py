"""Popola il database con dati reali iniziali (eseguito una sola volta, se vuoto)."""
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import delete

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
# Flotta: solo monopattini elettrici e auto elettriche (ebike rimossi).
TYPES = [
    ("scooter", "Smart S1",   "Pro 2024",   1.00, 0.22),
    ("scooter", "Smart S2",   "Lite",       0.80, 0.19),
    ("scooter", "Smart S3",   "Urban",      0.90, 0.20),
    ("scooter", "Smart S4",   "Speed",      1.10, 0.24),
    ("ebike",   "EcoBike E1", "City E",     0.50, 0.12),
    ("ebike",   "EcoBike E2", "Sport E",    0.60, 0.14),
    ("ebike",   "EcoBike E3", "Urban E",    0.55, 0.13),
    ("car",     "E-Car C1",   "City EV",    2.00, 0.35),
    ("car",     "E-Car C2",   "Compact EV", 1.80, 0.32),
    ("car",     "E-Car C3",   "Mini EV",    1.60, 0.30),
    ("car",     "E-Car C4",   "SUV EV",     2.20, 0.38),
]

def rand_coord(center, radius_km=2.5):
    r = radius_km / 111.0
    angle = random.uniform(0, 2 * math.pi)
    dist  = random.uniform(0, r)
    return center[0] + dist * math.cos(angle), center[1] + dist * math.sin(angle)

# ── Modello "terraferma" dell'area urbana di Bari ─────────────────────────────
# La costa adriatica taglia l'area urbana da NO a SE: i punti a NE della costa
# cadono in mare (veicoli invisibili/inutilizzabili sulla mappa). Per evitarlo,
# l'area edificata a SO della costa è approssimata da una "scala" di rettangoli
# noti per essere terraferma. Solo i bounds dell'area sono fissi: nessuna
# coordinata di veicolo è hardcoded.
BARI_BOUNDS = dict(lat_min=41.05, lat_max=41.17, lng_min=16.82, lng_max=16.92)

# Rettangoli (lat_min, lat_max, lng_min, lng_max) interamente su terraferma.
# Salendo di longitudine (verso E) il tetto di latitudine scende, seguendo la
# costa: così i bacini portuali a N e l'Adriatico a NE restano esclusi.
BARI_LAND_RECTS = [
    (41.050, 41.140, 16.820, 16.860),
    (41.050, 41.128, 16.860, 16.872),
    (41.050, 41.115, 16.872, 16.882),
    (41.050, 41.103, 16.882, 16.892),
    (41.050, 41.091, 16.892, 16.902),
]

# Tentativi massimi di campionamento prima di rinunciare (evita loop infiniti).
MAX_COORD_ATTEMPTS = 100


def is_on_land(lat: float, lng: float) -> bool:
    """True se (lat, lng) è sulla terraferma dell'area urbana di Bari.

    Approccio leggero, senza dipendenze esterne: il punto deve cadere dentro
    BARI_BOUNDS e dentro almeno uno dei rettangoli terra di BARI_LAND_RECTS.
    """
    if not (BARI_BOUNDS["lat_min"] <= lat <= BARI_BOUNDS["lat_max"]
            and BARI_BOUNDS["lng_min"] <= lng <= BARI_BOUNDS["lng_max"]):
        return False
    return any(
        lat_min <= lat <= lat_max and lng_min <= lng <= lng_max
        for (lat_min, lat_max, lng_min, lng_max) in BARI_LAND_RECTS
    )


def rand_land_coord(center=BARI_CENTER, radius_km=2.5, max_attempts=MAX_COORD_ATTEMPTS):
    """Campiona una coordinata casuale vicino al centro che cada sulla terraferma.

    Riprova fino a max_attempts volte; restituisce None se nessun punto valido
    è stato trovato (così il chiamante può loggare un warning e saltare).
    """
    for _ in range(max_attempts):
        lat, lng = rand_coord(center, radius_km)
        if is_on_land(lat, lng):
            return lat, lng
    return None

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

def cleanup_orphans(db: Session) -> None:
    """Chiude le corse rimaste 'active'/'paused' (es. crash app, riavvio server).

    Eseguito ad ogni avvio del backend — sicuro e idempotente.
    Resetta anche lo stato dei veicoli associati a 'available'.
    """
    orphans = db.query(Ride).filter(Ride.status.in_(("active", "paused"))).all()
    if not orphans:
        return
    now = datetime.now(timezone.utc)
    for r in orphans:
        elapsed_s = max(0.0, (now - r.started_at).total_seconds())
        r.minutes = max(0, int(elapsed_s / 60))
        r.status = "completed"
        r.ended_at = now
        # Resetta il veicolo associato
        if r.vehicle_id:
            v = db.get(Vehicle, r.vehicle_id)
            if v and v.status == "in_use":
                v.status = "available"
    db.commit()
    print(f"[cleanup] Chiuse {len(orphans)} corse orfane.")


def fix_sea_vehicles(db: Session) -> None:
    """Riposiziona sulla terraferma i veicoli con coordinate finite in mare.

    Sicuro e idempotente. NON sposta (né cancella) i veicoli con una corsa in
    corso: status == 'in_use' oppure con una Ride 'active'/'paused' collegata —
    la loro posizione riflette una corsa reale e non va alterata.
    """
    # Veicoli con corsa attiva/in pausa: intoccabili.
    busy_ids = {
        vid for (vid,) in db.query(Ride.vehicle_id)
        .filter(Ride.status.in_(("active", "paused")), Ride.vehicle_id.isnot(None))
        .all()
    }
    fixed = 0
    for v in db.query(Vehicle).all():
        if is_on_land(v.lat, v.lng):
            continue
        if v.status == "in_use" or v.id in busy_ids:
            continue  # corsa in corso: non spostare il veicolo
        coord = rand_land_coord()
        if coord is None:
            print(f"[fix_sea_vehicles][warn] Nessuna coordinata valida (on land) trovata "
                  f"dopo {MAX_COORD_ATTEMPTS} tentativi per il veicolo #{v.id} ({v.name}): "
                  f"lasciato invariato.")
            continue
        v.lat, v.lng = coord
        fixed += 1
    if fixed:
        db.commit()
        print(f"[fix_sea_vehicles] Riposizionati {fixed} veicoli da mare a terraferma.")


def ensure_parking_areas(db: Session) -> None:
    """Aggiunge/aggiorna aree di parcheggio su più città pugliesi.

    Se il DB contiene meno di 55 aree, svuota e risemina con la lista completa
    multi-città (60 aree su 11 città pugliesi). Idempotente: se ≥ 55 aree
    esistono già non fa nulla.
    """
    if db.query(ParkingArea).count() >= 55:
        return
    # Svuota eventuali aree vecchie (nessuna FK esterna punta a parking_areas).
    db.query(ParkingArea).delete()

    # (nome, indirizzo, lat, lng, radius_m, capacity, occupied)
    parkings = [
        # ── BARI ──────────────────────────────────────────────────────────────
        ("Parcheggio Piazza Moro",         "Piazza Aldo Moro",          41.1171, 16.8693, 70, 25,  4),
        ("Sosta Teatro Petruzzelli",       "Corso Cavour",              41.1235, 16.8705, 60, 18,  9),
        ("Hub Lungomare Nazario Sauro",    "Lungomare N. Sauro",        41.1208, 16.8760, 80, 30, 12),
        ("Parcheggio Murat",               "Via Sparano",               41.1218, 16.8688, 50, 15,  7),
        ("Sosta Politecnico",              "Via Orabona",               41.1085, 16.8800, 65, 22,  3),
        ("Hub Stazione Centrale",          "Piazza Moro (stazione)",    41.1163, 16.8710, 90, 35, 20),
        ("Sosta Fiera del Levante",        "Lungomare Starita",         41.1055, 16.8650, 70, 28,  8),
        ("Hub San Pasquale",               "Via Capruzzi",              41.1140, 16.8680, 55, 20,  5),
        ("Parcheggio Caserma Rossaroll",   "Via Giulio Petroni",        41.1310, 16.8658, 65, 24, 11),
        ("Sosta Piazza Umberto I",         "Piazza Umberto I",          41.1250, 16.8683, 60, 22,  7),
        ("Hub Parco 2 Giugno",             "Viale Luigi Jacobini",      41.1060, 16.8730, 75, 30,  6),
        ("Sosta Borgo Antico",             "Via Venezia",               41.1280, 16.8680, 55, 18,  4),

        # ── FOGGIA ────────────────────────────────────────────────────────────
        ("Hub Piazza Cavour Foggia",       "Piazza Cavour",             41.4628, 15.5445, 70, 25,  5),
        ("Sosta Stazione Foggia",          "Viale XXIV Maggio",         41.4610, 15.5490, 80, 30, 10),
        ("Parcheggio Via Lanza",           "Via Lanza",                 41.4650, 15.5420, 60, 20,  4),
        ("Hub Piazza Italia Foggia",       "Piazza Italia",             41.4670, 15.5462, 65, 22,  7),
        ("Sosta Viale Michelangelo",       "Viale Michelangelo",        41.4590, 15.5530, 55, 18,  3),
        ("Hub Foggia Nord",                "Via Saverio Altamura",      41.4705, 15.5378, 70, 25,  6),
        ("Sosta Piazza Puglia",            "Piazza Puglia",             41.4558, 15.5402, 50, 16,  2),
        ("Parcheggio Rione Croci",         "Via Catalano",              41.4642, 15.5512, 60, 20,  8),

        # ── LECCE ─────────────────────────────────────────────────────────────
        ("Hub Piazza Mazzini Lecce",       "Piazza Mazzini",            40.3513, 18.1764, 70, 25,  5),
        ("Sosta Porta Rudiae",             "Via Taranto",               40.3530, 18.1710, 60, 20,  8),
        ("Parcheggio Stazione Lecce",      "Via Don Bosco",             40.3479, 18.1810, 80, 30, 12),
        ("Hub Villa Comunale Lecce",       "Viale Lo Re",               40.3545, 18.1780, 55, 18,  4),
        ("Sosta Piazza Sant'Oronzo",       "Piazza Sant'Oronzo",        40.3523, 18.1738, 65, 22,  6),
        ("Hub Lecce Sud",                  "Via Vittorio Emanuele II",  40.3450, 18.1768, 70, 25,  3),
        ("Sosta Parco Belloluogo",         "Via Belloluogo",            40.3582, 18.1728, 50, 16,  2),
        ("Parcheggio Via Adua",            "Via Adua",                  40.3540, 18.1660, 60, 20,  7),

        # ── TARANTO ───────────────────────────────────────────────────────────
        ("Hub Piazza Garibaldi Taranto",   "Piazza Garibaldi",          40.4641, 17.2480, 70, 25,  8),
        ("Sosta Stazione Taranto",         "Via Principe Amedeo",       40.4670, 17.2437, 80, 28, 11),
        ("Parcheggio Città Vecchia",       "Via Duomo",                 40.4700, 17.2580, 60, 20,  5),
        ("Hub Lungomare Taranto",          "Lungomare Vittorio Emanuele", 40.4628, 17.2450, 65, 22, 7),
        ("Sosta Via Nitti",                "Via Francesco Nitti",       40.4605, 17.2510, 55, 18,  4),
        ("Hub Taranto Nord",               "Via Lago di Como",          40.4722, 17.2390, 70, 25,  6),

        # ── MOLFETTA ──────────────────────────────────────────────────────────
        ("Hub Piazza Garibaldi Molfetta",  "Piazza Garibaldi",          41.2015, 16.5980, 60, 20,  5),
        ("Sosta Porto Molfetta",           "Via Banchina S. Domenico",  41.2040, 16.5950, 55, 18,  7),
        ("Parcheggio Stazione Molfetta",   "Via Martiri di Dogali",     41.1990, 16.6010, 65, 22,  4),
        ("Hub Via Milano Molfetta",        "Via Milano",                41.1975, 16.5990, 50, 16,  3),

        # ── BARLETTA ──────────────────────────────────────────────────────────
        ("Hub Castello Barletta",          "Piazza Castello",           41.3188, 16.2816, 65, 22,  6),
        ("Sosta Stazione Barletta",        "Corso Garibaldi",           41.3150, 16.2850, 70, 25,  8),
        ("Parcheggio Via Zanardelli",      "Via Zanardelli",            41.3200, 16.2780, 55, 18,  4),
        ("Hub Corso Vittorio Emanuele BA", "Corso Vittorio Emanuele",   41.3175, 16.2770, 60, 20,  5),

        # ── ANDRIA ────────────────────────────────────────────────────────────
        ("Hub Piazza Catuma Andria",       "Piazza Catuma",             41.2290, 16.2960, 65, 22,  5),
        ("Sosta Stazione Andria",          "Via Barletta",              41.2260, 16.2990, 60, 20,  7),
        ("Parcheggio Via Bari Andria",     "Via Bari",                  41.2320, 16.2930, 55, 18,  3),

        # ── BRINDISI ──────────────────────────────────────────────────────────
        ("Hub Piazza Vittoria Brindisi",   "Piazza Vittoria",           40.6330, 17.9390, 70, 25,  6),
        ("Sosta Porto Brindisi",           "Viale Regina Margherita",   40.6355, 17.9465, 75, 28,  9),
        ("Parcheggio Stazione Brindisi",   "Piazza Crispi",             40.6278, 17.9342, 80, 30, 11),
        ("Hub Lungomare Brindisi",         "Lungomare Regina Margherita", 40.6372, 17.9412, 60, 20, 4),

        # ── ALTAMURA ──────────────────────────────────────────────────────────
        ("Hub Piazza Duomo Altamura",      "Piazza Duomo",              40.8275, 16.5520, 60, 20,  5),
        ("Sosta Stazione Altamura",        "Via della Stazione",        40.8240, 16.5550, 55, 18,  3),
        ("Parcheggio Via Matera",          "Via Matera",                40.8300, 16.5490, 50, 16,  2),

        # ── MANFREDONIA ───────────────────────────────────────────────────────
        ("Hub Piazza del Popolo Manf.",    "Piazza del Popolo",         41.6270, 15.9170, 65, 22,  5),
        ("Sosta Porto Manfredonia",        "Lungomare del Sole",        41.6312, 15.9112, 70, 25,  7),
        ("Parcheggio Siponto",             "Via Scillitani",            41.6012, 15.9258, 55, 18,  3),

        # ── TRANI ─────────────────────────────────────────────────────────────
        ("Hub Lungomare Trani",            "Lungomare Cristoforo Colombo", 41.2782, 16.4158, 65, 22, 6),
        ("Sosta Cattedrale Trani",         "Piazza Duomo",              41.2800, 16.4138, 60, 20,  5),
        ("Parcheggio Stazione Trani",      "Piazza della Repubblica",   41.2740, 16.4202, 70, 25,  8),

        # ── CERIGNOLA ─────────────────────────────────────────────────────────
        ("Hub Piazza della Repubblica CE", "Piazza della Repubblica",   41.2654, 15.8997, 60, 20,  4),
        ("Sosta Stazione Cerignola",       "Via della Stazione",        41.2620, 15.9040, 55, 18,  3),
    ]

    for name, address, lat, lng, radius, cap, occ in parkings:
        db.add(ParkingArea(
            name=name, address=address, lat=lat, lng=lng,
            radius_m=radius, capacity=cap, occupied=occ,
        ))
    db.commit()
    print(f"[ensure_parking_areas] Aggiunte {len(parkings)} aree di parcheggio su più città.")


def migrate_ebikes_to_cars(db: Session) -> None:
    """Converte le ebike esistenti in auto elettriche (rimozione tipo dalla flotta).

    I veicoli di tipo 'ebike' non sono più nel catalogo; quelli già presenti
    vengono aggiornati a 'car' con la tariffa standard dell'auto compatta.
    Idempotente: se non ci sono ebike, non fa nulla.
    """
    ebikes = db.query(Vehicle).filter(Vehicle.type == "ebike").all()
    if not ebikes:
        return
    car_types = [t for t in TYPES if t[0] == "car"]
    for i, v in enumerate(ebikes):
        _, car_name, model, fee, ppm = car_types[i % len(car_types)]
        v.type = "car"
        v.name = f"{car_name}-{i + 1:02d}"   # rinomina: "EcoBike E1" → "E-Car C1-01"
        v.model = model
        v.unlock_fee = fee
        v.price_per_min = ppm
    db.commit()
    print(f"[migrate_ebikes_to_cars] Convertiti {len(ebikes)} ebike → auto elettrica.")


def ensure_electric_cars(db: Session) -> None:
    """Garantisce almeno 12 auto elettriche nella flotta."""
    existing = db.query(Vehicle).filter(Vehicle.type == "car").count()
    if existing >= 12:
        return
    to_add = 12 - existing
    car_types = [t for t in TYPES if t[0] == "car"]
    added = 0
    for i in range(to_add):
        vtype, name, model, fee, ppm = car_types[i % len(car_types)]
        coord = rand_land_coord()
        if coord is None:
            print(f"[ensure_electric_cars][warn] Nessuna coordinata valida per {name}.")
            continue
        lat, lng = coord
        db.add(Vehicle(
            name=f"{name}-{existing + i + 1:02d}",
            model=model,
            type=vtype,
            lat=lat,
            lng=lng,
            battery_pct=random.randint(45, 100),
            status="available",
            unlock_fee=fee,
            price_per_min=ppm,
        ))
        added += 1
    if added:
        db.commit()
        print(f"[ensure_electric_cars] Aggiunte {added} auto elettriche (totale target: 12).")


def reset_and_reseed(db: Session) -> None:
    """Azzera tutti i dati utente e risemina da zero.

    Mantiene: veicoli, aree di sosta, promozioni, aree di restrizione.
    Cancella: utenti, corse, transazioni, messaggi, segnalazioni.
    Usare con: docker exec smart_mobility_api python -c "from app.seed import *; from app.database import SessionLocal; db=SessionLocal(); reset_and_reseed(db); db.close()"
    """
    from .models import Segnalazione, Message, WalletTransaction, PaymentMethod
    # Ordine: dipendenze prima
    db.execute(delete(Segnalazione))
    db.execute(delete(Message))
    db.execute(delete(WalletTransaction))
    db.execute(delete(PaymentMethod))
    db.execute(delete(Ride))
    db.execute(delete(User))
    # Resetta stato veicoli
    for v in db.query(Vehicle).all():
        v.status = "available"
    db.commit()
    # Risemina utenti e dati correlati
    seed(db)
    print("[reset_and_reseed] DB azzerato e riseminato con dati puliti.")


def seed(db: Session) -> None:
    # Prima di tutto: riporta a terra eventuali veicoli già nel DB finiti in mare.
    fix_sea_vehicles(db)

    if db.query(Vehicle).count() == 0:
        for i in range(40):
            vtype, name, model, fee, ppm = TYPES[i % len(TYPES)]
            coord = rand_land_coord()
            if coord is None:
                print(f"[seed][warn] Nessuna coordinata valida (on land) trovata dopo "
                      f"{MAX_COORD_ATTEMPTS} tentativi per il veicolo {name}-{i+1:02d}: saltato.")
                continue
            lat, lng = coord
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
        db.commit()

    ensure_electric_cars(db)

    ensure_parking_areas(db)

    if db.query(Promotion).count() == 0:
        for p in PROMOTIONS:
            db.add(Promotion(**p))

    if db.query(AreaRestrizione).count() == 0:
        aree = [
            ("ZTL Centro Storico", "ZTL", 41.1258, 16.8690, 350, ["scooter", "ebike", "car"], "08:00-20:00"),
            ("Zona pedonale Sparano", "PEDONALE", 41.1210, 16.8688, 180, [], None),
            ("No-parking Lungomare", "NO_PARKING", 41.1205, 16.8765, 220, ["scooter", "car"], None),
            ("Area vietata Porto", "NO_GO", 41.1320, 16.8650, 300, [], None),
            ("Limite velocità Università", "LIMITE_VELOCITA", 41.1085, 16.8800, 250, ["scooter", "ebike", "car"], None),
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
        ("car", "Stazione Centrale", "Corso Italia", 1.8, 9, 4.90, 12, _ago(days=1)),
        ("ebike", "Piazza Garibaldi", "Viale Europa", 3.2, 18, 4.50, 24, _ago(days=10)),
        ("scooter", "Via Napoli 5", "Università", 2.1, 11, 3.20, 16, _ago(days=12)),
        ("car", "Casa", "Lavoro", 4.1, 22, 8.90, 30, _ago(days=15)),
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