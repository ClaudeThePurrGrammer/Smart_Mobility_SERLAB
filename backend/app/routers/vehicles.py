"""Mezzi disponibili sulla mappa (CU-02)."""
import io
import math
import random

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import ParkingArea, User, Vehicle
from ..schemas import ParkVehicleIn, VehicleOut

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

_VEHICLE_LABEL = {
    "scooter": "Monopattino Elettrico",
    "ebike":   "Bici Elettrica",
    "car":     "Auto Elettrica",
}

# Ampiezza del drift GPS simulato ad ogni refresh (~10 m).
_DRIFT = 0.0001
SUPPORTED_VEHICLE_TYPES = ("scooter", "ebike", "car")


@router.get("", response_model=list[VehicleOut])
def list_vehicles(
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    only_available: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    q = db.query(Vehicle).filter(Vehicle.type.in_(SUPPORTED_VEHICLE_TYPES))
    if only_available:
        # Solo i veicoli parcheggiati e non bloccati sono prelevabili dall'utente.
        q = q.filter(Vehicle.status == "parked", Vehicle.locked == False)  # noqa: E712
    vehicles = q.order_by(Vehicle.id).all()

    # ── Spawn near user ────────────────────────────────────────────────────────
    # Se l'utente ha inviato la posizione GPS e meno di 12 veicoli sono entro
    # ~1.2 km, ne spostiamo alcuni nelle aree di parcheggio più vicine a lui.
    if lat is not None and lng is not None and vehicles:
        NEAR = 0.011  # ~1.2 km in gradi

        def dist2(v_lat, v_lng):
            return (v_lat - lat) ** 2 + (v_lng - lng) ** 2

        nearby = [v for v in vehicles if dist2(v.lat, v.lng) < NEAR ** 2]

        if len(nearby) < 12:
            # Prendi le 8 aree di parcheggio geograficamente più vicine all'utente.
            all_areas = db.query(ParkingArea).all()
            close_areas = sorted(
                all_areas,
                key=lambda a: dist2(a.lat, a.lng),
            )[:8]

            far = [v for v in vehicles if dist2(v.lat, v.lng) >= NEAR ** 2]
            random.shuffle(far)
            to_move = far[: max(0, 12 - len(nearby))]
            for i, v in enumerate(to_move):
                if close_areas:
                    area = close_areas[i % len(close_areas)]
                    v.lat, v.lng = _rand_coord_in_area(area.lat, area.lng, area.radius_m)
                else:
                    v.lat = round(lat + random.uniform(-0.008, 0.008), 6)
                    v.lng = round(lng + random.uniform(-0.008, 0.008), 6)
            if to_move:
                db.commit()
                for v in to_move:
                    db.refresh(v)

    return vehicles


@router.get("/qr-export")
def export_qr_pdf(db: Session = Depends(get_db)):
    """Genera e scarica un PDF con i QR code di sblocco di tutti i mezzi della flotta."""
    import datetime
    try:
        import qrcode
        from PIL import Image
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.lib.utils import ImageReader
        from reportlab.pdfgen import canvas as rl_canvas
    except ImportError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            f"Librerie PDF mancanti ({exc}). Esegui: docker compose up --build backend -d",
        )

    vehicles = (
        db.query(Vehicle)
        .filter(Vehicle.type.in_(SUPPORTED_VEHICLE_TYPES))
        .order_by(Vehicle.id)
        .all()
    )

    # ── Helper: genera immagine QR come ImageReader per reportlab ──────────────
    def make_qr_image_reader(content: str) -> "ImageReader":
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(content)
        qr.make(fit=True)
        pil_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
        pil_img = pil_img.resize((280, 280), Image.LANCZOS)
        buf_img = io.BytesIO()
        pil_img.save(buf_img, format="PNG")
        buf_img.seek(0)
        return ImageReader(buf_img)   # ← wrap corretto per reportlab

    # ── Impostazioni layout ────────────────────────────────────────────────────
    buf = io.BytesIO()
    PAGE_W, PAGE_H = A4
    MARGIN        = 1.5 * cm
    COLS          = 3
    CARD_W        = (PAGE_W - 2 * MARGIN) / COLS
    CARD_H        = 7.5 * cm
    QR_SIZE       = 3.4 * cm
    HEADER_H      = 1.8 * cm
    ROWS_PER_PAGE = int((PAGE_H - HEADER_H - MARGIN * 2) // CARD_H)

    c = rl_canvas.Canvas(buf, pagesize=A4)
    c.setTitle("QR Code Flotta SmartMobility")

    # ── Copertina ──────────────────────────────────────────────────────────────
    c.setFillColor(colors.HexColor("#0D0D1A"))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#7C3AED"))
    c.setFont("Helvetica-Bold", 30)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.62, "SmartMobility")
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 17)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.56, "Codici QR di sblocco — Flotta mezzi")
    c.setFillColor(colors.HexColor("#A78BFA"))
    c.setFont("Helvetica", 13)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.50, f"Totale mezzi: {len(vehicles)}")
    c.setFillColor(colors.HexColor("#6B7280"))
    c.setFont("Helvetica", 10)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.44,
                        f"Generato il {datetime.date.today().strftime('%d/%m/%Y')}")
    c.showPage()

    # ── Pagine con card veicoli ────────────────────────────────────────────────
    idx = 0
    while idx < len(vehicles):
        c.setFillColor(colors.HexColor("#0D0D1A"))
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        # header banda viola
        c.setFillColor(colors.HexColor("#7C3AED"))
        c.rect(0, PAGE_H - HEADER_H, PAGE_W, HEADER_H, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(PAGE_W / 2, PAGE_H - HEADER_H + 0.5 * cm,
                            "SmartMobility — Codici QR Flotta")

        row_start_y = PAGE_H - HEADER_H - MARGIN
        rows_drawn  = 0
        while idx < len(vehicles) and rows_drawn < ROWS_PER_PAGE:
            for col in range(COLS):
                if idx >= len(vehicles):
                    break
                v    = vehicles[idx]; idx += 1
                x    = MARGIN + col * CARD_W
                y    = row_start_y - (rows_drawn + 1) * CARD_H
                # sfondo card
                c.setFillColor(colors.HexColor("#1A1A2E"))
                c.setStrokeColor(colors.HexColor("#7C3AED"))
                c.setLineWidth(0.8)
                c.roundRect(x + 4, y + 4, CARD_W - 8, CARD_H - 8, 8, fill=1, stroke=1)
                # QR image
                qr_code = f"SM-{v.id}"
                qr_reader = make_qr_image_reader(qr_code)
                qr_x = x + (CARD_W - QR_SIZE) / 2
                qr_y = y + CARD_H - QR_SIZE - 0.55 * cm
                c.drawImage(qr_reader, qr_x, qr_y, width=QR_SIZE, height=QR_SIZE, mask="auto")
                # codice SM-XX
                c.setFillColor(colors.HexColor("#A78BFA"))
                c.setFont("Helvetica-Bold", 13)
                c.drawCentredString(x + CARD_W / 2, qr_y - 0.50 * cm, qr_code)
                # tipo
                c.setFillColor(colors.white)
                c.setFont("Helvetica-Bold", 8)
                c.drawCentredString(x + CARD_W / 2, qr_y - 0.95 * cm,
                                    _VEHICLE_LABEL.get(v.type, v.type))
                # nome · modello
                c.setFillColor(colors.HexColor("#9CA3AF"))
                c.setFont("Helvetica", 7.5)
                c.drawCentredString(x + CARD_W / 2, qr_y - 1.35 * cm,
                                    f"{v.name}  ·  {v.model}")
                # batteria
                bat_col = ("#10B981" if v.battery_pct >= 60
                           else "#F59E0B" if v.battery_pct >= 30 else "#EF4444")
                c.setFillColor(colors.HexColor(bat_col))
                c.setFont("Helvetica", 7)
                c.drawCentredString(x + CARD_W / 2, qr_y - 1.72 * cm,
                                    f"Batteria: {v.battery_pct}%")
            rows_drawn += 1
        c.showPage()

    c.save()
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=qr_mezzi.pdf"},
    )


def _rand_coord_in_area(lat: float, lng: float, radius_m: int) -> tuple[float, float]:
    """Coordinate casuali all'interno di un'area circolare (raggio in metri)."""
    radius_deg = (radius_m * 0.85) / 111_000
    angle = random.uniform(0, 2 * math.pi)
    dist  = random.uniform(0, radius_deg)
    return (
        round(lat + dist * math.cos(angle), 6),
        round(lng + dist * math.sin(angle), 6),
    )


@router.patch("/{vehicle_id}/park", response_model=VehicleOut)
def park_vehicle(
    vehicle_id: int,
    data: ParkVehicleIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Parcheggia il mezzo in un'area di sosta specifica dopo la fine corsa.

    Posiziona il veicolo a coordinate casuali all'interno del raggio dell'area,
    imposta status='parked' e aggiorna il contatore occupied dell'area.
    """
    vehicle = db.get(Vehicle, vehicle_id)
    if not vehicle or vehicle.type not in SUPPORTED_VEHICLE_TYPES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mezzo non trovato")
    area = db.get(ParkingArea, data.parking_area_id)
    if not area:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Area di parcheggio non trovata")

    lat, lng = _rand_coord_in_area(area.lat, area.lng, area.radius_m)
    vehicle.lat = lat
    vehicle.lng = lng
    vehicle.status = "parked"
    if area.occupied < area.capacity:
        area.occupied += 1

    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    v = db.get(Vehicle, vehicle_id)
    if not v or v.type not in SUPPORTED_VEHICLE_TYPES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mezzo non trovato")
    return v
