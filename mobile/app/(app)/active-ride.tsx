import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRideSession } from '@/lib/ride/RideSessionContext';
import { ridesApi, geoApi, vehiclesApi } from '@/lib/api/endpoints'; // geoApi: route only
import { vehicleIcon, vehicleTypeLabel } from '@/lib/vehicles';
import type { VehicleType } from '@/components/ui/VehicleCard';
import type { ApiVehicle, ApiRide } from '@/lib/api/types';


export default function ActiveRideScreen() {
  const { token, refreshUser } = useAuth();
  const { session } = useRideSession();
  const params = useLocalSearchParams<{ rideId?: string; fromLat?: string; fromLng?: string; toAddr?: string; toLat?: string; toLng?: string; dest?: string; durMin?: string; km?: string; paused?: string; vehicleId?: string }>();
  const { fromLat, fromLng, toLat, toLng } = params;
  // Se toLat/toLng non sono presenti, la corsa è senza destinazione fissa.
  const hasDestination = !!(toLat && toLng);
  // PROBLEMA B: preferisci i params di navigazione; se assenti/"undefined"
  // (es. arrivo dal guard di _layout con params minimali), ricadi sul context.
  const rideId = params.rideId && params.rideId !== 'undefined'
    ? params.rideId
    : session?.rideId ? String(session.rideId) : undefined;
  const vehicleId = params.vehicleId && params.vehicleId !== 'undefined'
    ? params.vehicleId
    : session?.vehicleId ? String(session.vehicleId) : undefined;
  const destMin = params.durMin ? Number(params.durMin) : null;
  const destKm = params.km ? Number(params.km) : null;
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ending, setEnding] = useState(false);

  const PAUSE_MAX_SEC = 600;
  const [pauseSecondsRemaining, setPauseSecondsRemaining] = useState(PAUSE_MAX_SEC);
  const pauseSecondsRef = useRef(PAUSE_MAX_SEC);

  // Il tab screen rimane montato in memoria tra navigazioni (Expo Router Tabs).
  // Quando arriva una NUOVA corsa (rideId diverso), reset degli stati di controllo.
  // Gli stati di fetch (rideData, vehicle, routeCoords) vengono sovrascritti
  // automaticamente dai rispettivi useEffect quando rideId cambia.
  useEffect(() => {
    setEnding(false);
    setPaused(false);
    setSeconds(0);
    setPauseSecondsRemaining(PAUSE_MAX_SEC);
    pauseSecondsRef.current = PAUSE_MAX_SEC;
  }, [rideId]);

  // Blocca il back hardware (Android): durante la corsa l'unica uscita consentita
  // è "Termina corsa" → end-ride. Ritornando true il back di sistema è ignorato.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // Corsa attiva dal backend: started_at reale, vehicle_id, status.
  const [rideData, setRideData] = useState<ApiRide | null>(null);
  useEffect(() => {
    if (!token) return;
    ridesApi.active(token)
      .then((r) => { if (r) setRideData(r); })
      .catch(() => {});
  }, [token]);

  // Timer inizializzato dal started_at reale del DB (resync a ogni ritorno sulla schermata).
  // Calcola anche il residuo di pausa dal backend per ripristinare il countdown corretto.
  useEffect(() => {
    if (!rideData?.started_at) return;
    const elapsed = Math.floor(
      (Date.now() - new Date(rideData.started_at).getTime()) / 1000
    );
    setSeconds(Math.max(0, elapsed));
    const accumulati = rideData.pausa_secondi_accumulati ?? 0;
    let residuo = Math.max(0, PAUSE_MAX_SEC - accumulati);
    if (rideData.status === 'paused' && rideData.orario_inizio_pausa) {
      const elapsedCurrentPause = Math.floor(
        (Date.now() - new Date(rideData.orario_inizio_pausa).getTime()) / 1000
      );
      residuo = Math.max(0, residuo - elapsedCurrentPause);
    }
    setPauseSecondsRemaining(residuo);
    pauseSecondsRef.current = residuo;
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
  const destinationName = params.dest || params.toAddr || rideData?.to_addr || '';

  const mapRef = useRef<MapView>(null);

  // Posizione di partenza reale dell'utente (passata dalla home), altrimenti fallback.
  const startCoords = (fromLat && fromLng)
    ? { latitude: Number(fromLat), longitude: Number(fromLng) }
    : { latitude: 41.1177, longitude: 16.8718 };

  // Percorso disegnato sulla mappa: calcolato via OSRM all'avvio.
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

  // Calcola il percorso solo se la destinazione è stata esplicitamente impostata.
  // Senza destinazione non mostriamo nessun tracciato sulla mappa.
  useEffect(() => {
    if (!hasDestination) { setRouteCoords([]); return; }
    let active = true;
    (async () => {
      try {
        const path = await geoApi.route(
          { lat: startCoords.latitude, lng: startCoords.longitude },
          { lat: Number(toLat), lng: Number(toLng) },
        );
        if (active) setRouteCoords(path.length > 1 ? path : []);
      } catch {
        if (active) setRouteCoords([]);
      }
    })();
    return () => { active = false; };
  }, [hasDestination, toLat, toLng]);

  // Pausa/ripresa corsa: aggiorna lo stato sul backend (PATCH /rides/{id}/pause).
  const togglePauseTo = async (next: boolean) => {
    if (next === paused) return;
    setPaused(next); // ottimistico (il timer dei costi si ferma subito)
    const effectivePauseRideId = rideId ?? String(rideData?.id);
    if (token && effectivePauseRideId) {
      try {
        const updated = await ridesApi.pause(token, Number(effectivePauseRideId));
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
      // Usa rideId dai params; come fallback usa rideData.id fetchato dal backend
      // (necessario se il guard redirect ha navagato senza params).
      const effectiveRideId = rideId ?? String(rideData?.id);
      if (token && effectiveRideId) {
        result = await ridesApi.end(token, Number(effectiveRideId), { km, minutes });
      }
    } catch {
      // La corsa potrebbe essere già stata chiusa dal backend (cleanup orfani).
      // Si prosegue comunque verso il riepilogo.
    } finally {
      // NB: la sessione NON viene chiusa qui. Resta attiva (tab bloccate) fino
      // alla conferma del parcheggio in end-ride, che chiama endSession().
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

  // Countdown pausa: parte quando paused=true, si ferma al resume.
  // Il ref evita stale closure su pauseSecondsRemaining dentro setInterval.
  useEffect(() => {
    if (!paused) return;
    if (pauseSecondsRef.current <= 0) {
      handleEndRide();
      return;
    }
    const t = setInterval(() => {
      pauseSecondsRef.current -= 1;
      setPauseSecondsRemaining(pauseSecondsRef.current);
      if (pauseSecondsRef.current <= 0) {
        clearInterval(t);
        handleEndRide();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [paused]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const fmtCountdown = fmt(pauseSecondsRemaining);
  const countdownUrgent = pauseSecondsRemaining <= 60;
  const countdownCritical = pauseSecondsRemaining <= 30;

  return (
    <View style={styles.container}>
      {/* Schermo pieno durante la corsa: la status bar è nascosta. */}
      <StatusBar hidden />
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
          <Text style={styles.topStatValue} numberOfLines={1}>{destinationName || (hasDestination ? 'Destinazione' : 'Corsa libera')}</Text>
          <Text style={styles.topStatLabel}>{hasDestination && destMin != null && destKm != null ? `${destMin} min · ${destKm} km` : ''}</Text>
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
        {/* Senza destinazione: mostra l'icona del mezzo sulla posizione di partenza.
            Con destinazione: marcatore di partenza + destinazione finale. */}
        <Marker coordinate={startCoords}>
          <View style={styles.startMarker}>
            {hasDestination
              ? <Ionicons name="radio-button-on" size={24} color={Colors.primary} />
              : <MaterialCommunityIcons
                  name={(vehicleIcon[(vehicle?.type as VehicleType) ?? 'scooter']) as any}
                  size={36}
                  color={Colors.accent}
                />
            }
          </View>
        </Marker>
        {hasDestination && routeCoords.length > 0 && (
          <Marker coordinate={routeCoords[routeCoords.length - 1]}>
            <View style={styles.endMarker}>
              <Ionicons name="location" size={24} color={Colors.success} />
            </View>
          </Marker>
        )}
      </MapView>

      <View style={styles.mapActions}>
        <TouchableOpacity
          style={styles.mapActionBtn}
          onPress={() => mapRef.current?.animateToRegion(
            { ...startCoords, latitudeDelta: 0.025, longitudeDelta: 0.025 }, 500
          )}
        >
          <Ionicons name="locate-outline" size={18} color={Colors.accent} />
          <Text style={styles.mapActionText}>Centra mappa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapActionBtn}
          onPress={() => router.push({
            pathname: '/(app)/report',
            params: {
              rideId: rideId ?? '',
              fromLat: String(startCoords.latitude),
              fromLng: String(startCoords.longitude),
            },
          })}
        >
          <Ionicons name="warning-outline" size={18} color={Colors.warning} />
          <Text style={[styles.mapActionText, { color: Colors.warning }]}>Segnala</Text>
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
            <View style={{ flex: 1 }}>
              <Text style={styles.statLabel}>Costo attuale</Text>
              {hasDestination && destinationName ? (
                <Text style={styles.statDest} numberOfLines={1}>→ {destinationName}</Text>
              ) : null}
            </View>
            <Text style={[styles.statValue, { color: Colors.accent }]}>€ {cost}</Text>
          </View>
        </View>

        {paused && (
          <View style={[
            styles.pauseBanner,
            countdownUrgent && styles.pauseBannerUrgent,
            countdownCritical && styles.pauseBannerCritical,
          ]}>
            <Ionicons
              name="timer-outline"
              size={16}
              color={countdownCritical ? Colors.danger : countdownUrgent ? Colors.warning : Colors.accent}
            />
            <Text style={[
              styles.pauseBannerText,
              countdownCritical && { color: Colors.danger },
              countdownUrgent && !countdownCritical && { color: Colors.warning },
            ]}>
              Pausa automatica in{' '}
              <Text style={{ fontWeight: '800' }}>{fmtCountdown}</Text>
              {' '}— la corsa verrà terminata allo scadere
            </Text>
          </View>
        )}

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
  statDest:  { color: Colors.accent, fontSize: 10, fontWeight: '600', marginTop: 2 },
  statValue: { color: Colors.text, fontWeight: '700', fontSize: 16 },
  controls: { flexDirection: 'row', gap: 10, paddingBottom: 8 },
  ctrlBtn: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 6 },
  ctrlBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.1)' },
  ctrlBtnEnd: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  ctrlLabel: { color: Colors.muted, fontSize: 11, fontWeight: '500', textAlign: 'center' },
  startMarker: { padding: 4 },
  endMarker: { padding: 4 },
  pauseBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(124,58,237,0.12)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderRadius: 14, padding: 12 },
  pauseBannerUrgent: { backgroundColor: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.4)' },
  pauseBannerCritical: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.4)' },
  pauseBannerText: { color: Colors.accent, fontSize: 13, flex: 1, lineHeight: 18 },
});
