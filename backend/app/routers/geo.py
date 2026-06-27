"""Geocoding (OpenStreetMap Nominatim) e routing (OSRM demo). Servizi gratuiti, senza chiave."""
import json
import math
import urllib.parse
import urllib.request

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AreaRestrizione
from ..schemas import GeocodeResult, RouteOption, RoutePoint

router = APIRouter(tags=["geo"])

# Nominatim richiede un User-Agent identificativo.
_HEADERS = {"User-Agent": "SmartMobility-SERLAB/1.0 (university project)"}
_TIMEOUT = 10

# Velocità media di marcia per tipo di mezzo (km/h) → stima tempo di percorrenza.
_SPEED_KMH = {"scooter": 18.0, "ebike": 20.0, "car": 30.0}
# Tipi di area che vietano il transito (a differenza di NO_PARKING che riguarda solo la sosta).
_AREE_VIETATE_TRANSITO = {"NO_GO", "ZTL", "PEDONALE"}


def _http_get_json(url: str):
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        return json.loads(resp.read())


def _meters(lat1, lng1, lat2, lng2) -> float:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@router.get("/geocode", response_model=list[GeocodeResult])
def geocode(q: str = Query(min_length=2)):
    """Cerca indirizzi/luoghi e restituisce label + coordinate."""
    params = urllib.parse.urlencode({"q": q, "format": "json", "limit": 5, "addressdetails": 0})
    try:
        data = _http_get_json(f"https://nominatim.openstreetmap.org/search?{params}")
    except Exception:
        return []
    results: list[GeocodeResult] = []
    for item in data:
        try:
            results.append(GeocodeResult(
                label=item["display_name"],
                lat=float(item["lat"]),
                lng=float(item["lon"]),
            ))
        except (KeyError, ValueError):
            continue
    return results


@router.get("/route", response_model=list[RoutePoint])
def route(from_lat: float, from_lng: float, to_lat: float, to_lng: float):
    """Percorso stradale tra due punti (OSRM). Lista vuota se non disponibile."""
    coords = f"{from_lng},{from_lat};{to_lng},{to_lat}"
    url = f"https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson"
    try:
        data = _http_get_json(url)
        line = data["routes"][0]["geometry"]["coordinates"]  # [[lng, lat], ...]
    except Exception:
        return []
    return [RoutePoint(latitude=lat, longitude=lng) for lng, lat in line]


def _aree_attraversate(line: list[list[float]], aree, vehicle_type: str) -> list[str]:
    """Nomi delle aree (vietate al transito per il tipo di mezzo) attraversate dal percorso.
    `line` è una lista di coppie [lng, lat] (formato OSRM/GeoJSON)."""
    colpite: list[str] = []
    for a in aree:
        if a.tipo not in _AREE_VIETATE_TRANSITO:
            continue
        # vehicle_types vuoto = vale per tutti; altrimenti solo per i tipi elencati.
        if a.vehicle_types and vehicle_type not in a.vehicle_types:
            continue
        for lng, lat in line:
            if _meters(lat, lng, a.lat, a.lng) <= a.radius_m:
                colpite.append(a.nome)
                break
    return colpite


@router.get("/route/options", response_model=list[RouteOption])
def route_options(
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    vehicle_type: str = Query(default="scooter"),
    db: Session = Depends(get_db),
):
    """Alternative di percorso per un tipo di mezzo, valutate sui vincoli geografici (aree
    di restrizione attive). La prima opzione è il percorso ottimale (più breve e consentito)."""
    coords = f"{from_lng},{from_lat};{to_lng},{to_lat}"
    url = (
        f"https://router.project-osrm.org/route/v1/driving/{coords}"
        "?overview=full&geometries=geojson&alternatives=3"
    )
    try:
        data = _http_get_json(url)
        routes = data["routes"]
    except Exception:
        return []

    aree = db.query(AreaRestrizione).filter(AreaRestrizione.attiva.is_(True)).all()
    speed = _SPEED_KMH.get(vehicle_type, 16.0)

    options: list[RouteOption] = []
    for r in routes:
        line = r["geometry"]["coordinates"]  # [[lng, lat], ...]
        dist_m = float(r.get("distance", 0.0))
        vietate = _aree_attraversate(line, aree, vehicle_type)
        duration_min = max(1, round((dist_m / 1000) / speed * 60))
        options.append(RouteOption(
            points=[RoutePoint(latitude=lat, longitude=lng) for lng, lat in line],
            distance_m=round(dist_m, 1),
            duration_min=duration_min,
            restricted=bool(vietate),
            aree_vietate=vietate,
            label="",  # assegnata dopo l'ordinamento
        ))

    # Ordina: prima i percorsi senza violazioni, poi per distanza crescente.
    options.sort(key=lambda o: (o.restricted, o.distance_m))
    for i, o in enumerate(options):
        if i == 0:
            o.label = "Percorso consigliato" if not o.restricted else "Più breve (con restrizioni)"
        else:
            o.label = f"Alternativa {i}" + (" (con restrizioni)" if o.restricted else "")
    return options
