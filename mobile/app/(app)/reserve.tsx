// app/(app)/reserve.tsx
// Schermata dedicata di prenotazione del veicolo (CU-02 passo 7 → CU-03).
// Flusso: scelta destinazione → calcolo percorso (OSRM) → stima tempo/costo →
// conferma → avvio corsa sul Controller → schermata "corsa attiva".

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { useReservationSession } from '@/lib/reservation/ReservationSessionContext';
import { vehiclesApi, reservationsApi, paymentApi, walletApi, geoApi } from '@/lib/api/endpoints';
import { vehicleIcon, vehicleTypeLabel } from '@/lib/vehicles';
import { haversineMeters, formatDistance } from '@/lib/geo';
import type { ApiVehicle, ApiPaymentMethod, ApiRoutePoint, ApiGeocodeResult } from '@/lib/api/types';

// Velocità media di marcia per tipo di mezzo (km/h) → stima del tempo di percorrenza.
const SPEED_KMH: Record<string, number> = { scooter: 18, ebike: 20, car: 30 };
// Durata stimata di default quando non è ancora stata scelta una destinazione (minuti).
const EST_MINUTES = 15;

function batteryColor(pct: number): string {
  return pct > 50 ? Colors.success : pct > 20 ? Colors.warning : Colors.danger;
}

/** Lunghezza in metri di una polyline sommando le tratte consecutive (haversine). */
function routeMeters(points: ApiRoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(
      { latitude: points[i - 1].latitude, longitude: points[i - 1].longitude },
      { latitude: points[i].latitude, longitude: points[i].longitude },
    );
  }
  return total;
}

interface Destination { label: string; lat: number; lng: number; }

export default function ReserveScreen() {
  const { token } = useAuth();
  const { startReservation } = useReservationSession();
  const { vehicleId, fromLat, fromLng, toAddr, toLat, toLng } = useLocalSearchParams<{
    vehicleId?: string; fromLat?: string; fromLng?: string;
    toAddr?: string; toLat?: string; toLng?: string;
  }>();

  // Destinazione ricevuta via params (dalla ricerca della Home, attraverso
  // vehicle-action). Opzionale: se assente la prenotazione parte senza meta.
  const paramDestination: Destination | null =
    (toAddr && toLat && toLng)
      ? { label: toAddr, lat: Number(toLat), lng: Number(toLng) }
      : null;

  const [vehicle, setVehicle] = useState<ApiVehicle | null>(null);
  const [payment, setPayment] = useState<ApiPaymentMethod | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);

  // Destinazione + percorso calcolato (pre-popolata dai params se presenti)
  const [destination, setDestination] = useState<Destination | null>(paramDestination);
  const [route, setRoute] = useState<ApiRoutePoint[]>([]);
  const [routeKm, setRouteKm] = useState<number | null>(null);
  const [routeMin, setRouteMin] = useState<number | null>(null);
  const [routing, setRouting] = useState(false);

  // Modale ricerca destinazione
  const [destModal, setDestModal] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiGeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);

  const userCoords = (fromLat && fromLng)
    ? { latitude: Number(fromLat), longitude: Number(fromLng) }
    : null;

  // La schermata tab resta montata in memoria: la destinazione NON deve
  // persistere tra sessioni. A ogni focus (anche al ritorno da altre schermate)
  // riportiamo gli stati della meta alla destinazione corrente dei params:
  // così una meta scelta nella Home viene mostrata, ma nessuna meta "vecchia"
  // di una sessione precedente sopravvive. NON tocchiamo il veicolo (dai params)
  // né la posizione di partenza (GPS reale).
  // Resettiamo anche confirming/reserveError per evitare spinner infinito al ritorno.
  useFocusEffect(
    useCallback(() => {
      setConfirming(false);
      setReserveError(null);
      setDestination(
        (toAddr && toLat && toLng)
          ? { label: toAddr, lat: Number(toLat), lng: Number(toLng) }
          : null,
      );
      setRoute([]);
      setRouteKm(null);
      setRouteMin(null);
      setDestModal(false);
      setQuery('');
      setResults([]);
    }, [toAddr, toLat, toLng]),
  );

  // ── Carica veicolo, metodo di pagamento e saldo ──────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [v, methods, wallet] = await Promise.all([
          vehiclesApi.get(Number(vehicleId)),
          token ? paymentApi.list(token).catch(() => []) : Promise.resolve([]),
          token ? walletApi.get(token).catch(() => null) : Promise.resolve(null),
        ]);
        if (!active) return;
        setVehicle(v);
        setPayment(methods.find(m => m.is_default) ?? methods[0] ?? null);
        setBalance(wallet?.balance ?? null);
      } catch {
        // veicolo non recuperabile: mostra lo stato di errore
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [vehicleId, token]);

  // ── Ricerca destinazione (geocoding con debounce) ────────────────────────
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await geoApi.geocode(query.trim());
        if (active) setResults(res);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 450);
    return () => { active = false; clearTimeout(t); };
  }, [query]);

  // ── Calcolo percorso quando cambia la destinazione ───────────────────────
  useEffect(() => {
    if (!destination || !vehicle) return;
    const origin = userCoords ?? { latitude: vehicle.lat, longitude: vehicle.lng };
    let active = true;
    setRouting(true);
    (async () => {
      try {
        const path = await geoApi.route(
          { lat: origin.latitude, lng: origin.longitude },
          { lat: destination.lat, lng: destination.lng },
        );
        if (!active) return;
        if (path.length > 1) {
          const meters = routeMeters(path);
          const km = Math.round((meters / 1000) * 10) / 10;
          const speed = SPEED_KMH[vehicle.type] ?? 16;
          const min = Math.max(1, Math.round((km / speed) * 60));
          setRoute(path);
          setRouteKm(km);
          setRouteMin(min);
        } else {
          // OSRM non disponibile: stima a volo d'uccello (haversine diretto).
          const meters = haversineMeters(origin, { latitude: destination.lat, longitude: destination.lng });
          const km = Math.round((meters / 1000) * 10) / 10;
          const speed = SPEED_KMH[vehicle.type] ?? 16;
          setRoute([]);
          setRouteKm(km);
          setRouteMin(Math.max(1, Math.round((km / speed) * 60)));
        }
      } catch {
        if (active) { setRoute([]); setRouteKm(null); setRouteMin(null); }
      } finally {
        if (active) setRouting(false);
      }
    })();
    return () => { active = false; };
  }, [destination, vehicle]);

  // ── Stima costo ──────────────────────────────────────────────────────────
  const estMinutes = routeMin ?? EST_MINUTES;
  const estCost = vehicle ? vehicle.unlock_fee + vehicle.price_per_min * estMinutes : 0;

  const mapRegion = useMemo(() => {
    const c = userCoords ?? (vehicle ? { latitude: vehicle.lat, longitude: vehicle.lng } : null);
    return c ? { ...c, latitudeDelta: 0.04, longitudeDelta: 0.04 } : undefined;
  }, [userCoords, vehicle]);

  const pickDestination = (d: Destination) => {
    setDestination(d);
    setDestModal(false);
    setQuery('');
    setResults([]);
  };

  // Avvia subito → porta alla scansione QR / inserimento codice.
  // La corsa NON parte mai direttamente: richiede conferma fisica sul mezzo.
  const handleAvviaSubito = () => {
    if (!vehicle) return;
    router.push({
      pathname: '/(app)/activate',
      params: {
        prefill: `SM-${vehicle.id}`,
        ...(userCoords ? { fromLat: String(userCoords.latitude), fromLng: String(userCoords.longitude) } : {}),
        ...(destination ? { toAddr: destination.label, toLat: String(destination.lat), toLng: String(destination.lng) } : {}),
      },
    });
  };

  const handleReserve = async () => {
    if (!vehicle || confirming || !token) return;
    setReserveError(null);
    setConfirming(true);
    try {
      const res = await reservationsApi.create(token, vehicle.id);
      startReservation(res);
      router.replace({
        pathname: '/(app)/active-reservation',
        params: {
          reservationId: String(res.id),
          vehicleId: String(vehicle.id),
          vehicleType: vehicle.type,
          vehicleName: vehicle.name,
          vehicleModel: vehicle.model,
          batteryPct: String(vehicle.battery_pct),
          oraScadenza: res.ora_scadenza,
          ...(userCoords ? { fromLat: String(userCoords.latitude), fromLng: String(userCoords.longitude) } : {}),
          ...(destination ? { toAddr: destination.label, toLat: String(destination.lat), toLng: String(destination.lng) } : {}),
        },
      });
    } catch (e: any) {
      const s: number | undefined = e?.status;
      const msg: string = e?.message ?? '';
      if (s === 409 || msg.includes('409')) {
        setReserveError('Hai già una prenotazione attiva o una corsa in corso.');
      } else if (msg.toLowerCase().includes('disponibile') || msg.toLowerCase().includes('uso')) {
        setReserveError('Il mezzo non è più disponibile.');
      } else {
        setReserveError('Impossibile creare la prenotazione. Riprova.');
      }
    } finally {
      setConfirming(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prenota il veicolo</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>
      ) : !vehicle ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.muted} />
          <Text style={styles.errorText}>Veicolo non disponibile.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryText}>Torna indietro</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }} showsVerticalScrollIndicator={false}>
            {/* Card veicolo */}
            <View style={styles.card}>
              <View style={styles.vehicleRow}>
                <View style={styles.iconBox}>
                  <MaterialCommunityIcons name={vehicleIcon[vehicle.type] as any} size={30} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleTitle}>{vehicleTypeLabel[vehicle.type]}</Text>
                  <Text style={styles.vehicleSub}>{vehicle.name} · {vehicle.model}</Text>
                </View>
                <View style={styles.batteryPill}>
                  <Ionicons name="battery-half" size={14} color={batteryColor(vehicle.battery_pct)} />
                  <Text style={[styles.batteryText, { color: batteryColor(vehicle.battery_pct) }]}>{vehicle.battery_pct}%</Text>
                </View>
              </View>
            </View>

            {/* Selettore destinazione */}
            <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => setDestModal(true)}>
              <View style={styles.destRow}>
                <View style={styles.destIcon}>
                  <Ionicons name="flag-outline" size={20} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.destLabel}>Destinazione</Text>
                  <Text style={[styles.destValue, !destination && { color: Colors.muted }]} numberOfLines={1}>
                    {destination ? destination.label.split(',').slice(0, 2).join(',') : 'Scegli dove vuoi andare'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
              </View>
              <Text style={styles.destOptionalHint}>
                Opzionale — puoi impostare la meta anche durante la corsa
              </Text>
            </TouchableOpacity>

            {/* Mappa con percorso */}
            {mapRegion && (
              <View style={styles.mapCard}>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  region={mapRegion}
                  pointerEvents="none"
                  showsUserLocation={false}
                >
                  {userCoords && (
                    <Marker coordinate={userCoords}>
                      <View style={styles.startMarker}><Ionicons name="radio-button-on" size={20} color={Colors.primary} /></View>
                    </Marker>
                  )}
                  {destination && (
                    <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }}>
                      <View style={styles.endMarker}><Ionicons name="location" size={22} color={Colors.success} /></View>
                    </Marker>
                  )}
                  {route.length > 1 && (
                    <Polyline coordinates={route} strokeColor={Colors.accent} strokeWidth={4} />
                  )}
                </MapView>
                {routing && (
                  <View style={styles.mapOverlay}><ActivityIndicator color={Colors.accent} /></View>
                )}
                {!destination && !routing && (
                  <View style={styles.mapOverlay}><Text style={styles.mapHint}>Scegli una destinazione per vedere il percorso</Text></View>
                )}
              </View>
            )}

            {/* Stima tratta */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Stima tratta</Text>
              <View style={styles.statsGrid}>
                <View style={styles.stat}>
                  <Ionicons name="navigate-outline" size={18} color={Colors.accent} />
                  <Text style={styles.statValue}>{routeKm != null ? `${routeKm.toFixed(1)} km` : '—'}</Text>
                  <Text style={styles.statLabel}>Distanza</Text>
                </View>
                <View style={styles.stat}>
                  <Ionicons name="time-outline" size={18} color={Colors.accent} />
                  <Text style={styles.statValue}>{routeMin != null ? `${routeMin} min` : '—'}</Text>
                  <Text style={styles.statLabel}>Tempo stim.</Text>
                </View>
                <View style={styles.stat}>
                  <MaterialCommunityIcons name="currency-eur" size={18} color={Colors.accent} />
                  <Text style={styles.statValue}>{routeMin != null ? `€ ${estCost.toFixed(2)}` : '—'}</Text>
                  <Text style={styles.statLabel}>Costo stim.</Text>
                </View>
              </View>
            </View>

            {/* Riepilogo costi */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Riepilogo costi</Text>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Sblocco</Text>
                <Text style={styles.costValue}>€ {vehicle.unlock_fee.toFixed(2)}</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Tariffa</Text>
                <Text style={styles.costValue}>€ {vehicle.price_per_min.toFixed(2)}/min</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Durata stimata</Text>
                <Text style={styles.costValue}>{estMinutes} min</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.costRow}>
                <Text style={styles.costTotalLabel}>Totale stimato</Text>
                <Text style={styles.costTotalValue}>€ {estCost.toFixed(2)}</Text>
              </View>
              <Text style={styles.note}>
                {destination
                  ? 'Stima basata sul percorso. L\'importo finale dipende dalla durata effettiva.'
                  : 'Stima preliminare. Scegli una destinazione per il calcolo sul percorso.'}
              </Text>
            </View>

            {/* Metodo di pagamento */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Pagamento</Text>
              <TouchableOpacity style={styles.payRow} activeOpacity={0.7} onPress={() => router.push('/(app)/payment')}>
                <View style={styles.payIcon}>
                  <Ionicons
                    name={payment?.kind === 'paypal' ? 'logo-paypal' : payment?.kind === 'apple' ? 'logo-apple' : 'card-outline'}
                    size={20}
                    color={Colors.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payLabel}>
                    {payment ? payment.label : 'Wallet Smart Mobility'}
                    {payment?.last4 ? ` ···· ${payment.last4}` : ''}
                  </Text>
                  {balance != null && <Text style={styles.paySub}>Saldo wallet: € {balance.toFixed(2)}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Errore prenotazione (sopra i pulsanti CTA) */}
          {reserveError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.danger} />
              <Text style={styles.errorBoxText}>{reserveError}</Text>
            </View>
          )}

          {/* CTA */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.reserveBtn} onPress={handleReserve} disabled={confirming} activeOpacity={0.85}>
              <LinearGradient colors={['#7C3AED', '#4F8EF7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
                {confirming
                  ? <ActivityIndicator color={Colors.text} />
                  : <>
                      <Ionicons name="bookmark-outline" size={18} color={Colors.text} />
                      <Text style={styles.btnText}>Prenota</Text>
                    </>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startBtn} onPress={handleAvviaSubito} disabled={!vehicle} activeOpacity={0.85}>
              <LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
                <Ionicons name="qr-code-outline" size={18} color={Colors.text} />
                <Text style={styles.btnText}>Avvia subito</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Modale ricerca destinazione ── */}
      {destModal && (
        <View style={[StyleSheet.absoluteFillObject, styles.modalWrap]} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setDestModal(false)} />
          <View style={styles.modal}>
            <View style={styles.modalInputRow}>
              <Ionicons name="search-outline" size={20} color={Colors.accent} />
              <TextInput
                style={styles.modalInput}
                placeholder="Cerca destinazione"
                placeholderTextColor={Colors.muted}
                value={query}
                onChangeText={setQuery}
                autoFocus
                autoCorrect={false}
                returnKeyType="search"
              />
              <TouchableOpacity onPress={() => setDestModal(false)} style={styles.modalClose} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalBody}>
              {searching ? (
                <View style={styles.modalEmpty}><ActivityIndicator color={Colors.accent} /><Text style={styles.modalEmptyText}>Ricerca in corso…</Text></View>
              ) : results.length > 0 ? (
                results.map((r, i) => {
                  const short = r.label.split(',').slice(0, 2).join(',');
                  return (
                    <TouchableOpacity key={`${r.lat}-${r.lng}-${i}`} style={styles.modalItem} activeOpacity={0.7}
                      onPress={() => pickDestination({ label: r.label, lat: r.lat, lng: r.lng })}>
                      <View style={styles.modalItemIcon}><Ionicons name="location-outline" size={17} color={Colors.accent} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalItemLabel} numberOfLines={1}>{short}</Text>
                        <Text style={styles.modalItemSub} numberOfLines={1}>
                          {userCoords ? `${formatDistance(haversineMeters(userCoords, { latitude: r.lat, longitude: r.lng }))} da te` : 'Indirizzo'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.modalEmpty}>
                  <Ionicons name="search-outline" size={32} color={Colors.muted} />
                  <Text style={styles.modalEmptyText}>{query.length < 2 ? 'Digita per cercare' : 'Nessun risultato'}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.bg },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:          { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle:      { color: Colors.text, fontSize: 17, fontWeight: '800' },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText:        { color: Colors.muted, fontSize: 15 },
  retryBtn:         { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  retryText:        { color: Colors.text, fontWeight: '600' },

  card:             { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 16, gap: 14 },
  vehicleRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox:          { width: 56, height: 56, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  vehicleTitle:     { color: Colors.text, fontWeight: '800', fontSize: 17 },
  vehicleSub:       { color: Colors.muted, fontSize: 13, marginTop: 2 },
  batteryPill:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  batteryText:      { fontSize: 13, fontWeight: '700' },

  destRow:          { flexDirection: 'row', alignItems: 'center', gap: 12 },
  destIcon:         { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  destLabel:        { color: Colors.muted, fontSize: 12 },
  destValue:        { color: Colors.text, fontSize: 15, fontWeight: '600', marginTop: 2 },
  destOptionalHint: { color: Colors.muted, fontSize: 12, lineHeight: 16 },

  mapCard:          { height: 180, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  map:              { ...StyleSheet.absoluteFillObject },
  mapOverlay:       { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,13,26,0.45)', gap: 8 },
  mapHint:          { color: Colors.text, fontSize: 13, fontWeight: '500', paddingHorizontal: 16, textAlign: 'center' },
  startMarker:      { padding: 2 },
  endMarker:        { padding: 2 },

  statsGrid:        { flexDirection: 'row', gap: 10 },
  stat:             { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 4 },
  statValue:        { color: Colors.text, fontWeight: '800', fontSize: 14 },
  statLabel:        { color: Colors.muted, fontSize: 11 },

  sectionTitle:     { color: Colors.text, fontWeight: '700', fontSize: 15 },
  costRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costLabel:        { color: Colors.muted, fontSize: 14 },
  costValue:        { color: Colors.text, fontSize: 14, fontWeight: '600' },
  divider:          { height: 1, backgroundColor: Colors.border },
  costTotalLabel:   { color: Colors.text, fontSize: 15, fontWeight: '700' },
  costTotalValue:   { color: Colors.accent, fontSize: 18, fontWeight: '800' },
  note:             { color: Colors.muted, fontSize: 12, lineHeight: 17 },

  payRow:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  payIcon:          { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  payLabel:         { color: Colors.text, fontSize: 15, fontWeight: '600' },
  paySub:           { color: Colors.muted, fontSize: 12, marginTop: 2 },

  errorBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: Colors.danger, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  errorBoxText:{ color: Colors.danger, fontSize: 13, fontWeight: '500', flex: 1 },
  footer:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.card },
  reserveBtn:  { flex: 1.4, borderRadius: 16, overflow: 'hidden' },
  startBtn:    { flex: 1, borderRadius: 16, overflow: 'hidden' },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  btnText:     { color: Colors.text, fontSize: 15, fontWeight: '700' },

  // Modale destinazione
  modalWrap:        { zIndex: 50, backgroundColor: 'rgba(0,0,0,0.6)' },
  modal:            { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(8,8,24,0.97)', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, borderWidth: 1, borderTopWidth: 0, borderColor: 'rgba(167,139,250,0.25)' },
  modalInputRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 62, paddingHorizontal: 20, paddingBottom: 16 },
  modalInput:       { flex: 1, color: Colors.text, fontSize: 17, paddingVertical: 0 },
  modalClose:       { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  modalDivider:     { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },
  modalBody:        { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 12, minHeight: 120 },
  modalItem:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  modalItemIcon:    { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  modalItemLabel:   { color: Colors.text, fontSize: 15, fontWeight: '500' },
  modalItemSub:     { color: Colors.muted, fontSize: 12, marginTop: 2 },
  modalEmpty:       { alignItems: 'center', paddingVertical: 28, gap: 8 },
  modalEmptyText:   { color: Colors.muted, fontSize: 14 },
});
