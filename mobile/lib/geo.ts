// lib/geo.ts
// Primitive geografiche condivise (View). Nessuna dipendenza esterna.

export interface Coords {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;

/**
 * Distanza in metri tra due coordinate (formula dell'emisenoverso / haversine).
 * Usata per calcolare la distanza utente→mezzo mostrata nel pannello di dettaglio (CU-02 passo 6).
 */
export function haversineMeters(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Formattazione leggibile della distanza: "120 m" oppure "1,4 km" (locale IT). */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Minuti di cammino stimati (~80 m/min, andatura urbana). Stima, non garanzia (IIN-1). */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80));
}
