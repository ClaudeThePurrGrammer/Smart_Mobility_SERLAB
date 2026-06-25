import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Animated, Easing, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import VehicleCard, { Vehicle } from '@/components/ui/VehicleCard';
import { vehiclesApi, ridesApi, geoApi } from '@/lib/api/endpoints';
import type { ApiVehicle, ApiRouteOption } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
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

type TypeFilter     = 'tutti' | 'scooter' | 'ebike' | 'bike';
type BatteryFilter  = 'tutti' | '50' | '70';
type DistanceFilter = 'tutti' | '200' | '500';

const TABS = ['Miglior scelta', 'Più veloce', 'Più economico'] as const;
const MAX_VEHICLES = 60;

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; destLat?: string; destLng?: string }>();
  const { token } = useAuth();
  const { coords } = useDeviceLocation();

  const origin = coords ?? DEFAULT_CENTER;

  // ── Destinazione (con coordinate reali) ────────────────────────────────────
  const [destination, setDestination] = useState<Destination | null>(
    params.q && params.destLat && params.destLng
      ? { label: params.q, lat: Number(params.destLat), lng: Number(params.destLng) }
      : null,
  );
  const [displayText, setDisplayText] = useState(params.q ?? '');

  // Se arriva solo il testo (q) senza coordinate, geocodifica per ottenere il punto.
  useEffect(() => {
    if (destination || !params.q) return;
    let active = true;
    geoApi.geocode(params.q).then((res) => {
      if (active && res[0]) setDestination({ label: params.q!, lat: res[0].lat, lng: res[0].lng });
    }).catch(() => {});
    return () => { active = false; };
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
  const allVehicles: Vehicle[] = useMemo(() => {
    return rawVehicles.map((v, idx) => {
      const distanceToM = Math.round(haversineMeters(origin, { latitude: v.lat, longitude: v.lng }));
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
  }, [rawVehicles, routesByType, origin.latitude, origin.longitude]);

  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Miglior scelta');
  const [selected, setSelected]   = useState<Vehicle | null>(null);

  useEffect(() => {
    setSelected((cur) => allVehicles.find((v) => v.id === cur?.id) ?? allVehicles[0] ?? null);
  }, [allVehicles]);

  const startRide = async (vehicle: Vehicle) => {
    const opt = optimalFor(vehicle.type);
    try {
      if (token) {
        const ride = await ridesApi.start(token, {
          vehicle_id: Number(vehicle.id),
          vehicle_type: vehicle.type,
          from_addr: 'Posizione attuale',
          to_addr: destination?.label ?? '',
        });
        router.push({
          pathname: '/(app)/active-ride',
          params: {
            rideId: String(ride.id),
            fromLat: String(origin.latitude), fromLng: String(origin.longitude),
            ...(destination ? { toLat: String(destination.lat), toLng: String(destination.lng), dest: destination.label } : {}),
            ...(opt ? { km: String(vehicle.tripKm), durMin: String(opt.duration_min) } : {}),
          },
        });
        return;
      }
    } catch { /* prosegue comunque */ }
    router.push('/(app)/active-ride');
  };

  // ── Search modal (geocoding reale) ─────────────────────────────────────────
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [modalQuery, setModalQuery] = useState('');
  const [geoResults, setGeoResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const modalY = useRef(new Animated.Value(-700)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (modalQuery.trim().length < 2) { setGeoResults([]); return; }
    let active = true;
    setGeoLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await geoApi.geocode(modalQuery.trim());
        if (active) setGeoResults(res);
      } catch { if (active) setGeoResults([]); }
      finally { if (active) setGeoLoading(false); }
    }, 450);
    return () => { active = false; clearTimeout(t); };
  }, [modalQuery]);

  const openSearchModal = () => {
    setModalQuery('');
    setSearchModalOpen(true);
    modalY.setValue(-700); modalOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(modalY, { toValue: 0, ...SPRING }),
      Animated.timing(modalOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };
  const closeSearchModal = (dest?: Destination) => {
    if (dest) { setDestination(dest); setDisplayText(dest.label); }
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
    if (activeTab === 'Più veloce')         list.sort((a, b) => a.tripKm - b.tripKm);
    else if (activeTab === 'Più economico') list.sort((a, b) => a.estimatedEur - b.estimatedEur);
    else list.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
    return list;
  }, [allVehicles, typeFilter, batteryFilter, distanceFilter, activeTab]);

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
          <Ionicons name="search-outline" size={16} color={Colors.muted} />
          <Text style={[styles.searchBarBtnText, displayText ? { color: Colors.text } : {}]} numberOfLines={1}>
            {displayText || 'Dove si va?'}
          </Text>
          {displayText.length > 0 && (
            <TouchableOpacity onPress={() => { setDisplayText(''); setDestination(null); }} activeOpacity={0.7}>
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

        {/* Sort tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
          {TABS.map(tab => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.tabActive]} activeOpacity={0.75}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'Miglior scelta' ? '⭐ ' : tab === 'Più veloce' ? '⚡ ' : '$ '}{tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Lista mezzi */}
        <View style={styles.vehicleSection}>
          <View style={styles.vehicleSectionHeader}>
            <Text style={styles.vehicleSectionTitle}>Mezzi disponibili</Text>
            <View style={styles.vehicleCountBadge}><Text style={styles.vehicleCountText}>{filteredVehicles.length}</Text></View>
          </View>
          {filteredVehicles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bicycle-outline" size={40} color={Colors.muted} />
              <Text style={styles.emptyText}>Nessun mezzo trovato</Text>
            </View>
          ) : (
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
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      {selected && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarInfo}>
            <Text style={styles.bottomBarName}>{selected.name}</Text>
            <Text style={styles.bottomBarModel}>{selected.model}</Text>
            <Text style={styles.bottomBarDetails}>
              {selOptimal ? `${selected.tripKm} km · ${selOptimal.duration_min} min` : `${selected.distanceToM}m a piedi`}
            </Text>
          </View>
          <View style={styles.bottomBarRight}>
            <Text style={styles.bottomBarPrice}>€ {selected.estimatedEur.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.startBtn} onPress={() => startRide(selected)} activeOpacity={0.85} disabled={!destination}>
            <LinearGradient colors={destination ? Gradients.primaryBtn : ['#2A2A40', '#22223A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.startBtnGradient}>
              <Text style={[styles.startBtnText, !destination && { color: Colors.muted }]}>{destination ? 'Inizia corsa' : 'Scegli meta'}</Text>
              <Ionicons name="arrow-forward" size={18} color={destination ? Colors.text : Colors.muted} />
            </LinearGradient>
          </TouchableOpacity>
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
                value={modalQuery}
                onChangeText={setModalQuery}
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
                  <Text style={{ color: Colors.muted, fontSize: 14 }}>{modalQuery.length < 2 ? 'Digita per cercare' : 'Nessun risultato'}</Text>
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
              {(['tutti', 'scooter', 'ebike', 'bike'] as TypeFilter[]).map(t => (
                <TouchableOpacity key={t} style={[styles.chip, pendingType === t && styles.chipActive]} onPress={() => setPendingType(t)} activeOpacity={0.75}>
                  <Text style={[styles.chipText, pendingType === t && styles.chipTextActive]}>
                    {t === 'tutti' ? 'Tutti' : t === 'scooter' ? 'Monopattino' : t === 'ebike' ? 'E-Bike' : 'Bici'}
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

  tabsScroll:          { marginBottom: 16 },
  tab:                 { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  tabActive:           { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: Colors.primary },
  tabText:             { color: Colors.muted, fontSize: 13, fontWeight: '500' },
  tabTextActive:       { color: Colors.text, fontWeight: '700' },

  vehicleSection:      { gap: 12 },
  vehicleSectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  vehicleSectionTitle: { color: Colors.text, fontWeight: '700', fontSize: 16, flex: 1 },
  vehicleCountBadge:   { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  vehicleCountText:    { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  emptyState:          { alignItems: 'center', gap: 8, paddingVertical: 40, marginHorizontal: 16 },
  emptyText:           { color: Colors.text, fontWeight: '600', fontSize: 15 },

  bottomBar:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottomBarInfo:       { flex: 1, gap: 2 },
  bottomBarName:       { color: Colors.text, fontWeight: '700', fontSize: 14 },
  bottomBarModel:      { color: Colors.muted, fontSize: 12 },
  bottomBarDetails:    { color: Colors.muted, fontSize: 11 },
  bottomBarRight:      { alignItems: 'flex-end', gap: 2 },
  bottomBarPrice:      { color: Colors.accent, fontWeight: '800', fontSize: 18 },
  startBtn:            { borderRadius: 14, overflow: 'hidden' },
  startBtnGradient:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 20 },
  startBtnText:        { color: Colors.text, fontWeight: '700', fontSize: 15 },

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
});
