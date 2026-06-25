import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRideSession } from '@/lib/ride/RideSessionContext';
import { ridesApi, geoApi, vehiclesApi } from '@/lib/api/endpoints';
import { vehicleIcon, vehicleTypeLabel } from '@/lib/vehicles';
import type { VehicleType } from '@/components/ui/VehicleCard';
import type { ApiVehicle, ApiRide } from '@/lib/api/types';


export default function ActiveRideScreen() {
  const { token, refreshUser } = useAuth();
  const { endSession } = useRideSession();
  const params = useLocalSearchParams<{ rideId?: string; fromLat?: string; fromLng?: string; toLat?: string; toLng?: string; dest?: string; durMin?: string; km?: string; paused?: string; vehicleId?: string }>();
  const { rideId, fromLat, fromLng, toLat, toLng, dest, vehicleId } = params;
  const destMin = params.durMin ? Number(params.durMin) : null;
  const destKm = params.km ? Number(params.km) : null;
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ending, setEnding] = useState(false);

  // Il tab screen rimane montato in memoria tra navigazioni (Expo Router Tabs).
  // Quando arriva una NUOVA corsa (rideId diverso), reset degli stati di controllo.
  // Gli stati di fetch (rideData, vehicle, routeCoords) vengono sovrascritti
  // automaticamente dai rispettivi useEffect quando rideId cambia.
  useEffect(() => {
    setEnding(false);
    setPaused(false);
    setSeconds(0);
  }, [rideId]);

  // Corsa attiva dal backend: started_at reale, vehicle_id, status.
  const [rideData, setRideData] = useState<ApiRide | null>(null);
  useEffect(() => {
    if (!token) return;
    ridesApi.active(token)
      .then((r) => { if (r) setRideData(r); })
      .catch(() => {});
  }, [token]);

  // Timer inizializzato dal started_at reale del DB (resync a ogni ritorno sulla schermata).
  useEffect(() => {
    if (!rideData?.started_at) return;
    const elapsed = Math.floor(
      (Date.now() - new Date(rideData.started_at).getTime()) / 1000
    );
    setSeconds(Math.max(0, elapsed));
  }, [rideData?.started_at]);

  // Sincronizza lo stato di pausa locale con quello del DB al caricamento.
  useEffect(() => {
    if (rideData?.status === 'paused') setPaused(true);
    else if (rideData?.status === 'active') setPaused(false);
  }, [rideData?.status]);

  // Veicolo reale della corsa (per icona, modello, batteria, tariffa).
  const [vehicle, setVehicle] = useState<ApiVehicle | null>(null);
  useEffect(() => {
    // Priorità: vehicleId dai param; fallback a vehicle_id della corsa recuperata.
    const id = vehicleId ?? rideData?.vehicle_id;
    if (!id) return;
    vehiclesApi.get(Number(id))
      .then(setVehicle)
      .catch(() => {});
  }, [vehicleId, rideData?.vehicle_id]);

  const pricePerMin = vehicle?.price_per_min ?? 0;
  const cost = ((seconds / 60) * pricePerMin).toFixed(2);

  const mapRef = useRef<MapView>(null);

  // Posizione di partenza reale dell'utente (passata dalla home), altrimenti fallback.
  const startCoords = (fromLat && fromLng)
    ? { latitude: Number(fromLat), longitude: Number(fromLng) }
    : { latitude: 41.1177, longitude: 16.8718 };

  // Percorso disegnato sulla mappa: calcolato via OSRM all'avvio.
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Destinazione: usa le coordinate passate dalla prenotazione se disponibili,
        // altrimenti geocodifica l'indirizzo di arrivo della corsa attiva.
        let destCoords = { lat: startCoords.latitude + 0.012, lng: startCoords.longitude + 0.010 };
        if (toLat && toLng) {
          destCoords = { lat: Number(toLat), lng: Number(toLng) };
        } else {
          const ride = token ? await ridesApi.active(token) : null;
          if (ride?.to_addr) {
            try {
              const g = await geoApi.geocode(ride.to_addr);
              if (g[0]) destCoords = { lat: g[0].lat, lng: g[0].lng };
            } catch { /* usa il fallback */ }
          }
        }
        const path = await geoApi.route(
          { lat: startCoords.latitude, lng: startCoords.longitude }, destCoords,
        );
        if (active) {
          if (path.length > 1) setRouteCoords(path);
          else setRouteCoords([]); // empty fallback, no fake Bari coords
        }
      } catch {
        if (active) setRouteCoords([]);
      }
    })();
    return () => { active = false; };
  }, [token, toLat, toLng]);

  // Pausa/ripresa corsa: aggiorna lo stato sul backend (PATCH /rides/{id}/pause).
  const togglePauseTo = async (next: boolean) => {
    if (next === paused) return;
    setPaused(next); // ottimistico (il timer dei costi si ferma subito)
    if (token && rideId) {
      try {
        const updated = await ridesApi.pause(token, Number(rideId));
        setPaused(updated.status === 'paused');
      } catch {
        setPaused(!next); // rollback in caso di errore
      }
    }
  };

  const handleEndRide = async () => {
    if (ending) return;
    setEnding(true);
    const minutes = Math.max(1, Math.round(seconds / 60));
    const km = Math.round(minutes * 0.2 * 10) / 10;
    let result: Awaited<ReturnType<typeof ridesApi.end>> | null = null;
    try {
      if (token && rideId) {
        result = await ridesApi.end(token, Number(rideId), { km, minutes });
      }
    } catch {
      // La corsa potrebbe essere già stata chiusa dal backend (cleanup orfani).
      // Si prosegue comunque verso il riepilogo.
    } finally {
      // Pulizia locale SEMPRE garantita: il finally scatta sia su successo che su errore.
      endSession();
      await refreshUser().catch(() => {});
      setEnding(false);
    }
    router.replace({
      pathname: '/(app)/end-ride',
      params: {
        km: String(result?.km ?? km),
        minutes: String(result?.minutes ?? minutes),
        cost: (result?.cost ?? Number(cost)).toFixed(2),
        points: String(result?.points ?? minutes),
        vehicleType: result?.vehicle_type ?? vehicle?.type ?? 'scooter',
        endLat: String((routeCoords[routeCoords.length - 1] ?? startCoords).latitude),
        endLng: String((routeCoords[routeCoords.length - 1] ?? startCoords).longitude),
      },
    });
  };

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [paused]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topStat}>
          <Ionicons name="time-outline" size={14} color={Colors.muted} />
          <Text style={styles.topStatValue}>{fmt(seconds)}</Text>
          <Text style={styles.topStatLabel}>Tempo in corso</Text>
        </View>
        <View style={[styles.topStat, styles.topStatCenter]}>
          <MaterialCommunityIcons name="currency-eur" size={14} color={Colors.muted} />
          <Text style={[styles.topStatValue, { color: Colors.accent }]}>€ {cost}</Text>
          <Text style={styles.topStatLabel}>Costo attuale</Text>
        </View>
        <View style={styles.topStat}>
          <Ionicons name="location-outline" size={14} color={Colors.muted} />
          <Text style={styles.topStatValue} numberOfLines={1}>{dest ?? 'Destinazione'}</Text>
          <Text style={styles.topStatLabel}>{destMin != null && destKm != null ? `${destMin} min · ${destKm} km` : ''}</Text>
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: startCoords.latitude,
          longitude: startCoords.longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        }}
        showsUserLocation
        showsCompass={false}
      >
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={Colors.accent}
            strokeWidth={4}
            lineDashPattern={undefined}
          />
        )}
        <Marker coordinate={startCoords}>
          <View style={styles.startMarker}>
            <Ionicons name="radio-button-on" size={24} color={Colors.primary} />
          </View>
        </Marker>
        {routeCoords.length > 0 && (
          <Marker coordinate={routeCoords[routeCoords.length - 1]}>
            <View style={styles.endMarker}>
              <Ionicons name="location" size={24} color={Colors.success} />
            </View>
          </Marker>
        )}
      </MapView>

      <View style={styles.mapActions}>
        <TouchableOpacity style={styles.mapActionBtn} onPress={() => router.push('/(app)/report')}>
          <Ionicons name="warning-outline" size={18} color={Colors.warning} />
          <Text style={styles.mapActionText}>Segnala problema</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapActionBtn}
          onPress={() => mapRef.current?.animateToRegion(
            { ...startCoords, latitudeDelta: 0.025, longitudeDelta: 0.025 }, 500
          )}
        >
          <Ionicons name="locate-outline" size={18} color={Colors.accent} />
          <Text style={styles.mapActionText}>Centra mappa</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.vehicleRow}>
          <View style={styles.vehicleIcon}>
            <MaterialCommunityIcons
              name={(vehicleIcon[(vehicle?.type as VehicleType) ?? 'scooter']) as any}
              size={28}
              color={Colors.accent}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.vehicleName}>
              {vehicle ? vehicleTypeLabel[vehicle.type] : '—'}
            </Text>
            <Text style={styles.vehicleModel}>
              {vehicle?.model ?? '—'}
            </Text>
            {vehicle && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons
                  name="battery-half"
                  size={14}
                  color={vehicle.battery_pct > 50 ? Colors.success : Colors.warning}
                />
                <Text style={{
                  color: vehicle.battery_pct > 50 ? Colors.success : Colors.warning,
                  fontSize: 12, fontWeight: '600'
                }}>
                  {vehicle.battery_pct}%
                </Text>
              </View>
            )}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={styles.rideId}>
              {rideId ? `ID corsa: #${rideId}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="time-outline" size={16} color={Colors.muted} />
            <Text style={styles.statLabel}>Tempo in corso</Text>
            <Text style={styles.statValue}>{fmt(seconds)} min</Text>
          </View>
          <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
            <MaterialCommunityIcons name="currency-eur" size={16} color={Colors.muted} />
            <Text style={styles.statLabel}>Costo attuale</Text>
            <Text style={[styles.statValue, { color: Colors.accent }]}>€ {cost}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.ctrlBtn, paused ? styles.ctrlBtnActive : null]}
            onPress={() => togglePauseTo(true)}
          >
            <Ionicons name="pause" size={20} color={paused ? Colors.primary : Colors.text} />
            <Text style={[styles.ctrlLabel, paused && { color: Colors.primary }]}>Pausa corsa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ctrlBtn, styles.ctrlBtnEnd]}
            onPress={handleEndRide}
            disabled={ending}
          >
            <Ionicons name="stop" size={22} color={Colors.text} />
            <Text style={[styles.ctrlLabel, { color: Colors.text, fontWeight: '700' }]}>
              {ending ? 'Termino...' : 'Termina corsa'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ctrlBtn, !paused ? styles.ctrlBtnActive : null]}
            onPress={() => togglePauseTo(false)}
          >
            <Ionicons name="play" size={20} color={!paused ? Colors.success : Colors.text} />
            <Text style={[styles.ctrlLabel, !paused && { color: Colors.success }]}>Riprendi corsa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  topBar: { position: 'absolute', top: 52, left: 16, right: 16, zIndex: 10, flexDirection: 'row', backgroundColor: 'rgba(19,19,42,0.95)', borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 10 },
  topStat: { flex: 1, alignItems: 'center', gap: 2 },
  topStatCenter: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  topStatValue: { color: Colors.text, fontWeight: '700', fontSize: 15 },
  topStatLabel: { color: Colors.muted, fontSize: 10 },
  mapActions: { position: 'absolute', right: 16, top: '40%', zIndex: 10, gap: 10 },
  mapActionBtn: { backgroundColor: 'rgba(19,19,42,0.9)', borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 10, alignItems: 'center', gap: 4, width: 76 },
  mapActionText: { color: Colors.text, fontSize: 10, fontWeight: '500', textAlign: 'center' },
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: Colors.border, padding: 16, gap: 14 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  vehicleName: { color: Colors.text, fontWeight: '700', fontSize: 15 },
  vehicleModel: { color: Colors.muted, fontSize: 12 },
  rideId: { color: Colors.muted, fontSize: 12 },
  statsRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  statBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  statLabel: { color: Colors.muted, fontSize: 12, flex: 1 },
  statValue: { color: Colors.text, fontWeight: '700', fontSize: 16 },
  controls: { flexDirection: 'row', gap: 10, paddingBottom: 8 },
  ctrlBtn: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 6 },
  ctrlBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.1)' },
  ctrlBtnEnd: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  ctrlLabel: { color: Colors.muted, fontSize: 11, fontWeight: '500', textAlign: 'center' },
  startMarker: { padding: 4 },
  endMarker: { padding: 4 },
});
