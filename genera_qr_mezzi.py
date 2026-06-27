"""
genera_qr_mezzi.py — Genera un PDF con i QR code di sblocco per ogni mezzo della flotta.

Esecuzione (dal terminale, nella cartella Smart_Mobility_SERLAB):
    pip install qrcode reportlab pillow psycopg2-binary
    python genera_qr_mezzi.py

Oppure dentro Docker (se preferisci):
    docker exec smart_mobility_api python /app/../genera_qr_mezzi.py

Il PDF viene salvato nella stessa cartella: qr_mezzi.pdf
"""

import io
import os
import sys

# ─── Dipendenze ───────────────────────────────────────────────────────────────
try:
    import qrcode
    from PIL import Image
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas
    import psycopg2
except ImportError:
    print("Installa le dipendenze con:")
    print("  pip install qrcode reportlab pillow psycopg2-binary")
    sys.exit(1)

# ─── Configurazione ───────────────────────────────────────────────────────────
DB_URL  = os.environ.get(
    "DATABASE_URL",
    "postgresql://smartmobility:secret@localhost:5432/smartmobility",
)
OUT_PDF = os.path.join(os.path.dirname(__file__), "qr_mezzi.pdf")

VEHICLE_LABEL = {
    "scooter": "Monopattino Elettrico",
    "ebike":   "Bici Elettrica",
    "car":     "Auto Elettrica",
}

# ─── Fetch veicoli dal DB ─────────────────────────────────────────────────────
def fetch_vehicles():
    try:
        conn = psycopg2.connect(DB_URL)
    except Exception as e:
        print(f"[ERRORE] Impossibile connettersi al DB: {e}")
        print("Assicurati che docker compose sia avviato e porta 5432 sia esposta.")
        sys.exit(1)
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, model, type, battery_pct, status "
                "FROM vehicles ORDER BY id"
            )
            rows = cur.fetchall()
    conn.close()
    return [
        {"id": r[0], "name": r[1], "model": r[2],
         "type": r[3], "battery_pct": r[4], "status": r[5]}
        for r in rows
    ]

# ─── Genera immagine QR (PNG in memoria) ─────────────────────────────────────
def make_qr_image(content: str, size_px: int = 200) -> Image.Image:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(content)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    img = img.resize((size_px, size_px), Image.LANCZOS)
    return img

# ─── Helper: immagine PIL → bytes leggibili da ReportLab ─────────────────────
def pil_to_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

# ─── Genera PDF ───────────────────────────────────────────────────────────────
def generate_pdf(vehicles):
    PAGE_W, PAGE_H = A4                # 595 x 842 pt
    MARGIN         = 1.5 * cm
    COLS           = 3
    CARD_W         = (PAGE_W - 2 * MARGIN) / COLS
    CARD_H         = 7.5 * cm
    QR_SIZE        = 3.5 * cm
    HEADER_H       = 2.0 * cm

    c = canvas.Canvas(OUT_PDF, pagesize=A4)
    c.setTitle("QR Code Flotta SmartMobility")

    # ── Copertina ──────────────────────────────────────────────────────────────
    c.setFillColor(colors.HexColor("#0D0D1A"))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    c.setFillColor(colors.HexColor("#7C3AED"))
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.62, "SmartMobility")

    c.setFillColor(colors.white)
    c.setFont("Helvetica", 16)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.56, "Codici QR di sblocco — Flotta veicoli")

    c.setFillColor(colors.HexColor("#A78BFA"))
    c.setFont("Helvetica", 12)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.50, f"Totale mezzi: {len(vehicles)}")

    import datetime
    c.setFillColor(colors.HexColor("#6B7280"))
    c.setFont("Helvetica", 10)
    today = datetime.date.today().strftime("%d/%m/%Y")
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.44, f"Generato il {today}")

    c.showPage()

    # ── Pagine con card veicoli ────────────────────────────────────────────────
    total_rows = -(-len(vehicles) // COLS)   # ceil division
    ROWS_PER_PAGE = int((PAGE_H - HEADER_H - MARGIN) // CARD_H)

    idx = 0
    while idx < len(vehicles):
        # Header pagina
        c.setFillColor(colors.HexColor("#0D0D1A"))
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

        c.setFillColor(colors.HexColor("#7C3AED"))
        c.rect(0, PAGE_H - HEADER_H, PAGE_W, HEADER_H, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(PAGE_W / 2, PAGE_H - HEADER_H + 0.55 * cm, "SmartMobility — Codici QR Flotta")

        # Griglia card
        row_start_y = PAGE_H - HEADER_H - MARGIN
        rows_drawn = 0

        while idx < len(vehicles) and rows_drawn < ROWS_PER_PAGE:
            for col in range(COLS):
                if idx >= len(vehicles):
                    break
                v = vehicles[idx]
                idx += 1

                x = MARGIN + col * CARD_W
                y = row_start_y - (rows_drawn + 1) * CARD_H

                # Sfondo card
                c.setFillColor(colors.HexColor("#1A1A2E"))
                c.setStrokeColor(colors.HexColor("#7C3AED"))
                c.setLineWidth(0.8)
                c.roundRect(x + 4, y + 4, CARD_W - 8, CARD_H - 8, 8, fill=1, stroke=1)

                # QR code
                qr_content = f"SM-{v['id']}"
                qr_img = make_qr_image(qr_content, size_px=280)
                qr_bytes = pil_to_bytes(qr_img)
                qr_x = x + (CARD_W - QR_SIZE) / 2
                qr_y = y + CARD_H - QR_SIZE - 0.6 * cm
                c.drawImage(
                    io.BytesIO(qr_bytes),
                    qr_x, qr_y, width=QR_SIZE, height=QR_SIZE,
                    preserveAspectRatio=True,
                )

                # Codice SM-XX (grande)
                c.setFillColor(colors.HexColor("#A78BFA"))
                c.setFont("Helvetica-Bold", 14)
                c.drawCentredString(x + CARD_W / 2, qr_y - 0.55 * cm, qr_content)

                # Tipo veicolo
                c.setFillColor(colors.white)
                c.setFont("Helvetica-Bold", 9)
                tipo_label = VEHICLE_LABEL.get(v["type"], v["type"])
                c.drawCentredString(x + CARD_W / 2, qr_y - 1.05 * cm, tipo_label)

                # Nome modello
                c.setFillColor(colors.HexColor("#9CA3AF"))
                c.setFont("Helvetica", 8)
                c.drawCentredString(
                    x + CARD_W / 2, qr_y - 1.45 * cm,
                    f"{v['name']} · {v['model']}"
                )

                # Stato batteria
                bat = v["battery_pct"]
                bat_color = "#10B981" if bat >= 60 else "#F59E0B" if bat >= 30 else "#EF4444"
                c.setFillColor(colors.HexColor(bat_color))
                c.setFont("Helvetica", 7.5)
                c.drawCentredString(x + CARD_W / 2, qr_y - 1.85 * cm, f"🔋 {bat}%")

            rows_drawn += 1

        c.showPage()

    c.save()
    print(f"✅ PDF generato: {OUT_PDF}")
    print(f"   Mezzi inclusi: {len(vehicles)}")


# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Connessione al database...")
    vehicles = fetch_vehicles()
    print(f"Trovati {len(vehicles)} veicoli. Generazione PDF...")
    generate_pdf(vehicles)
