/**
 * ActivateScreen — scansiona il QR del mezzo o inserisci il codice manualmente.
 *
 * Flusso in 2 step:
 *  1. Scanner QR o inserimento manuale — campo VUOTO, nessun pre-fill.
 *     Se il mezzo era già selezionato (params.prefill = SM-XX), il codice
 *     inserito deve corrispondere a quel mezzo; altrimenti errore.
 *  2. Preview viaggio — dettagli mezzo verificato, destinazione opzionale,
 *     stima costo → "Avvia corsa" per avviare davvero la corsa.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { vehiclesApi, ridesApi, reservationsApi, geoApi } from '@/lib/api/endpoints';
import { vehicleIcon, vehicleTypeLabel } from '@/lib/vehicles';
import { haversineMeters } from '@/lib/geo';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRideSession } from '@/lib/ride/RideSessionContext';
import { useReservationSession } from '@/lib/reservation/ReservationSessionContext';
import type { ApiVehicle, ApiGeocodeResult, ApiRoutePoint } from '@/lib/api/types';

const { width } = Dimensions.get('window');
const FRAME = width * 0.68;

const SPEED_KMH: Record<string, number> = { scooter: 18, ebike: 20, car: 30 };

function routeMeters(points: ApiRoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(
      { latitude: points[i - 1].latitude, longitude: points[i - 1].longitude },
      { latitude: points[i].latitude,     longitude: points[i].longitude },
    );
  }
  return total;
}

interface Destination { label: string; lat: number; lng: number; }
type Step = 'scan' | 'manual' | 'preview';

export default function ActivateScreen() {
  const params = useLocalSearchParams<{
    prefill?: string;
    startMode?: 'scan' | 'manual';
    reservationId?: string;
    fromLat?: string; fromLng?: string;
    toAddr?: string; toLat?: string; toLng?: string;
  }>();
  const { token } = useAuth();
  const { startSession } = useRideSession();
  const { clearReservation } = useReservationSession();

  // ID veicolo atteso (estratto da prefill = "SM-42" → 42). null = qualsiasi mezzo.
  const expectedVehicleId: number | null = (() => {
    const m = params.prefill?.match(/\d+/);
    return m ? Number(m[0]) : null;
  })();

  const [step, setStep]             = useState<Step>('scan');
  const [code, setCode]             = useState('');
  const codeRef                     = useRef('');       // valore codice sempre aggiornato (sincrono)
  const [validating, setValidating] = useState(false);
  const validatingRef               = useRef(false);   // guard sincrono — evita stale closure
  const [starting, setStarting]     = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const scannedRef                  = useRef(false);   // guard sincrono anti-doppia-scansione
  const [permission, requestPermission] = useCameraPermissions();

  // Dati del mezzo dopo validazione positiva (step preview)
  const [validatedVehicle, setValidatedVehicle] = useState<ApiVehicle | null>(null);

  // Destinazione (pre-popolata se passata come param, modificabile in preview)
  const initialDest: Destination | null =
    params.toAddr && params.toLat && params.toLng
      ? { label: params.toAddr, lat: Number(params.toLat), lng: Number(params.toLng) }
      : null;
  const [destination, setDestination] = useState<Destination | null>(initialDest);

  // Modale ricerca destinazione (usata nello step preview)
  const [destModal, setDestModal]       = useState(false);
  const [destQuery, setDestQuery]       = useState('');
  const [destResults, setDestResults]   = useState<ApiGeocodeResult[]>([]);
  const [destSearching, setDestSearching] = useState(false);

  // Percorso calcolato
  const [routeKm, setRouteKm]   = useState<number | null>(null);
  const [routeMin, setRouteMin] = useState<number | null>(null);

  const userCoords = (params.fromLat && params.fromLng)
    ? { latitude: Number(params.fromLat), longitude: Number(params.fromLng) }
    : null;

  // Ref sempre aggiornato ai params correnti — usato dentro useFocusEffect
  // per evitare che le modifiche ai params (Expo Router li aggiorna dopo il mount)
  // causino un re-run dell'effect che resetta codice/step mentre l'utente sta già operando.
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Reset completo ad ogni focus (nuovo mezzo o ritorno).
  // IMPORTANTE: deps = [] → l'effect gira SOLO sui veri eventi focus/blur,
  // non ogni volta che Expo Router aggiorna i params durante la transizione.
  useFocusEffect(
    useCallback(() => {
      const p = paramsRef.current;
      setCode('');
      codeRef.current     = '';
      scannedRef.current  = false;
      validatingRef.current = false;
      setError(null);
      setValidating(false);
      setStarting(false);
      setValidatedVehicle(null);
      setRouteKm(null);
      setRouteMin(null);
      setDestination(
        p.toAddr && p.toLat && p.toLng
          ? { label: p.toAddr, lat: Number(p.toLat), lng: Number(p.toLng) }
          : null,
      );
      setStep(p.startMode === 'manual' ? 'manual' : 'scan');
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Ricerca destinazione con debounce ───────────────────────────────────────
  useEffect(() => {
    if (destQuery.trim().length < 2) { setDestResults([]); return; }
    let active = true;
    setDestSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await geoApi.geocode(destQuery.trim());
        if (active) setDestResults(res);
      } catch { if (active) setDestResults([]); }
      finally   { if (active) setDestSearching(false); }
    }, 450);
    return () => { active = false; clearTimeout(t); };
  }, [destQuery]);

  // ── Calcola percorso quando cambia destinazione in preview ─────────────────
  useEffect(() => {
    if (!destination || !validatedVehicle || step !== 'preview') return;
    const origin = userCoords ?? { latitude: validatedVehicle.lat, longitude: validatedVehicle.lng };
    let active = true;
    (async () => {
      try {
        const path: ApiRoutePoint[] = await geoApi.route(
          { lat: origin.latitude, lng: origin.longitude },
          { lat: destination.lat, lng: destination.lng },
        );
        if (!active) return;
        if (path.length > 1) {
          const meters = routeMeters(path);
          const km     = Math.round((meters / 1000) * 10) / 10;
          const speed  = SPEED_KMH[validatedVehicle.type] ?? 16;
          setRouteKm(km);
          setRouteMin(Math.max(1, Math.round((km / speed) * 60)));
        } else {
          const meters = haversineMeters(origin, { latitude: destination.lat, longitude: destination.lng });
          const km     = Math.round((meters / 1000) * 10) / 10;
          const speed  = SPEED_KMH[validatedVehicle.type] ?? 16;
          setRouteKm(km);
          setRouteMin(Math.max(1, Math.round((km / speed) * 60)));
        }
      } catch { if (active) { setRouteKm(null); setRouteMin(null); } }
    })();
    return () => { active = false; };
  }, [destination, validatedVehicle, step]);

  // ── STEP 1 → 2: Valida il codice ────────────────────────────────────────────
  const handleValidate = async (rawCode?: string) => {
    // Guard sincrono: impedisce chiamate concorrenti senza dipendere da state
    if (validatingRef.current) return;

    const input = (rawCode ?? codeRef.current ?? code).trim();
    const match = input.match(/\d+/);
    if (!match) {
      // scannedRef resta true → la fotocamera non rilancia finché l'utente non tocca "Scansiona di nuovo"
      setError('QR non riconosciuto. Inquadra il codice stampato sul mezzo.');
      return;
    }
    const vid = Number(match[0]);

    // Mezzo specifico selezionato in precedenza → accetta solo il suo codice
    if (expectedVehicleId !== null && vid !== expectedVehicleId) {
      setError(`Codice errato: hai scansionato SM-${vid}, ma il mezzo selezionato è SM-${expectedVehicleId}.`);
      return; // scannedRef resta true → nessun loop, utente tocca "Scansiona di nuovo"
    }

    validatingRef.current = true;
    setValidating(true);
    setError(null);
    try {
      const v = await vehiclesApi.get(vid);
      if (v.status !== 'parked' || v.locked) {
        setError(`Il mezzo SM-${vid} non è disponibile al momento.`);
        return;
      }
      setValidatedVehicle(v);
      setStep('preview');
    } catch (e: any) {
      if (e?.status === 404) {
        setError('Codice non trovato. Controlla il numero stampato sul mezzo.');
      } else {
        setError('Impossibile verificare il codice. Riprova tra qualche secondo.');
      }
      // scannedRef resta true — il pulsante "Scansiona di nuovo" resetterà il guard
    } finally {
      validatingRef.current = false;
      setValidating(false);
    }
  };

  // ── STEP 2: Avvia la corsa ──────────────────────────────────────────────────
  const handleStartRide = async () => {
    if (!validatedVehicle || !token) return;
    setStarting(true);
    setError(null);
    try {
      const ride = await ridesApi.start(token, {
        vehicle_id:   validatedVehicle.id,
        vehicle_type: validatedVehicle.type,
        from_addr:    'Posizione attuale',
        ...(destination ? { to_addr: destination.label } : {}),
      });
      if (params.reservationId) {
        try { await reservationsApi.cancel(token, Number(params.reservationId)); } catch {}
        clearReservation();
      }
      startSession(ride);
      router.replace({
        pathname: '/(app)/active-ride',
        params: {
          rideId:    String(ride.id),
          vehicleId: String(validatedVehicle.id),
          ...(params.fromLat && params.fromLng
            ? { fromLat: params.fromLat, fromLng: params.fromLng } : {}),
          ...(destination
            ? { toAddr: destination.label, toLat: String(destination.lat), toLng: String(destination.lng) }
            : {}),
        },
      });
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      if (e?.status === 409 || msg.toLowerCase().includes('corso')) {
        setError('Hai già una corsa in corso. Termina quella attiva prima di iniziarne una nuova.');
      } else {
        setError('Impossibile avviare la corsa. Riprova tra qualche secondo.');
      }
    } finally {
      setStarting(false);
    }
  };

  // Guard QR: usa solo refs sincroni — nessuna stale closure possibile
  const handleScanned = ({ data }: { data: string }) => {
    if (scannedRef.current || validatingRef.current) return;
    scannedRef.current = true;
    handleValidate(data);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2 — Preview viaggio
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 'preview' && validatedVehicle) {
    const estMin  = routeMin ?? 15;
    const estCost = validatedVehicle.unlock_fee + validatedVehicle.price_per_min * estMin;

    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1A0A2E', '#0D0D1A']} style={styles.header}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => { scannedRef.current = false; setStep('scan'); setError(null); }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dettagli viaggio</Text>
          <View style={{ width: 38 }} />
        </LinearGradient>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Badge mezzo verificato */}
          <View style={styles.confirmedBadge}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.confirmedText}>Mezzo verificato e disponibile</Text>
          </View>

          {/* Card veicolo */}
          <View style={styles.card}>
            <View style={styles.vehicleRow}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons
                  name={vehicleIcon[validatedVehicle.type] as any}
                  size={30}
                  color={Colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleTitle}>
                  {vehicleTypeLabel[validatedVehicle.type]}
                </Text>
                <Text style={styles.vehicleSub}>
                  {validatedVehicle.name} · {validatedVehicle.model}
                </Text>
              </View>
              <View style={styles.batteryPill}>
                <Ionicons
                  name="battery-half"
                  size={14}
                  color={validatedVehicle.battery_pct > 50 ? Colors.success : Colors.warning}
                />
                <Text style={[
                  styles.batteryText,
                  { color: validatedVehicle.battery_pct > 50 ? Colors.success : Colors.warning },
                ]}>
                  {validatedVehicle.battery_pct}%
                </Text>
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
                <Text
                  style={[styles.destValue, !destination && { color: Colors.muted }]}
                  numberOfLines={1}
                >
                  {destination
                    ? destination.label.split(',').slice(0, 2).join(',')
                    : 'Scegli dove vuoi andare (opzionale)'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
            </View>
          </TouchableOpacity>

          {/* Stima costi */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Stima costi</Text>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Sblocco</Text>
              <Text style={styles.costValue}>€ {validatedVehicle.unlock_fee.toFixed(2)}</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Tariffa</Text>
              <Text style={styles.costValue}>€ {validatedVehicle.price_per_min.toFixed(2)}/min</Text>
            </View>
            {routeKm != null && (
              <>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Distanza stimata</Text>
                  <Text style={styles.costValue}>{routeKm.toFixed(1)} km</Text>
                </View>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Tempo stimato</Text>
                  <Text style={styles.costValue}>{routeMin} min</Text>
                </View>
              </>
            )}
            <View style={styles.divider} />
            <View style={styles.costRow}>
              <Text style={styles.costTotalLabel}>Totale stimato</Text>
              <Text style={styles.costTotalValue}>€ {estCost.toFixed(2)}</Text>
            </View>
            <Text style={styles.note}>
              {destination
                ? "Stima basata sul percorso. L'importo finale dipende dalla durata effettiva."
                : 'Scegli una destinazione per una stima più precisa.'}
            </Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.startRideBtn, starting && { opacity: 0.6 }]}
            onPress={handleStartRide}
            disabled={starting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#7C3AED', '#4F8EF7']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.startRideBtnInner}
            >
              {starting
                ? <ActivityIndicator color={Colors.text} size="small" />
                : <Ionicons name="flash" size={20} color={Colors.text} />}
              <Text style={styles.startRideBtnText}>
                {starting ? 'Avvio in corso...' : 'Avvia corsa'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Modale ricerca destinazione */}
        {destModal && (
          <View style={[StyleSheet.absoluteFillObject, styles.modalWrap]} pointerEvents="box-none">
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setDestModal(false)}
            />
            <View style={styles.modal}>
              <View style={styles.modalInputRow}>
                <Ionicons name="search-outline" size={20} color={Colors.accent} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Cerca destinazione"
                  placeholderTextColor={Colors.muted}
                  value={destQuery}
                  onChangeText={setDestQuery}
                  autoFocus autoCorrect={false} returnKeyType="search"
                />
                <TouchableOpacity
                  onPress={() => setDestModal(false)}
                  style={styles.modalClose}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color={Colors.muted} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalBody}>
                {destSearching ? (
                  <View style={styles.modalEmpty}>
                    <ActivityIndicator color={Colors.accent} />
                    <Text style={styles.modalEmptyText}>Ricerca…</Text>
                  </View>
                ) : destResults.length > 0 ? (
                  destResults.map((r, i) => {
                    const short = r.label.split(',').slice(0, 2).join(',');
                    return (
                      <TouchableOpacity
                        key={`${r.lat}-${r.lng}-${i}`}
                        style={styles.modalItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          setDestination({ label: r.label, lat: r.lat, lng: r.lng });
                          setDestModal(false);
                          setDestQuery('');
                          setDestResults([]);
                        }}
                      >
                        <View style={styles.modalItemIcon}>
                          <Ionicons name="location-outline" size={17} color={Colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalItemLabel} numberOfLines={1}>{short}</Text>
                          <Text style={styles.modalItemSub} numberOfLines={1}>
                            {userCoords
                              ? `${(haversineMeters(userCoords, { latitude: r.lat, longitude: r.lng }) / 1000).toFixed(1)} km da te`
                              : 'Indirizzo'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.modalEmpty}>
                    <Ionicons name="search-outline" size={32} color={Colors.muted} />
                    <Text style={styles.modalEmptyText}>
                      {destQuery.length < 2 ? 'Digita per cercare' : 'Nessun risultato'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1 — Modalità inserimento manuale
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 'manual') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient colors={['#1A0A2E', '#0D0D1A']} style={styles.header}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => { setStep('scan'); setError(null); setCode(''); }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inserisci codice</Text>
          <View style={{ width: 38 }} />
        </LinearGradient>

        <View style={styles.manualBox}>
          <View style={styles.manualIconBox}>
            <Ionicons name="keypad-outline" size={40} color={Colors.accent} />
          </View>
          <Text style={styles.manualTitle}>Codice del mezzo</Text>
          <Text style={styles.manualSub}>
            {expectedVehicleId !== null
              ? `Devi inserire il codice SM-${expectedVehicleId} stampato su questo mezzo.`
              : 'Inserisci il codice (formato SM-XX) stampato sul mezzo o sulla targhetta QR.'}
          </Text>

          <TextInput
            style={styles.codeInput}
            placeholder={expectedVehicleId !== null ? `SM-${expectedVehicleId}` : 'SM-42'}
            placeholderTextColor={Colors.muted}
            value={code}
            onChangeText={(t) => {
              const up = t.toUpperCase();
              setCode(up);
              codeRef.current = up;  // aggiorna ref sincrono
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            autoFocus
            // Usa e.nativeEvent.text per evitare stale closure su state
            onSubmitEditing={(e) => handleValidate(e.nativeEvent.text)}
          />

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.activateBtn, (!code.trim() || validating) && { opacity: 0.45 }]}
            onPress={() => handleValidate()}
            disabled={!code.trim() || validating}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#7C3AED', '#4F8EF7']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.activateBtnInner}
            >
              {validating
                ? <ActivityIndicator color={Colors.text} size="small" />
                : <Ionicons name="arrow-forward" size={20} color={Colors.text} />}
              <Text style={styles.activateBtnText}>
                {validating ? 'Verifica in corso...' : 'Verifica codice'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1 — Permessi fotocamera non ancora concessi
  // ════════════════════════════════════════════════════════════════════════════
  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1A0A2E', '#0D0D1A']} style={styles.header}>
          <TouchableOpacity style={styles.headerBackBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Attiva corsa</Text>
          <View style={{ width: 38 }} />
        </LinearGradient>
        <View style={styles.permissionBox}>
          <LinearGradient colors={Gradients.primary} style={styles.permIcon}>
            <Ionicons name="camera-outline" size={32} color={Colors.text} />
          </LinearGradient>
          <Text style={styles.permTitle}>Accesso fotocamera</Text>
          <Text style={styles.permSub}>
            Per scansionare il QR code del mezzo è necessario il permesso alla fotocamera.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <LinearGradient
              colors={Gradients.primaryBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.permBtnGradient}
            >
              <Text style={styles.permBtnText}>Concedi permesso</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep('manual')}>
            <Text style={styles.manualLink}>Inserisci codice manualmente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1 — Scanner QR
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={handleScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      <View style={styles.overlay}>
        <View style={styles.overlayHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.scanHeaderText}>Attiva corsa</Text>
          <View style={{ width: 38 }} />
        </View>


        {/* Hint bar: mostra il mezzo richiesto (vincolante) oppure istruzione generica */}
        <View style={styles.vehicleHintBar}>
          <Ionicons name="qr-code-outline" size={16} color={Colors.accent} />
          <Text style={styles.vehicleHintText}>
            {expectedVehicleId !== null
              ? <>Scansiona il QR del mezzo{' '}
                  <Text style={{ fontWeight: '800', color: Colors.accent }}>SM-{expectedVehicleId}</Text>
                </>
              : 'Scansiona il QR di qualsiasi mezzo disponibile'}
          </Text>
        </View>

        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {validating && (
              <View style={styles.frameSpinner}>
                <ActivityIndicator color={Colors.accent} size="large" />
              </View>
            )}
          </View>
          <View style={styles.overlaySide} />
        </View>

        <View style={styles.overlayBottom}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <Text style={styles.scanHint}>
              {validating
                ? 'Verifica in corso…'
                : 'Punta la fotocamera sul QR code del mezzo'}
            </Text>
          )}

          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => { setError(null); setStep('manual'); }}
            activeOpacity={0.8}
          >
            <Ionicons name="keypad-outline" size={18} color={Colors.accent} />
            <Text style={styles.manualBtnText}>Inserisci codice manualmente</Text>
          </TouchableOpacity>

          {error && !validating && (
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => { scannedRef.current = false; setError(null); }}
            >
              <Text style={styles.resetBtnText}>Scansiona di nuovo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: Colors.bg },

  // Header condiviso
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerBackBtn:     { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:       { color: Colors.text, fontSize: 18, fontWeight: '800' },

  // Scanner overlay
  overlay:           { flex: 1 },
  overlayHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: 'rgba(0,0,0,0.55)' },
  backBtn:           { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  scanHeaderText:    { color: Colors.text, fontSize: 18, fontWeight: '800' },
  vehicleHintBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(124,58,237,0.35)', paddingHorizontal: 16, paddingVertical: 10 },
  vehicleHintText:   { color: Colors.text, fontSize: 13, fontWeight: '500' },
  overlayMiddle:     { flexDirection: 'row', height: FRAME },
  overlaySide:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  frame:             { width: FRAME, height: FRAME, alignItems: 'center', justifyContent: 'center' },
  corner:            { position: 'absolute', width: 30, height: 30, borderColor: Colors.accent, borderWidth: 3 },
  cornerTL:          { top: 0,    left: 0,  borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 8 },
  cornerTR:          { top: 0,    right: 0, borderBottomWidth: 0, borderLeftWidth: 0,  borderTopRightRadius: 8 },
  cornerBL:          { bottom: 0, left: 0,  borderTopWidth: 0,    borderRightWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR:          { bottom: 0, right: 0, borderTopWidth: 0,    borderLeftWidth: 0,  borderBottomRightRadius: 8 },
  frameSpinner:      { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  overlayBottom:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 24 },
  scanHint:          { color: Colors.text, fontSize: 15, textAlign: 'center', fontWeight: '500' },
  manualBtn:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: Colors.accent, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },
  manualBtnText:     { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  resetBtn:          { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10 },
  resetBtnText:      { color: Colors.text, fontWeight: '600', fontSize: 14 },

  // Permessi
  permissionBox:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  permIcon:          { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  permTitle:         { color: Colors.text, fontSize: 22, fontWeight: '800' },
  permSub:           { color: Colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  permBtn:           { borderRadius: 14, overflow: 'hidden', alignSelf: 'stretch' },
  permBtnGradient:   { paddingVertical: 15, alignItems: 'center' },
  permBtnText:       { color: Colors.text, fontWeight: '700', fontSize: 16 },
  manualLink:        { color: Colors.accent, fontSize: 14, fontWeight: '500' },

  // Modalità manuale
  manualBox:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  manualIconBox:     { width: 80, height: 80, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  manualTitle:       { color: Colors.text, fontSize: 22, fontWeight: '800' },
  manualSub:         { color: Colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  codeInput:         { alignSelf: 'stretch', backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 16, color: Colors.text, fontSize: 22, fontWeight: '800', letterSpacing: 4, textAlign: 'center' },
  activateBtn:       { borderRadius: 14, overflow: 'hidden', alignSelf: 'stretch' },
  activateBtnInner:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  activateBtnText:   { color: Colors.text, fontWeight: '800', fontSize: 16 },

  // Preview step
  confirmedBadge:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.4)', borderRadius: 12, padding: 12 },
  confirmedText:     { color: Colors.success, fontSize: 14, fontWeight: '600' },
  card:              { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 16, gap: 12 },
  vehicleRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox:           { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  vehicleTitle:      { color: Colors.text, fontWeight: '800', fontSize: 16 },
  vehicleSub:        { color: Colors.muted, fontSize: 13, marginTop: 2 },
  batteryPill:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  batteryText:       { fontSize: 13, fontWeight: '700' },
  destRow:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  destIcon:          { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  destLabel:         { color: Colors.muted, fontSize: 12 },
  destValue:         { color: Colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  sectionTitle:      { color: Colors.text, fontWeight: '700', fontSize: 15 },
  costRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costLabel:         { color: Colors.muted, fontSize: 14 },
  costValue:         { color: Colors.text, fontSize: 14, fontWeight: '600' },
  divider:           { height: 1, backgroundColor: Colors.border },
  costTotalLabel:    { color: Colors.text, fontSize: 15, fontWeight: '700' },
  costTotalValue:    { color: Colors.accent, fontSize: 18, fontWeight: '800' },
  note:              { color: Colors.muted, fontSize: 12, lineHeight: 17 },
  footer:            { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.card },
  startRideBtn:      { borderRadius: 16, overflow: 'hidden' },
  startRideBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  startRideBtnText:  { color: Colors.text, fontWeight: '800', fontSize: 16 },

  // Errore (usato in tutti gli step)
  errorBox:          { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', alignSelf: 'stretch' },
  errorText:         { color: Colors.danger, fontSize: 13, flex: 1, lineHeight: 18 },

  // Modale destinazione (preview)
  modalWrap:         { zIndex: 50, backgroundColor: 'rgba(0,0,0,0.6)' },
  modal:             { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(8,8,24,0.97)', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, borderWidth: 1, borderTopWidth: 0, borderColor: 'rgba(167,139,250,0.25)' },
  modalInputRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 62, paddingHorizontal: 20, paddingBottom: 16 },
  modalInput:        { flex: 1, color: Colors.text, fontSize: 17, paddingVertical: 0 },
  modalClose:        { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  modalDivider:      { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },
  modalBody:         { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 12, minHeight: 120 },
  modalItem:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  modalItemIcon:     { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  modalItemLabel:    { color: Colors.text, fontSize: 15, fontWeight: '500' },
  modalItemSub:      { color: Colors.muted, fontSize: 12, marginTop: 2 },
  modalEmpty:        { alignItems: 'center', paddingVertical: 28, gap: 8 },
  modalEmptyText:    { color: Colors.muted, fontSize: 14 },
});
