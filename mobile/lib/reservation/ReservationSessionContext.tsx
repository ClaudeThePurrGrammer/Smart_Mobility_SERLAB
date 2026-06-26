import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { reservationsApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/AuthContext';
import type { ApiReservation } from '@/lib/api/types';

interface ReservationSessionState {
  reservation: ApiReservation | null;
  loading: boolean;
  startReservation: (res: ApiReservation) => void;
  clearReservation: () => void;
}

const ReservationSessionContext = createContext<ReservationSessionState>({
  reservation: null,
  loading: true,
  startReservation: () => {},
  clearReservation: () => {},
});

export function ReservationSessionProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [reservation, setReservation] = useState<ApiReservation | null>(null);
  const [loading, setLoading] = useState(true);

  // "initialized" impedisce il re-fetch (e il flash di loading) su ogni
  // cambio di token successivo al primo caricamento (es. dopo refreshUser).
  const initializedRef = useRef(false);
  // Traccia l'ultimo token con cui abbiamo fatto fetch per evitare duplicati.
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Nessun token → utente non loggato: reset pulito, nessun fetch.
    if (!token) {
      setReservation(null);
      setLoading(false);
      initializedRef.current = false;
      lastTokenRef.current = null;
      return;
    }

    // Già inizializzato con questo stesso token → non rifetchare.
    // Evita il loop causato da refreshUser() che emette lo stesso token.
    if (initializedRef.current && lastTokenRef.current === token) return;

    lastTokenRef.current = token;
    // Solo al primissimo fetch mostriamo loading=true.
    if (!initializedRef.current) setLoading(true);

    let cancelled = false;
    reservationsApi.getActive(token)
      .then((res) => {
        if (cancelled) return;
        // Se la prenotazione è già scaduta lato client, trattala come null.
        if (res && new Date(res.ora_scadenza).getTime() < Date.now()) {
          setReservation(null);
        } else {
          setReservation(res);
        }
      })
      .catch(() => {
        if (!cancelled) setReservation(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          initializedRef.current = true;
        }
      });

    return () => { cancelled = true; };
  }, [token]);

  const startReservation = useCallback((res: ApiReservation) => {
    setReservation(res);
  }, []);

  const clearReservation = useCallback(() => {
    setReservation(null);
    // Non resettiamo initializedRef: l'utente è loggato, non ha più prenotazioni.
  }, []);

  return (
    <ReservationSessionContext.Provider value={{ reservation, loading, startReservation, clearReservation }}>
      {children}
    </ReservationSessionContext.Provider>
  );
}

export function useReservationSession() {
  return useContext(ReservationSessionContext);
}
