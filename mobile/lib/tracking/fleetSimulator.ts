// lib/tracking/fleetSimulator.ts
// SIMULAZIONE di monitoraggio flotta in tempo reale (UC tracciamento operatore).
//
// In un sistema reale i mezzi "in uso" invierebbero la loro posizione GPS live.
// Non potendo realizzarlo IRL, questo script muove un set di veicoli FITTIZI
// (dati hardcoded, id 'sim-*') lungo percorsi stradali reali di Bari, a velocità
// realistiche per tipo. NB: questi veicoli NON esistono nel database e non sono
// in alcun modo prelevabili/utilizzabili — servono solo a simulare la pagina.

import { useEffect, useRef, useState } from 'react';
import { geoApi } from '@/lib/api/endpoints';
import { haversineMeters } from '@/lib/geo';

export type SimType = 'scooter' | 'ebike' | 'car';

export interface SimVehicle {
  id: string;
  name: string;
  type: SimType;
  lat: number;
  lng: number;
  heading: number;     // gradi (0=N), direzione di marcia
  speedKmh: number;
  batteryPct: number;
}

interface Pt { latitude: number; longitude: number; }

// Punti notevoli di Bari (terraferma) usati come destinazioni dei percorsi.
const BARI_POIS: Pt[] = [
  { latitude: 41.1171, longitude: 16.8693 }, // Piazza Aldo Moro
  { latitude: 41.1235, longitude: 16.8705 }, // Teatro Petruzzelli
  { latitude: 41.1208, longitude: 16.8760 }, // Lungomare N. Sauro
  { latitude: 41.1085, longitude: 16.8800 }, // Politecnico
  { latitude: 41.1108, longitude: 16.8770 }, // Università
  { latitude: 41.1090, longitude: 16.8655 }, // Via Napoli
  { latitude: 41.0990, longitude: 16.8720 }, // Japigia
  { latitude: 41.1150, longitude: 16.8620 }, // Quartiere Libertà
  { latitude: 41.1280, longitude: 16.8680 }, // Bari Vecchia
  { latitude: 41.1330, longitude: 16.8500 }, // San Girolamo / Fesca
];

// Velocità di marcia realistiche per tipo (km/h).
const SPEED: Record<SimType, number> = { scooter: 18, ebike: 22, car: 32 };

// Flotta simulata — HARDCODED, NON nel database (id 'sim-*').
const SIM_FLEET: { id: string; name: string; type: SimType }[] = [
  { id: 'sim-1', name: 'Sim Monopattino A1', type: 'scooter' },
  { id: 'sim-2', name: 'Sim Monopattino A2', type: 'scooter' },
  { id: 'sim-3', name: 'Sim Monopattino A3', type: 'scooter' },
  { id: 'sim-4', name: 'Sim E-Bike B1',      type: 'ebike' },
  { id: 'sim-5', name: 'Sim E-Bike B2',      type: 'ebike' },
  { id: 'sim-6', name: 'Sim Auto C1',        type: 'car' },
  { id: 'sim-7', name: 'Sim Auto C2',        type: 'car' },
  { id: 'sim-8', name: 'Sim Auto C3',        type: 'car' },
];

const TICK_MS = 500;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

function bearing(a: Pt, b: Pt): number {
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function randomPoi(): Pt {
  return BARI_POIS[Math.floor(Math.random() * BARI_POIS.length)];
}

interface SimState {
  id: string;
  name: string;
  type: SimType;
  speedKmh: number;
  batteryPct: number;
  lat: number;
  lng: number;
  heading: number;
  route: Pt[];
  seg: number;        // indice del segmento corrente nel route
  segMeters: number;  // metri già percorsi nel segmento corrente
  routing: boolean;   // richiesta percorso in corso
}

/**
 * Hook che restituisce la posizione live dei veicoli simulati, aggiornata in
 * tempo reale. Si avvia al mount e si ferma al unmount (cleanup completo).
 */
export function useFleetSimulation(): SimVehicle[] {
  const [vehicles, setVehicles] = useState<SimVehicle[]>([]);
  const simsRef = useRef<SimState[]>([]);

  useEffect(() => {
    let alive = true;

    const sims: SimState[] = SIM_FLEET.map((f, i) => {
      const start = BARI_POIS[i % BARI_POIS.length];
      return {
        ...f,
        speedKmh: SPEED[f.type],
        batteryPct: 45 + Math.floor(Math.random() * 55),
        lat: start.latitude,
        lng: start.longitude,
        heading: 0,
        route: [],
        seg: 0,
        segMeters: 0,
        routing: false,
      };
    });
    simsRef.current = sims;

    // Chiede un nuovo percorso stradale dalla posizione attuale a un POI casuale.
    const ensureRoute = (s: SimState) => {
      if (s.routing) return;
      s.routing = true;
      const from = { lat: s.lat, lng: s.lng };
      const dest = randomPoi();
      geoApi.route(from, { lat: dest.latitude, lng: dest.longitude })
        .then((pts) => {
          if (!alive) return;
          s.route = pts && pts.length > 1
            ? pts
            : [{ latitude: s.lat, longitude: s.lng }, dest]; // fallback linea retta
          s.seg = 0;
          s.segMeters = 0;
        })
        .catch(() => {
          if (!alive) return;
          s.route = [{ latitude: s.lat, longitude: s.lng }, dest];
          s.seg = 0;
          s.segMeters = 0;
        })
        .finally(() => { s.routing = false; });
    };

    sims.forEach(ensureRoute);

    const dt = TICK_MS / 1000;
    const interval = setInterval(() => {
      for (const s of simsRef.current) {
        if (s.route.length < 2) { ensureRoute(s); continue; }

        let move = (s.speedKmh * 1000 / 3600) * dt; // metri da percorrere in questo tick
        while (move > 0 && s.seg < s.route.length - 1) {
          const a = s.route[s.seg];
          const b = s.route[s.seg + 1];
          const segLen = haversineMeters(a, b) || 0.0001;
          const remain = segLen - s.segMeters;
          if (move < remain) { s.segMeters += move; move = 0; }
          else { move -= remain; s.seg++; s.segMeters = 0; }
        }

        if (s.seg >= s.route.length - 1) {
          // Arrivato a destinazione: aggancia l'ultimo punto e cerca una nuova meta.
          const last = s.route[s.route.length - 1];
          s.lat = last.latitude;
          s.lng = last.longitude;
          ensureRoute(s);
        } else {
          const a = s.route[s.seg];
          const b = s.route[s.seg + 1];
          const segLen = haversineMeters(a, b) || 0.0001;
          const f = Math.min(1, s.segMeters / segLen);
          s.lat = a.latitude + (b.latitude - a.latitude) * f;
          s.lng = a.longitude + (b.longitude - a.longitude) * f;
          s.heading = bearing(a, b);
        }

        // Consumo batteria graduale; "ricarica" virtuale quando troppo bassa.
        s.batteryPct = s.batteryPct <= 6 ? 100 : s.batteryPct - 0.02;
      }

      setVehicles(simsRef.current.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        lat: s.lat,
        lng: s.lng,
        heading: s.heading,
        speedKmh: s.speedKmh,
        batteryPct: Math.round(s.batteryPct),
      })));
    }, TICK_MS);

    return () => { alive = false; clearInterval(interval); };
  }, []);

  return vehicles;
}
