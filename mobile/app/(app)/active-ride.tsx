import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { ridesApi, geoApi } from '@/lib/api/endpoints';

// Percorso/posizione di fallback (usati se mancano coords reali o il routing fallisce).
const STATIC_ROUTE = [
  { latitude: 41.1177, longitude: 16.8718 },
  { latitude: 41.1185, longitude: 16.8725 },
  { latitude: 41.1195, longitude: 16.8730 },
  { latitude: 41.1200, longitude: 16.8740 },
  { latitude: 41.1210, longitude: 16.8755 },
];


export default function ActiveRideScreen() {
  const { token, refreshUser } = useAuth();
  const params = useLocalSearchParams<{ rideId?: string; fromLat?: string; fromLng?: string; toLat?: string; toLng?: string; dest?: string; durMin?: string; km?: string; paused?: string }>();
  const { rideId, fromLat, fromLng, toLat, toLng, dest } = params;
  const destMin = params.durMin ? Number(params.durMin) : null;
  const destKm = params.km ? Number(params.km) : null;
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ending, setEnding] = useState(false);
  const cost = ((seconds / 60) * 0.22).toFixed(2);

  // Posizione di partenza reale dell'utente (passata dalla home), altrimenti fallback.
  const startCoords = (fromLat && fromLng)
    ? { latitude: Number(fromLat), longitude: Number(fromLng) }
    : STATIC_ROUTE[0];

  // Percorso disegnato sulla mappa: calcolato via OSRM all'avvio.
  const [routeCoords, setRouteCoords] = useState(STATIC_ROUTE);

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
        if (active && path.length > 1) setRouteCoords(path);
      } catch {
        // mantiene il percorso statico di fallback
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
    const km = Math.round(minutes * 0.2 * 10) / 10; // stima ~12 km/h urbani
    let result: Awaited<ReturnType<typeof ridesApi.end>> | null = null;
    try {
      if (token && rideId) {
        result = await ridesApi.end(token, Number(rideId), { km, minutes });
        await refreshUser();
      }
    } catch {
      setEnding(false);
      // se l'end fallisce si prosegue comunque alla schermata di riepilogo
    }
    router.replace({
      pathname: '/(app)/end-ride',
      params: {
        km: String(result?.km ?? km),
        minutes: String(result?.minutes ?? minutes),
        cost: (result?.cost ?? Number(cost)).toFixed(2),
        points: String(result?.points ?? minutes),
        vehicleType: result?.vehicle_type ?? 'scooter',
        // Posizione di rilascio = fine percorso: usata per ordinare/mostrare le aree di sosta.
        endLat: String(routeCoords[routeCoords.length - 1].latitude),
        endLng: String(routeCoords[routeCoords.length - 1].longitude),
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
        <Polyline
          coordinates={routeCoords}
          strokeColor={Colors.accent}
          strokeWidth={4}
          lineDashPattern={undefined}
        />
        <Marker coordinate={startCoords}>
          <View style={styles.startMarker}>
            <Ionicons name="radio-button-on" size={24} color={Colors.primary} />
          </View>
        </Marker>
        <Marker coordinate={routeCoords[routeCoords.length - 1]}>
          <View style={styles.endMarker}>
            <Ionicons name="location" size={24} color={Colors.success} />
          </View>
        </Marker>
      </MapView>

      <View style={styles.mapActions}>
        <TouchableOpacity style={styles.mapActionBtn}>
          <Ionicons name="warning-outline" size={18} color={Colors.warning} />
          <Text style={styles.mapActionText}>Segnala problema</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapActionBtn}>
          <Ionicons name="locate-outline" size={18} color={Colors.accent} />
          <Text style={styles.mapActionText}>Centra mappa</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.vehicleRow}>
          <View style={styles.vehicleIcon}>
            <MaterialCommunityIcons name="scooter" size={28} color={Colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.vehicleName}>Monopattino</Text>
            <Text style={styles.vehicleModel}>Flash F2</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="battery-half" size={14} color={Colors.success} />
              <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '600' }}>72%</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={styles.rideId}>ID corsa: #1587</Text>
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
