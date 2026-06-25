import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ridesApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/AuthContext';
import type { ApiRide } from '@/lib/api/types';

interface RideSession {
  rideId:      number;
  vehicleId:   number;
  vehicleType: string;
  startedAtMs: number;  // real timestamp from DB (ride.started_at parsed to ms)
}

interface RideSessionContextValue {
  session:      RideSession | null;
  loading:      boolean;
  startSession: (ride: ApiRide) => void;  // takes full ride object from backend
  endSession:   () => void;
}

const RideSessionContext = createContext<RideSessionContextValue>({
  session: null, loading: true,
  startSession: () => {}, endSession: () => {},
});

export function RideSessionProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [session, setSession] = useState<RideSession | null>(null);
  const [loading, setLoading]  = useState(true);

  // Reconciliation: check DB once on mount if user is authenticated.
  // This restores the session if app was closed during an active ride.
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    ridesApi.active(token)
      .then((ride) => {
        if (ride) {
          setSession({
            rideId:      ride.id,
            vehicleId:   ride.vehicle_id ?? 0,
            vehicleType: ride.vehicle_type,
            startedAtMs: new Date(ride.started_at).getTime(),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const startSession = useCallback((ride: ApiRide) => {
    setSession({
      rideId:      ride.id,
      vehicleId:   ride.vehicle_id ?? 0,
      vehicleType: ride.vehicle_type,
      startedAtMs: new Date(ride.started_at).getTime(),
    });
  }, []);

  const endSession = useCallback(() => setSession(null), []);

  return (
    <RideSessionContext.Provider value={{ session, loading, startSession, endSession }}>
      {children}
    </RideSessionContext.Provider>
  );
}

export function useRideSession() {
  return useContext(RideSessionContext);
}
