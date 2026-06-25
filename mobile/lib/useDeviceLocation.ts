// lib/useDeviceLocation.ts
// Task 2 — Geolocalizzazione del dispositivo (CU-02 passo 2).
// Gestisce permessi foreground, posizione one-shot e fallback SA-02a (posizione manuale).

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import type { Coords } from './geo';

export type LocationStatus =
  | 'idle'      // non ancora richiesto
  | 'loading'   // richiesta in corso
  | 'granted'   // posizione disponibile (GPS o manuale)
  | 'denied'    // permesso negato → SA-02a
  | 'error';    // GPS non disponibile / timeout → SA-02a

export interface DeviceLocation {
  coords: Coords | null;
  status: LocationStatus;
  error: string | null;
  /** Sorgente della posizione corrente: utile per mostrare badge "posizione manuale". */
  source: 'gps' | 'manual' | null;
  /** Ritenta la geolocalizzazione GPS. */
  locate: () => Promise<void>;
  /** SA-02a: imposta manualmente la posizione (es. da indirizzo geocodificato). */
  setManualCoords: (c: Coords) => void;
  /** SA-02a: geocodifica un indirizzo testuale in coordinate. */
  geocodeAddress: (address: string) => Promise<Coords | null>;
}

export function useDeviceLocation(): DeviceLocation {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [error, setError]   = useState<string | null>(null);
  const [source, setSource] = useState<'gps' | 'manual' | null>(null);

  const locate = useCallback(async () => {
    try {
      setStatus('loading');
      setError(null);

      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setStatus('denied');
        setError('Permesso di localizzazione negato.');
        return;
      }

      // Posizione ISTANTANEA: l'ultima nota in cache è disponibile subito (no fix GPS).
      // Sblocca subito mappa e spawn dei mezzi senza attendere il fix preciso.
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setCoords({ latitude: last.coords.latitude, longitude: last.coords.longitude });
        setSource('gps');
        setStatus('granted');
      }

      // Affinamento: fix GPS ad alta precisione (aggiorna le coordinate quando pronto).
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // target ±5 m in ambiente urbano (IIN-1)
      });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setSource('gps');
      setStatus('granted');
    } catch (e: any) {
      setStatus('error');
      setError(e?.message ?? 'Posizione GPS non disponibile.');
    }
  }, []);

  const setManualCoords = useCallback((c: Coords) => {
    setCoords(c);
    setSource('manual');
    setStatus('granted');
    setError(null);
  }, []);

  const geocodeAddress = useCallback(async (address: string): Promise<Coords | null> => {
    try {
      // [DA VERIFICARE] Location.geocodeAsync usa il geocoder di sistema; su alcune
      // configurazioni Android può richiedere Google Play Services / chiave API.
      const results = await Location.geocodeAsync(address);
      if (!results.length) return null;
      return { latitude: results[0].latitude, longitude: results[0].longitude };
    } catch {
      return null;
    }
  }, []);

  // One-shot al mount. // [DA VERIFICARE] Se servirà tracking continuo durante la
  // corsa, sostituire con Location.watchPositionAsync e relativo cleanup.
  useEffect(() => {
    locate();
  }, [locate]);

  return { coords, status, error, source, locate, setManualCoords, geocodeAddress };
}
