import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Animated, Easing, ActivityIndicator, Alert,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import VehicleCard, { Vehicle } from '@/components/ui/VehicleCard';
import { vehiclesApi, geoApi, restrizioniApi } from '@/lib/api/endpoints';
import type { ApiVehicle, ApiRouteOption } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSearch } from '@/lib/search/SearchContext';
import { useDeviceLocation } from '@/lib/useDeviceLocation';
import { haversineMeters, walkMinutes } from '@/lib/geo';

const SCREEN_H = Dimensions.get('window').height;
const SPRING = { tension: 280, friction: 28, useNativeDriver: true } as const;
const DEFAULT_CENTER = { latitude: 41.1177, longitude: 16.8718 };
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d0d1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d0d1a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e1e3a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0a18' }] },
];

interface Destination { label: string; lat: number; lng: number; }

type TypeFilter     = 'tutti' | 'scooter' | 'ebike' | 'car';
type BatteryFilter  = 'tutti' | '50' | '70';
type DistanceFilter = 'tutti' | '200' | '500';

const MAX_VEHICLES = 60;
const VEHICLE_TYPE_FILTERS: TypeFilter[] = ['tutti', 'scooter', 'ebike', 'car'];

function vehicleTypeIcon(type: string): keyof typeof MaterialCommunityIcons.glyphMap {
  if (type === 'scooter') return 'scooter';
  if (type === 'ebike') return 'bicycle-electric';
  return 'car-electric';
}

function vehicleTypeText(type: string) {
  if (type === 'scooter') return 'Monopattino';
  if (type === 'ebike') return 'E-Bike';
  if (type === 'car') return 'Auto elettrica';
  return 'Mezzo elettrico';
}

// Raggio massimo (km) entro cui mostrare i mezzi disponibili nella lista "Mezzi disponibili".
// Configurabile: cambiare qui per ampliare/restringere l'area di ricerca.
const DEFAULT_SEARCH_RADIUS_KM = 2;

/**
 * Calcola il "mezzo idoneo" per la destinazione scelta.
 * Criteri (dal Class Diagram GestioneCorsa e modello Percorso):
 *   - Percorso non ristretto (percorsoConRestrizioni = false) → preferito
 *   - Batteria più alta (batteria)
 *   - Distanza utente→mezzo più bassa (coordenate)
 *   - Costo stimato più basso (tipoMezzo, distanza)
 * Ogni fattore è normalizzato 0–1; punteggio composito pesato.
 */
function computeMezzoIdoneo(vehicles: Vehicle[], routesByType: Record<string, ApiRouteOption[]>): Vehicle | null {
  if (vehicles.length === 0) return null;

  const maxDist = Math.max(...vehicles.map(v => v.distanceToM), 1);
  const maxCost = Math.max(...vehicles.map(v => v.estimatedEur), 1);

  const scored = vehicles.map(v => {
    const opt = routesByType[v.type]?.[0] ?? null;
    const notRestricted = opt ? (opt.restricted ? 0 : 1) : 0;
    const battery  = v.batteryPct / 100;                          // 0–1, higher is better
    const proximity = 1 - v.distanceToM / maxDist;               // 0–1, closer is better
    const economy   = maxCost > 0 ? 1 - v.estimatedEur / maxCost : 1; // 0–1, cheaper is better

    // Option B — balanced user-centric: batteria 35%, prossimità 35%, costo 20%, restrizioni 10%
    const score = battery * 0.35 + proximity * 0.35 + economy * 0.20 + notRestricted * 0.10;
    return { vehicle: v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].vehicle;
}

/**
 * Trova il percorso più veloce tra tutti i tipi di mezzo disponibili.
 * Scorre routesByType, prende la prima opzione per ogni tipo (già ordinata
 * per ottimalità dal backend) e restituisce quella con duration_min minore.
 * Esclude percorsi con restrizioni se esiste almeno un'alternativa libera.
 */
function computePercorsoVeloce(
  routesByType: Record<string, ApiRouteOption[]>,
  vehicles: Vehicle[],
): { route: ApiRouteOption; vehicleType: string } | null {
  const candidates: { route: ApiRouteOption; vehicleType: string }[] = [];

  for (const [type, options] of Object.entries(routesByType)) {
    // Only consider types that have at least one available vehicle
    if (!vehicles.some(v => v.type === type)) continue;
    if (options.length === 0) continue;
    // Take the best (first) option for this vehicle type
    candidates.push({ route: options[0], vehicleType: type });
  }

  if (candidates.length === 0) return null;

  // Prefer unrestricted routes; among those pick minimum duration
  const free = candidates.filter(c => !c.route.restricted);
  const pool = free.length > 0 ? free : candidates;
  pool.sort((a, b) => a.route.duration_min - b.route.duration_min);
  return pool[0];
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; destLat?: string; destLng?: string }>();
  const { coords, status: locationStatus } = useDeviceLocation();
  // Query e destinazione condivise con la Home via SearchContext.
  const { token } = useAuth();
  const { query, setQuery, destination: ctxDestination, setDestination: setCtxDestination, clearDestination } = useSearch();

  const origin = coords ?? DEFAULT_CENTER;

  // ── Destinazione (con coordinate reali) — derivata dal context condiviso ────
  const destination: Destination | null = useMemo(
    () => (ctxDestination && ctxDestination.lat != null && ctxDestination.lng != null)
      ? { label: ctxDestination.addr, lat: ctxDestination.lat, lng: ctxDestination.lng }
      : null,
    [ctxDestination],
  );

  // Compatibilità deep-link: se la schermata riceve q/destLat/destLng via params
  // e il context è vuoto, lo inizializziamo (una sola volta, al mount).
  useEffect(() => {
    if (ctxDestination || !params.q) return;
    if (params.destLat && params.destLng) {
      setCtxDestination({ addr: params.q, lat: Number(params.destLat), lng: Number(params.destLng) });
      setQuery(params.q);
    } else {
      // Solo testo: geocodifica per ottenere il punto.
      let active = true;
      geoApi.geocode(params.q).then((res) => {
        if (active && res[0]) {
          setCtxDestination({ addr: params.q!, lat: res[0].lat, lng: res[0].lng });
          setQuery(params.q!);
        }
      }).catch(() => {});
      return () => { active = false; };
    }
  }, []);

  // ── Mezzi dal Controller ───────────────────────────────────────────────────
  const [rawVehicles, setRawVehicles] = useState<ApiVehicle[]>([]);
  useEffect(() => {
    vehiclesApi.list(true, origin.latitude, origin.longitude)
      .then(setRawVehicles)
      .catch(() => {});
  }, [coords?.latitude, coords?.longitude]);

  // ── Percorsi per tipo di mezzo (in base ai vincoli geografici) ─────────────
  const [routesByType, setRoutesByType] = useState<Record<string, ApiRouteOption[]>>({});
  const [routesLoading, setRoutesLoading] = useState(false);

  useEffect(() => {
    if (!destination || rawVehicles.length === 0) { setRoutesByType({}); return; }
    const tipi = Array.from(new Set(rawVehicles.map((v) => v.type)));
    let active = true;
    setRoutesLoading(true);
    Promise.all(
      tipi.map((t) =>
        geoApi.routeOptions(
          { lat: origin.latitude, lng: origin.longitude },
          { lat: destination.lat, lng: destination.lng },
          t,
        ).then((opts) => [t, opts] as const).catch(() => [t, [] as ApiRouteOption[]] as const),
      ),
    ).then((pairs) => {
      if (!active) return;
      setRoutesByType(Object.fromEntries(pairs));
    }).finally(() => { if (active) setRoutesLoading(false); });
    return () => { active = false; };
  }, [destination?.lat, destination?.lng, rawVehicles]);

  // Percorso ottimale (prima opzione) per un tipo di mezzo.
  const optimalFor = (type: string): ApiRouteOption | null => routesByType[type]?.[0] ?? null;

  // ── Costruzione card mezzi con dati reali calcolati ────────────────────────
  // Mostra SOLO i mezzi prelevabili (status === 'parked', non bloccati) ed entro
  // DEFAULT_SEARCH_RADIUS_KM dalla posizione GPS reale. Senza GPS: nessun mezzo.
  // Nota: il backend con only_available=true restituisce già solo parked & !locked.
  const allVehicles: Vehicle[] = useMemo(() => {
    if (!coords) return [];
    const radiusM = DEFAULT_SEARCH_RADIUS_KM * 1000;
    return rawVehicles
      .filter((v) => v.status === 'parked')
      .map((v) => ({ v, distanceToM: Math.round(haversineMeters(coords, { latitude: v.lat, longitude: v.lng })) }))
      .filter(({ distanceToM }) => distanceToM <= radiusM)
      .map(({ v, distanceToM }, idx) => {
        const opt = optimalFor(v.type);
        const tripKm = opt ? Math.round((opt.distance_m / 1000) * 10) / 10 : 0;
        const estMinutes = opt ? opt.duration_min : 0;
        const estimatedEur = Math.round((v.unlock_fee + v.price_per_min * estMinutes) * 100) / 100;
        return {
          id: String(v.id),
          name: v.name,
          model: v.model,
          type: v.type,
          batteryPct: v.battery_pct,
          distanceToM,
          walkMinutes: walkMinutes(distanceToM),
          tripKm,
          estimatedEur,
          recommended: idx === 0,
        };
      });
  }, [rawVehicles, routesByType, coords]);

  const [selected, setSelected]   = useState<Vehicle | null>(null);

  // ── Estensione UC: VisualizzaMezzoIdoneo (attivata esplicitamente dall'utente) ──
  const [idoneoVehicle, setIdoneoVehicle] = useState<Vehicle | null>(null);
  const [idoneoVisible, setIdoneoVisible] = useState(false);
  const [percorsoVeloce, setPercorsoVeloce]               = useState<{ route: ApiRouteOption; vehicleType: string } | null>(null);
  const [percorsoVeloceVisible, setPercorsoVeloceVisible] = useState(false);

  useEffect(() => {
    setSelected((cur) => allVehicles.find((v) => v.id === cur?.id) ?? allVehicles[0] ?? null);
  }, [allVehicles]);

  // ── Verifica restrizioni sulla destinazione (AP.04) ────────────────────────
  // Se la meta scelta ricade in un'area di restrizione attiva per il mezzo,
  // la corsa non è avviabile (notifica + pulsanti bloccati).
  const [restriction, setRestriction] = useState<{ restricted: boolean; aree: { id: number; nome: string; tipo: string }[] } | null>(null);
  useEffect(() => {
    if (!destination || !token) { setRestriction(null); return; }
    let active = true;
    restrizioniApi.verifica(token, destination.lat, destination.lng, selected?.type)
      .then((r) => { if (active) setRestriction(r); })
      .catch(() => { if (active) setRestriction(null); });
    return () => { active = false; };
  }, [destination?.lat, destination?.lng, selected?.type, token]);

  const destBloccata = restriction?.restricted === true;
  const restrNomi = (restriction?.aree ?? []).map((a) => a.nome).join(', ');

  // Mostra la notifica di blocco e impedisce l'avvio quando la meta è ristretta.
  const bloccaSeRistretta = (): boolean => {
    if (destBloccata) {
      Alert.alert(
        'Zona soggetta a restrizione',
        `La destinazione ricade in un'area di restrizione attiva${restrNomi ? ` (${restrNomi})` : ''}. Non è possibile avviare una corsa verso questa zona con il mezzo selezionato.`,
        [{ text: 'Ho capito' }],
      );
      return true;
    }
    return false;
  };

  // Reset del mezzo idoneo / percorso veloce quando cambia la destinazione.
  useEffect(() => {
    setIdoneoVehicle(null);
    setIdoneoVisible(false);
    setPercorsoVeloce(null);
    setPercorsoVeloceVisible(false);
  }, [destination?.lat, destination?.lng]);

  // Naviga ad activate.tsx per richiedere QR / codice prima di avviare la corsa.
  // La destinazione è opzionale: se non è stata inserita, la corsa parte senza percorso.
  const handleIniziaCorsa = (vehicle: Vehicle) => {
    if (bloccaSeRistretta()) return;
    router.push({
      pathname: '/(app)/activate',
      params: {
        prefill: `SM-${vehicle.id}`,
        fromLat: String(origin.latitude),
        fromLng: String(origin.longitude),
        ...(destination ? {
          toAddr: destination.label,
          toLat: String(destination.lat),
          toLng: String(destination.lng),
        } : {}),
      },
    });
  };

  // Naviga a reserve.tsx per prenotare il mezzo selezionato.
  const handlePrenota = (vehicle: Vehicle) => {
    if (bloccaSeRistretta()) return;
    router.push({
      pathname: '/(app)/reserve',
      params: {
        vehicleId: vehicle.id,
        fromLat: String(origin.latitude),
        fromLng: String(origin.longitude),
        ...(destination ? {
          toAddr: destination.label,
          toLat: String(destination.lat),
          toLng: String(destination.lng),
        } : {}),
      },
    });
  };

  // Estensione UC CercaDestinazione → VisualizzaMezzoIdoneo: calcola e mostra
  // il singolo mezzo migliore in un bottom-sheet dedicato (azione esplicita).
  const handleVisualizzaMezzoIdoneo = () => {
    const best = computeMezzoIdoneo(filteredVehicles, routesByType);
    setIdoneoVehicle(best);
    setIdoneoVisible(true);
  };

  // Estensione UC: PercorsoPiùVeloceReal-Time — calcola il tragitto più rapido.
  const handleVisualizzaPercorsoVeloce = () => {
    const best = computePercorsoVeloce(routesByType, filteredVehicles);
    setPercorsoVeloce(best);
    setPercorsoVeloceVisible(true);
  };

  // ── Search modal (geocoding reale) ─────────────────────────────────────────
  // L'input della modale è legato alla query condivisa (context): digitando qui
  // si aggiorna anche la barra della Home in tempo reale.
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [geoResults, setGeoResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const modalY = useRef(new Animated.Value(-700)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Geocodifica solo a modale aperta (la query è condivisa via context).
    if (!searchModalOpen || query.trim().length < 2) { setGeoResults([]); return; }
    let active = true;
    setGeoLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await geoApi.geocode(query.trim());
        if (active) setGeoResults(res);
      } catch { if (active) setGeoResults([]); }
      finally { if (active) setGeoLoading(false); }
    }, 450);
    return () => { active = false; clearTimeout(t); };
  }, [query, searchModalOpen]);

  const openSearchModal = () => {
    setSearchModalOpen(true);
    modalY.setValue(-700); modalOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(modalY, { toValue: 0, ...SPRING }),
      Animated.timing(modalOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };
  const closeSearchModal = (dest?: Destination) => {
    if (dest) { setCtxDestination({ addr: dest.label, lat: dest.lat, lng: dest.lng }); setQuery(dest.label); }
    Animated.parallel([
      Animated.timing(modalY, { toValue: -700, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setSearchModalOpen(false));
  };

  // ── Filtri ─────────────────────────────────────────────────────────────────
  const [filterVisible, setFilterVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('tutti');
  const [batteryFilter, setBatteryFilter] = useState<BatteryFilter>('tutti');
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>('tutti');
  const [pendingType, setPendingType] = useState<TypeFilter>('tutti');
  const [pendingBattery, setPendingBattery] = useState<BatteryFilter>('tutti');
  const [pendingDistance, setPendingDistance] = useState<DistanceFilter>('tutti');
  const filterSlide = useRef(new Animated.Value(SCREEN_H)).current;
  const cardAnims = useRef(
    Array.from({ length: MAX_VEHICLES }, () => ({ opacity: new Animated.Value(0), translateY: new Animated.Value(18) }))
  ).current;

  const openFilter = () => {
    setPendingType(typeFilter); setPendingBattery(batteryFilter); setPendingDistance(distanceFilter);
    setFilterVisible(true);
    Animated.spring(filterSlide, { toValue: 0, ...SPRING }).start();
  };
  const closeFilter = (apply = false) => {
    if (apply) { setTypeFilter(pendingType); setBatteryFilter(pendingBattery); setDistanceFilter(pendingDistance); }
    Animated.timing(filterSlide, { toValue: SCREEN_H, duration: 230, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(() => setFilterVisible(false));
  };
  const activeFilterCount = [typeFilter !== 'tutti', batteryFilter !== 'tutti', distanceFilter !== 'tutti'].filter(Boolean).length;

  const filteredVehicles = useMemo(() => {
    let list = [...allVehicles];
    if (typeFilter !== 'tutti')     list = list.filter(v => v.type === typeFilter);
    if (batteryFilter !== 'tutti')  list = list.filter(v => v.batteryPct >= parseInt(batteryFilter));
    if (distanceFilter !== 'tutti') list = list.filter(v => v.distanceToM <= parseInt(distanceFilter));
    return list;
  }, [allVehicles, typeFilter, batteryFilter, distanceFilter]);

  useEffect(() => {
    cardAnims.forEach(a => { a.opacity.setValue(0); a.translateY.setValue(18); });
    Animated.stagger(55, filteredVehicles.slice(0, cardAnims.length).map((_, i) =>
      Animated.parallel([
        Animated.spring(cardAnims[i].opacity, { toValue: 1, ...SPRING }),
        Animated.spring(cardAnims[i].translateY, { toValue: 0, ...SPRING }),
      ])
    )).start();
  }, [filteredVehicles]);

  // ── Percorso e opzioni del mezzo selezionato (per minimappa e lista tratte) ──
  const selOptions = selected ? (routesByType[selected.type] ?? []) : [];
  const selOptimal = selOptions[0] ?? null;
  const mapRegion = useMemo(() => {
    const c = destination
      ? { latitude: (origin.latitude + destination.lat) / 2, longitude: (origin.longitude + destination.lng) / 2 }
      : origin;
    return { ...c, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }, [destination?.lat, destination?.lng, origin.latitude, origin.longitude]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.searchBarBtn} onPress={openSearchModal} activeOpacity={0.8}>
          <Ionicons name="search-outline" size={16} color={query ? Colors.accent : Colors.muted} />
          <Text style={[styles.searchBarBtnText, query ? { color: Colors.text } : {}]} numberOfLines={1}>
            {query || 'Dove si va?'}
          </Text>
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); clearDestination(); }} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color={Colors.muted} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterBtn} onPress={openFilter} activeOpacity={0.75}>
          <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? Colors.accent : Colors.text} />
          {activeFilterCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Trip stats — calcolate dal percorso del mezzo selezionato */}
        <View style={styles.tripInfo}>
          <View style={styles.tripStat}>
            <Text style={styles.tripStatLabel}>Distanza</Text>
            <Text style={styles.tripStatValue}>{selOptimal ? `${(selOptimal.distance_m / 1000).toFixed(1)} km` : '—'}</Text>
          </View>
          <View style={styles.tripStat}>
            <Ionicons name="time-outline" size={14} color={Colors.muted} />
            <Text style={styles.tripStatLabel}>Tempo stimato</Text>
            <Text style={styles.tripStatValue}>{selOptimal ? `${selOptimal.duration_min} min` : '—'}</Text>
          </View>
          <View style={styles.tripStat}>
            <Text style={styles.tripStatLabel}>Prezzo stimato</Text>
            <Text style={[styles.tripStatValue, { color: Colors.accent }]}>{selected && selOptimal ? `€ ${selected.estimatedEur.toFixed(2)}` : '—'}</Text>
          </View>
        </View>

        {/* Minimappa con percorso ottimale reale */}
        <View style={styles.mapPreview}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFillObject}
            region={mapRegion}
            customMapStyle={DARK_MAP_STYLE}
            pointerEvents="none"
          >
            <Marker coordinate={origin}>
              <View style={styles.originDot}><Ionicons name="radio-button-on" size={18} color={Colors.primary} /></View>
            </Marker>
            {destination && (
              <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }}>
                <View style={styles.destDot}><Ionicons name="location" size={20} color={Colors.success} /></View>
              </Marker>
            )}
            {/* Alternative più chiare, percorso ottimale evidenziato */}
            {selOptions.slice(1).map((o, i) => (
              <Polyline key={`alt-${i}`} coordinates={o.points} strokeColor="rgba(167,139,250,0.35)" strokeWidth={3} />
            ))}
            {selOptimal && (
              <Polyline coordinates={selOptimal.points} strokeColor={Colors.accent} strokeWidth={5} />
            )}
          </MapView>
          {!destination && (
            <View style={styles.mapOverlay}><Text style={styles.mapHint}>Seleziona una destinazione per il percorso</Text></View>
          )}
          {destination && routesLoading && (
            <View style={styles.mapOverlay}><ActivityIndicator color={Colors.accent} /></View>
          )}
        </View>

        {/* Lista percorsi alternativi per il mezzo selezionato (vincoli geografici) */}
        {destination && selOptions.length > 0 && (
          <View style={styles.routesBox}>
            <Text style={styles.routesTitle}>Percorsi per {selected?.name ?? 'il mezzo'}</Text>
            {selOptions.map((o, i) => (
              <View key={i} style={[styles.routeRow, i === 0 && styles.routeRowBest]}>
                <Ionicons
                  name={o.restricted ? 'warning-outline' : i === 0 ? 'navigate' : 'git-branch-outline'}
                  size={16}
                  color={o.restricted ? Colors.warning : Colors.accent}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeLabel}>{o.label}</Text>
                  {o.restricted && (
                    <Text style={styles.routeWarn} numberOfLines={1}>Attraversa: {o.aree_vietate.join(', ')}</Text>
                  )}
                </View>
                <Text style={styles.routeMeta}>{(o.distance_m / 1000).toFixed(1)} km · {o.duration_min} min</Text>
              </View>
            ))}
          </View>
        )}

        {/* Estensioni UC (solo con destinazione scelta): attivate su pressione esplicita */}
        {destination !== null && (
          <>
            <TouchableOpacity
              style={styles.idoneoBtn}
              onPress={handleVisualizzaMezzoIdoneo}
              activeOpacity={0.85}
              disabled={!destination || routesLoading}
            >
              <LinearGradient
                colors={Gradients.primaryBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.idoneoBtnGradient}
              >
                <Ionicons name="star" size={18} color={Colors.text} />
                <Text style={styles.idoneoBtnText}>Visualizza Mezzo Idoneo</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.idoneoBtn}
              onPress={handleVisualizzaPercorsoVeloce}
              activeOpacity={0.85}
              disabled={!destination || routesLoading}
            >
              <LinearGradient
                colors={['#1e3a5f', '#0f2744']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.idoneoBtnGradient}
              >
                <Ionicons name="flash" size={18} color={Colors.text} />
                <Text style={styles.idoneoBtnText}>Visualizza Percorso Più Veloce</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* Lista mezzi — solo mezzi disponibili entro il raggio dalla posizione reale */}
        <View style={styles.vehicleSection}>
          <View style={styles.vehicleSectionHeader}>
            <Text style={styles.vehicleSectionTitle}>Mezzi disponibili</Text>
            {coords && (
              <View style={styles.vehicleCountBadge}><Text style={styles.vehicleCountText}>{filteredVehicles.length}</Text></View>
            )}
          </View>

          {!coords ? (
            (locationStatus === 'loading' || locationStatus === 'idle') ? (
              <View style={styles.emptyState}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={styles.emptyText}>Localizzazione in corso…</Text>
              </View>
            ) : (
              // SA-02a: permessi GPS negati o posizione non disponibile.
              <View style={styles.emptyState}>
                <Ionicons name="location-outline" size={40} color={Colors.muted} />
                <Text style={styles.emptyText}>Attiva la posizione per vedere i mezzi vicini</Text>
              </View>
            )
          ) : filteredVehicles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-sport-outline" size={40} color={Colors.muted} />
              <Text style={styles.emptyText}>Nessun mezzo disponibile entro {DEFAULT_SEARCH_RADIUS_KM} km</Text>
            </View>
          ) : (
            <>
              <Text style={styles.vehicleCountLine}>
                {filteredVehicles.length} {filteredVehicles.length === 1 ? 'mezzo disponibile' : 'mezzi disponibili'} entro {DEFAULT_SEARCH_RADIUS_KM} km
              </Text>
              <View style={{ paddingHorizontal: 16 }}>
                {filteredVehicles.map((v, idx) => {
                  const anim = cardAnims[idx];
                  return (
                    <Animated.View key={v.id} style={anim ? { opacity: anim.opacity, transform: [{ translateY: anim.translateY }] } : undefined}>
                      <VehicleCard vehicle={v} selected={selected?.id === v.id} onPress={setSelected} />
                    </Animated.View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      {selected && (
        <View style={styles.bottomBarWrap}>
          {destBloccata && (
            <View style={styles.restrBanner}>
              <Ionicons name="ban" size={16} color={Colors.danger} />
              <Text style={styles.restrBannerText} numberOfLines={2}>
                Destinazione in area di restrizione{restrNomi ? ` (${restrNomi})` : ''}: corsa non avviabile.
              </Text>
            </View>
          )}
          <View style={styles.bottomBar}>
            <View style={styles.bottomBarInfo}>
              <Text style={styles.bottomBarName}>{selected.name}</Text>
              <Text style={styles.bottomBarModel}>{selected.model}</Text>
              <Text style={styles.bottomBarDetails}>
                {selOptimal ? `${selected.tripKm} km · ${selOptimal.duration_min} min` : `${selected.distanceToM}m a piedi`}
              </Text>
              <Text style={styles.bottomBarPrice}>€ {selected.estimatedEur.toFixed(2)}</Text>
            </View>
            <View style={styles.bottomBarBtns}>
              <TouchableOpacity style={[styles.prenotaBtn, destBloccata && styles.btnBlocked]} onPress={() => handlePrenota(selected)} activeOpacity={0.85}>
                <LinearGradient colors={['#1e3a5f', '#0f2744']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.startBtnGradient}>
                  <Ionicons name="bookmark-outline" size={17} color={Colors.text} />
                  <Text style={styles.startBtnText}>Prenota</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.startBtn, destBloccata && styles.btnBlocked]} onPress={() => handleIniziaCorsa(selected)} activeOpacity={0.85}>
                <LinearGradient colors={destBloccata ? ['#3a2230', '#2a1822'] : Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.startBtnGradient}>
                  <Ionicons name={destBloccata ? 'ban' : 'qr-code-outline'} size={17} color={Colors.text} />
                  <Text style={styles.startBtnText}>Inizia corsa</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Search modal */}
      {searchModalOpen && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 50 }]} pointerEvents="box-none">
          <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: modalOpacity }]} pointerEvents="auto">
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => closeSearchModal()} />
          </Animated.View>
          <Animated.View style={[styles.searchModal, { transform: [{ translateY: modalY }] }]} pointerEvents="box-none">
            <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={styles.searchModalBg} pointerEvents="none" />
            <View style={styles.searchModalInputRow}>
              <Ionicons name="search-outline" size={20} color={Colors.accent} />
              <TextInput
                style={styles.searchModalInput}
                placeholder="Cerca destinazione"
                placeholderTextColor={Colors.muted}
                value={query}
                onChangeText={setQuery}
                autoFocus autoCorrect={false} returnKeyType="search"
              />
              <TouchableOpacity onPress={() => closeSearchModal()} style={styles.searchModalCloseBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchModalDivider} />
            <View style={styles.searchModalBody}>
              {geoLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
                  <ActivityIndicator color={Colors.accent} /><Text style={{ color: Colors.muted, fontSize: 14 }}>Ricerca…</Text>
                </View>
              ) : geoResults.length > 0 ? (
                geoResults.map((r, i) => {
                  const short = r.label.split(',').slice(0, 2).join(',');
                  return (
                    <TouchableOpacity key={`${r.lat}-${i}`} style={styles.searchModalItem}
                      onPress={() => closeSearchModal({ label: short, lat: r.lat, lng: r.lng })} activeOpacity={0.7}>
                      <View style={styles.searchModalItemIcon}><Ionicons name="location-outline" size={17} color={Colors.accent} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.searchModalItemLabel} numberOfLines={1}>{short}</Text>
                        <Text style={styles.searchModalItemSub} numberOfLines={1}>{r.label.split(',').slice(2, 4).join(',').trim() || 'Indirizzo'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
                  <Ionicons name="search-outline" size={34} color={Colors.muted} />
                  <Text style={{ color: Colors.muted, fontSize: 14 }}>{query.length < 2 ? 'Digita per cercare' : 'Nessun risultato'}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      )}

      {/* Filter sheet */}
      {filterVisible && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 50 }]} pointerEvents="box-none">
          <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => closeFilter(false)} />
          <Animated.View style={[styles.filterSheet, { transform: [{ translateY: filterSlide }] }]}>
            <View style={styles.filterHandleBar} />
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filtra mezzi</Text>
              <TouchableOpacity onPress={() => { setPendingType('tutti'); setPendingBattery('tutti'); setPendingDistance('tutti'); }} activeOpacity={0.7}>
                <Text style={styles.filterReset}>Azzera tutto</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.filterSectionLabel}>TIPO DI MEZZO</Text>
            <View style={styles.chipRow}>
              {VEHICLE_TYPE_FILTERS.map(t => (
                <TouchableOpacity key={t} style={[styles.chip, pendingType === t && styles.chipActive]} onPress={() => setPendingType(t)} activeOpacity={0.75}>
                  <Text style={[styles.chipText, pendingType === t && styles.chipTextActive]}>
                    {t === 'tutti' ? 'Tutti' : vehicleTypeText(t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterSectionLabel}>BATTERIA MINIMA</Text>
            <View style={styles.chipRow}>
              {(['tutti', '50', '70'] as BatteryFilter[]).map(b => (
                <TouchableOpacity key={b} style={[styles.chip, pendingBattery === b && styles.chipActive]} onPress={() => setPendingBattery(b)} activeOpacity={0.75}>
                  <Text style={[styles.chipText, pendingBattery === b && styles.chipTextActive]}>{b === 'tutti' ? 'Qualsiasi' : `> ${b}%`}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterSectionLabel}>DISTANZA MASSIMA</Text>
            <View style={styles.chipRow}>
              {(['tutti', '200', '500'] as DistanceFilter[]).map(d => (
                <TouchableOpacity key={d} style={[styles.chip, pendingDistance === d && styles.chipActive]} onPress={() => setPendingDistance(d)} activeOpacity={0.75}>
                  <Text style={[styles.chipText, pendingDistance === d && styles.chipTextActive]}>{d === 'tutti' ? 'Qualsiasi' : `< ${d}m`}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => closeFilter(true)} style={styles.applyBtn} activeOpacity={0.85}>
              <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.applyBtnGradient}>
                <Text style={styles.applyBtnText}>Applica filtri</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* Bottom sheet: Mezzo Idoneo (estensione UC) */}
      {idoneoVisible && idoneoVehicle && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 60 }]} pointerEvents="box-none">
          {/* Dim backdrop */}
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
            activeOpacity={1}
            onPress={() => setIdoneoVisible(false)}
          />
          {/* Sheet */}
          <View style={styles.idoneoSheet}>
            {/* Header */}
            <View style={styles.idoneoSheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.idoneoSheetTitle}>Mezzo Idoneo</Text>
                <Text style={styles.idoneoSheetSub}>
                  Calcolato su batteria e vicinanza (35% ciascuno), costo (20%) e percorso libero (10%)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIdoneoVisible(false)} style={styles.idoneoCloseBtn}>
                <Ionicons name="close" size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Star badge */}
            <View style={styles.idoneoBadgeRow}>
              <LinearGradient colors={Gradients.primaryBtn} style={styles.idoneoBadge}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="star" size={13} color={Colors.text} />
                <Text style={styles.idoneoBadgeText}>CONSIGLIATO PER TE</Text>
              </LinearGradient>
            </View>

            {/* Vehicle card — reuse VehicleCard component */}
            <View style={{ paddingHorizontal: 4 }}>
              <VehicleCard
                vehicle={idoneoVehicle}
                selected={true}
                onPress={() => {}}
              />
            </View>

            {/* Score breakdown */}
            {(() => {
              const opt = routesByType[idoneoVehicle.type]?.[0] ?? null;
              return (
                <View style={styles.idoneoScoreRow}>
                  <View style={styles.idoneoScoreItem}>
                    <Ionicons name="battery-charging-outline" size={16}
                      color={idoneoVehicle.batteryPct > 50 ? Colors.success : Colors.warning} />
                    <Text style={styles.idoneoScoreLabel}>{idoneoVehicle.batteryPct}% batteria</Text>
                  </View>
                  <View style={styles.idoneoScoreItem}>
                    <Ionicons name="walk-outline" size={16} color={Colors.accent} />
                    <Text style={styles.idoneoScoreLabel}>{idoneoVehicle.distanceToM}m da te</Text>
                  </View>
                  <View style={styles.idoneoScoreItem}>
                    <Ionicons
                      name={opt?.restricted ? 'warning-outline' : 'checkmark-circle-outline'}
                      size={16}
                      color={opt?.restricted ? Colors.warning : Colors.success}
                    />
                    <Text style={styles.idoneoScoreLabel}>
                      {opt?.restricted ? 'Percorso con limiti' : 'Percorso libero'}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* CTA */}
            <TouchableOpacity
              style={styles.idoneoStartBtn}
              onPress={() => {
                setIdoneoVisible(false);
                handleIniziaCorsa(idoneoVehicle);
              }}
              activeOpacity={0.85}
            >
              <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.idoneoStartGradient}>
                <Ionicons name="flash" size={18} color={Colors.text} />
                <Text style={styles.idoneoStartText}>Usa questo mezzo</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom sheet: Percorso Più Veloce (estensione UC) */}
      {percorsoVeloceVisible && percorsoVeloce && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 61 }]} pointerEvents="box-none">
          {/* Backdrop */}
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
            activeOpacity={1}
            onPress={() => setPercorsoVeloceVisible(false)}
          />

          {/* Sheet */}
          <View style={styles.idoneoSheet}>

            {/* Header */}
            <View style={styles.idoneoSheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.idoneoSheetTitle}>Percorso Più Veloce</Text>
                <Text style={styles.idoneoSheetSub}>
                  Il tragitto con minor tempo stimato tra tutti i mezzi disponibili
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPercorsoVeloceVisible(false)}
                style={styles.idoneoCloseBtn}
              >
                <Ionicons name="close" size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Badge */}
            <View style={styles.idoneoBadgeRow}>
              <LinearGradient
                colors={['#1e3a5f', '#0f2744']}
                style={styles.idoneoBadge}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Ionicons name="flash" size={13} color={Colors.text} />
                <Text style={styles.idoneoBadgeText}>PERCORSO PIÙ RAPIDO</Text>
              </LinearGradient>
            </View>

            {/* Banner veicolo consigliato per il percorso */}
            {(() => {
              const bestVehicleForType = filteredVehicles.find(
                v => v.type === percorsoVeloce.vehicleType
              );
              if (!bestVehicleForType) return null;
              return (
                <View style={styles.percorsoVehicleBanner}>
                  <View style={styles.percorsoVehicleBannerIcon}>
                    <MaterialCommunityIcons
                      name={vehicleTypeIcon(percorsoVeloce.vehicleType)}
                      size={22}
                      color={Colors.accent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.percorsoVehicleBannerTitle}>
                      Utilizzando Questo Veicolo
                    </Text>
                    <Text style={styles.percorsoVehicleBannerSub} numberOfLines={1}>
                      {bestVehicleForType.name} · {bestVehicleForType.model} ·{' '}
                      {bestVehicleForType.batteryPct}% batteria ·{' '}
                      {bestVehicleForType.distanceToM}m da te
                    </Text>
                  </View>
                  <Text style={styles.percorsoVehicleBannerPrice}>
                    € {bestVehicleForType.estimatedEur.toFixed(2)}
                  </Text>
                </View>
              );
            })()}

            {/* Route stats card */}
            <View style={styles.percorsoCard}>
              {/* Vehicle type row */}
              <View style={styles.percorsoTypeRow}>
                <MaterialCommunityIcons
                  name={vehicleTypeIcon(percorsoVeloce.vehicleType)}
                  size={22}
                  color={Colors.accent}
                />
                <Text style={styles.percorsoTypeLabel}>
                  {vehicleTypeText(percorsoVeloce.vehicleType)}
                </Text>
                {percorsoVeloce.route.restricted && (
                  <View style={styles.restrictedPill}>
                    <Ionicons name="warning-outline" size={12} color={Colors.warning} />
                    <Text style={styles.restrictedPillText}>Zona limitata</Text>
                  </View>
                )}
              </View>

              {/* Stat row */}
              <View style={styles.percorsoStats}>
                <View style={styles.percorsoStat}>
                  <Ionicons name="time-outline" size={20} color={Colors.accent} />
                  <Text style={styles.percorsoStatValue}>
                    {percorsoVeloce.route.duration_min} min
                  </Text>
                  <Text style={styles.percorsoStatLabel}>Tempo stimato</Text>
                </View>
                <View style={[styles.percorsoStat, styles.percorsoStatBorder]}>
                  <Ionicons name="navigate-outline" size={20} color={Colors.accent} />
                  <Text style={styles.percorsoStatValue}>
                    {(percorsoVeloce.route.distance_m / 1000).toFixed(1)} km
                  </Text>
                  <Text style={styles.percorsoStatLabel}>Distanza</Text>
                </View>
                <View style={styles.percorsoStat}>
                  <Ionicons
                    name={percorsoVeloce.route.restricted ? 'warning-outline' : 'checkmark-circle-outline'}
                    size={20}
                    color={percorsoVeloce.route.restricted ? Colors.warning : Colors.success}
                  />
                  <Text style={styles.percorsoStatValue}>
                    {percorsoVeloce.route.restricted ? 'Limitato' : 'Libero'}
                  </Text>
                  <Text style={styles.percorsoStatLabel}>Percorso</Text>
                </View>
              </View>

              {/* Route label */}
              <Text style={styles.percorsoRouteLabel}>{percorsoVeloce.route.label}</Text>

              {/* Restricted areas warning */}
              {percorsoVeloce.route.restricted && percorsoVeloce.route.aree_vietate.length > 0 && (
                <View style={styles.percorsoWarnBox}>
                  <Ionicons name="warning-outline" size={14} color={Colors.warning} />
                  <Text style={styles.percorsoWarnText}>
                    Attraversa: {percorsoVeloce.route.aree_vietate.join(', ')}
                  </Text>
                </View>
              )}
            </View>

            {/* Map mini-preview of the fastest route polyline */}
            {percorsoVeloce.route.points.length > 1 && destination && (
              <View style={styles.percorsoMapCard}>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={StyleSheet.absoluteFillObject}
                  region={{
                    latitude:  (percorsoVeloce.route.points[0].latitude  + destination.lat) / 2,
                    longitude: (percorsoVeloce.route.points[0].longitude + destination.lng) / 2,
                    latitudeDelta: 0.04, longitudeDelta: 0.04,
                  }}
                  customMapStyle={DARK_MAP_STYLE}
                  pointerEvents="none"
                >
                  <Polyline
                    coordinates={percorsoVeloce.route.points}
                    strokeColor={Colors.accent}
                    strokeWidth={5}
                  />
                  <Marker coordinate={percorsoVeloce.route.points[0]}>
                    <View style={styles.originDot}>
                      <Ionicons name="radio-button-on" size={18} color={Colors.primary} />
                    </View>
                  </Marker>
                  <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }}>
                    <View style={styles.destDot}>
                      <Ionicons name="location" size={20} color={Colors.success} />
                    </View>
                  </Marker>
                </MapView>
              </View>
            )}

            {/* CTA */}
            <TouchableOpacity
              style={styles.idoneoStartBtn}
              onPress={() => {
                setPercorsoVeloceVisible(false);
                const bestForType = filteredVehicles.find(
                  v => v.type === percorsoVeloce.vehicleType
                ) ?? filteredVehicles[0];
                if (bestForType) handleIniziaCorsa(bestForType);
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1e3a5f', '#0f2744']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.idoneoStartGradient}
              >
                <Ionicons name="flash" size={18} color={Colors.text} />
                <Text style={styles.idoneoStartText}>Usa questo percorso</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: Colors.bg },
  header:              { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:             { padding: 4 },
  searchBarBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 14, height: 42, paddingHorizontal: 12 },
  searchBarBtnText:    { flex: 1, color: Colors.muted, fontSize: 15 },
  filterBtn:           { padding: 6, position: 'relative' },
  filterBadge:         { position: 'absolute', top: 0, right: 0, backgroundColor: Colors.accent, borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText:     { color: Colors.text, fontSize: 10, fontWeight: '800' },

  tripInfo:            { flexDirection: 'row', justifyContent: 'space-around', padding: 16, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tripStat:            { alignItems: 'center', gap: 2 },
  tripStatLabel:       { color: Colors.muted, fontSize: 11 },
  tripStatValue:       { color: Colors.text, fontWeight: '700', fontSize: 15 },

  mapPreview:          { height: 170, margin: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  mapOverlay:          { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,13,26,0.4)' },
  mapHint:             { color: Colors.text, fontSize: 13, fontWeight: '500', paddingHorizontal: 16, textAlign: 'center' },
  originDot:           { padding: 2 },
  destDot:             { padding: 2 },

  routesBox:           { marginHorizontal: 16, marginBottom: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 14, gap: 8 },
  routesTitle:         { color: Colors.text, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  routeRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 10 },
  routeRowBest:        { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.1)' },
  routeLabel:          { color: Colors.text, fontSize: 13, fontWeight: '600' },
  routeWarn:           { color: Colors.warning, fontSize: 11, marginTop: 2 },
  routeMeta:           { color: Colors.muted, fontSize: 12, fontWeight: '600' },

  vehicleSection:      { gap: 12 },
  vehicleSectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  vehicleSectionTitle: { color: Colors.text, fontWeight: '700', fontSize: 16, flex: 1 },
  vehicleCountBadge:   { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  vehicleCountText:    { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  vehicleCountLine:    { color: Colors.muted, fontSize: 13, paddingHorizontal: 16, marginBottom: 4 },
  emptyState:          { alignItems: 'center', gap: 8, paddingVertical: 40, marginHorizontal: 16 },
  emptyText:           { color: Colors.text, fontWeight: '600', fontSize: 15 },

  bottomBarWrap:       { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomBar:           { backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 10 },
  restrBanner:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.15)', borderTopWidth: 1, borderColor: Colors.danger, paddingHorizontal: 16, paddingVertical: 10 },
  restrBannerText:     { color: Colors.danger, fontSize: 12, fontWeight: '600', flex: 1 },
  btnBlocked:          { opacity: 0.6 },
  bottomBarInfo:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottomBarName:       { color: Colors.text, fontWeight: '700', fontSize: 14 },
  bottomBarModel:      { color: Colors.muted, fontSize: 12, flex: 1 },
  bottomBarDetails:    { color: Colors.muted, fontSize: 11 },
  bottomBarRight:      { alignItems: 'flex-end', gap: 2 },
  bottomBarPrice:      { color: Colors.accent, fontWeight: '800', fontSize: 16, marginLeft: 'auto' },
  bottomBarBtns:       { flexDirection: 'row', gap: 10 },
  prenotaBtn:          { flex: 1, borderRadius: 14, overflow: 'hidden' },
  startBtn:            { flex: 1.3, borderRadius: 14, overflow: 'hidden' },
  startBtnGradient:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 14, paddingHorizontal: 12 },
  startBtnText:        { color: Colors.text, fontWeight: '700', fontSize: 14 },

  searchModal:         { position: 'absolute', top: 0, left: 0, right: 0, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', borderWidth: 1, borderTopWidth: 0, borderColor: 'rgba(167,139,250,0.25)' },
  searchModalBg:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,8,24,0.88)' },
  searchModalInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 62, paddingHorizontal: 20, paddingBottom: 16 },
  searchModalInput:    { flex: 1, color: Colors.text, fontSize: 17, paddingVertical: 0 },
  searchModalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  searchModalDivider:  { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },
  searchModalBody:     { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 16 },
  searchModalItem:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  searchModalItemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  searchModalItemLabel: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  searchModalItemSub:  { color: Colors.muted, fontSize: 12, marginTop: 2 },

  filterOverlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  filterSheet:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.border, paddingHorizontal: 20, paddingBottom: 36 },
  filterHandleBar:     { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  filterHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  filterTitle:         { color: Colors.text, fontSize: 18, fontWeight: '800' },
  filterReset:         { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  filterSectionLabel:  { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  chipRow:             { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip:                { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  chipActive:          { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: Colors.primary },
  chipText:            { color: Colors.muted, fontSize: 14, fontWeight: '500' },
  chipTextActive:      { color: Colors.text, fontWeight: '700' },
  applyBtn:            { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  applyBtnGradient:    { alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  applyBtnText:        { color: Colors.text, fontSize: 16, fontWeight: '700' },

  idoneoBtn:           { borderRadius: 14, overflow: 'hidden', marginHorizontal: 16, marginBottom: 12 },
  idoneoBtnGradient:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                         gap: 8, paddingVertical: 13 },
  idoneoBtnText:       { color: Colors.text, fontSize: 15, fontWeight: '700' },

  idoneoSheet:         { position: 'absolute', bottom: 0, left: 0, right: 0,
                         backgroundColor: 'rgba(13,13,26,0.98)',
                         borderTopLeftRadius: 28, borderTopRightRadius: 28,
                         borderWidth: 1, borderBottomWidth: 0,
                         borderColor: 'rgba(167,139,250,0.3)',
                         paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },
  idoneoSheetHeader:   { flexDirection: 'row', alignItems: 'flex-start',
                         paddingVertical: 16, gap: 12 },
  idoneoSheetTitle:    { color: Colors.text, fontSize: 18, fontWeight: '800' },
  idoneoSheetSub:      { color: Colors.muted, fontSize: 12, marginTop: 3 },
  idoneoCloseBtn:      { width: 32, height: 32, borderRadius: 16,
                         backgroundColor: 'rgba(255,255,255,0.08)',
                         alignItems: 'center', justifyContent: 'center' },
  idoneoBadgeRow:      { marginBottom: 10 },
  idoneoBadge:         { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                         borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  idoneoBadgeText:     { color: Colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  idoneoScoreRow:      { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 4,
                         flexWrap: 'wrap' },
  idoneoScoreItem:     { flexDirection: 'row', alignItems: 'center', gap: 5,
                         backgroundColor: Colors.surface, borderWidth: 1,
                         borderColor: Colors.border, borderRadius: 20,
                         paddingHorizontal: 10, paddingVertical: 5 },
  idoneoScoreLabel:    { color: Colors.muted, fontSize: 12 },
  idoneoStartBtn:      { borderRadius: 16, overflow: 'hidden', marginTop: 16 },
  idoneoStartGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                         gap: 8, paddingVertical: 15 },
  idoneoStartText:     { color: Colors.text, fontSize: 16, fontWeight: '700' },

  percorsoCard:       { backgroundColor: Colors.surface, borderWidth: 1,
                        borderColor: Colors.border, borderRadius: 16,
                        padding: 14, gap: 12, marginBottom: 12 },
  percorsoTypeRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  percorsoTypeLabel:  { color: Colors.text, fontWeight: '700', fontSize: 15, flex: 1 },
  restrictedPill:     { flexDirection: 'row', alignItems: 'center', gap: 4,
                        backgroundColor: 'rgba(245,158,11,0.15)',
                        borderWidth: 1, borderColor: Colors.warning,
                        borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  restrictedPillText: { color: Colors.warning, fontSize: 11, fontWeight: '600' },
  percorsoStats:      { flexDirection: 'row', backgroundColor: Colors.card,
                        borderWidth: 1, borderColor: Colors.border, borderRadius: 14 },
  percorsoStat:       { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  percorsoStatBorder: { borderLeftWidth: 1, borderRightWidth: 1,
                        borderColor: Colors.border },
  percorsoStatValue:  { color: Colors.text, fontWeight: '800', fontSize: 15 },
  percorsoStatLabel:  { color: Colors.muted, fontSize: 11 },
  percorsoRouteLabel: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  percorsoWarnBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6,
                        backgroundColor: 'rgba(245,158,11,0.08)',
                        borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
                        borderRadius: 10, padding: 10 },
  percorsoWarnText:   { color: Colors.warning, fontSize: 12, flex: 1, lineHeight: 17 },
  percorsoMapCard:    { height: 150, borderRadius: 14, overflow: 'hidden',
                        borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  percorsoVehicleBanner:      { flexDirection: 'row', alignItems: 'center', gap: 12,
                                 backgroundColor: 'rgba(79,142,247,0.1)',
                                 borderWidth: 1, borderColor: 'rgba(79,142,247,0.35)',
                                 borderRadius: 14, padding: 12, marginBottom: 12 },
  percorsoVehicleBannerIcon:  { width: 44, height: 44, borderRadius: 12,
                                 backgroundColor: Colors.surface,
                                 alignItems: 'center', justifyContent: 'center',
                                 borderWidth: 1, borderColor: Colors.border },
  percorsoVehicleBannerTitle: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  percorsoVehicleBannerSub:   { color: Colors.muted, fontSize: 11, marginTop: 2 },
  percorsoVehicleBannerPrice: { color: Colors.accent, fontWeight: '800', fontSize: 15 },
});
