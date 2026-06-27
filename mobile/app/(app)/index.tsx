import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, StyleSheet,
  Animated, PanResponder, Dimensions, Easing,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { useDeviceLocation } from '@/lib/useDeviceLocation';
import { vehicleIcon, toMapVehicle, type MapVehicle } from '@/lib/vehicles';
import { haversineMeters, formatDistance } from '@/lib/geo';
import { vehiclesApi, geoApi, parkingApi } from '@/lib/api/endpoints';
import type { ApiGeocodeResult, ApiParkingArea } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRideSession } from '@/lib/ride/RideSessionContext';
import { useReservationSession } from '@/lib/reservation/ReservationSessionContext';
import { useSearch } from '@/lib/search/SearchContext';
import VehicleDetailSheet from '@/components/map/VehicleDetailSheet';
import ManualLocationModal from '@/components/map/ManualLocationModal';

const { height: SCREEN_H } = Dimensions.get('window');

const SNAP_COLLAPSED = SCREEN_H * 0.22;
const SNAP_EXPANDED  = SCREEN_H * 0.45;
const DRAWER_WIDTH   = 260;

const SPRING_CFG  = { tension: 280, friction: 28, useNativeDriver: true  } as const;
const SPRING_SLOW = { tension: 180, friction: 22, useNativeDriver: false } as const;

const DARK_MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#0d0d1a' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0d0d1a' }] },
  { featureType: 'road',                elementType: 'geometry',        stylers: [{ color: '#1e1e3a' }] },
  { featureType: 'road',                elementType: 'geometry.stroke', stylers: [{ color: '#13132a' }] },
  { featureType: 'road.highway',        elementType: 'geometry',        stylers: [{ color: '#2a2a4e' }] },
  { featureType: 'road.highway',        elementType: 'geometry.stroke', stylers: [{ color: '#1a1a35' }] },
  { featureType: 'road',                elementType: 'labels.text.fill',stylers: [{ color: '#94a3b8' }] },
  { featureType: 'water',               elementType: 'geometry',        stylers: [{ color: '#0a0a18' }] },
  { featureType: 'water',               elementType: 'labels.text.fill',stylers: [{ color: '#374151' }] },
  { featureType: 'poi',                 elementType: 'geometry',        stylers: [{ color: '#13132a' }] },
  { featureType: 'poi',                 elementType: 'labels.text.fill',stylers: [{ color: '#4b5563' }] },
  { featureType: 'poi.park',            elementType: 'geometry',        stylers: [{ color: '#111122' }] },
  { featureType: 'transit',             elementType: 'geometry',        stylers: [{ color: '#1a1a35' }] },
  { featureType: 'transit.station',     elementType: 'labels.text.fill',stylers: [{ color: '#6366f1' }] },
  { featureType: 'administrative',      elementType: 'geometry.stroke', stylers: [{ color: '#2a2a50' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'landscape',           elementType: 'geometry',        stylers: [{ color: '#0f0f24' }] },
];

// Regione di default (zona Bari) usata finché il GPS non fornisce la posizione reale.
const DEFAULT_REGION = { latitude: 41.1177, longitude: 16.8718, latitudeDelta: 0.025, longitudeDelta: 0.025 };
// Raggio (m) entro cui consideriamo i mezzi "nelle vicinanze" (SA-02b).
const NEARBY_RADIUS_M = 1000;

function usePressAnim() {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scale, { toValue: 0.95, ...SPRING_CFG }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    ...SPRING_CFG }).start();
  return { scale, onPressIn, onPressOut };
}

export default function HomeScreen() {
  const [drawerVisible,    setDrawerVisible]    = useState(false);
  const [searchModalOpen,  setSearchModalOpen]  = useState(false);
  // Query e destinazione condivise con la tab Corsa via SearchContext: la
  // sorgente di verità è il context, così le due barre restano sincronizzate.
  const { query, setQuery, destination, setDestination, clearDestination } = useSearch();

  // ── Task 2: geolocalizzazione dispositivo ──────────────────────────────────
  const mapRef = useRef<MapView>(null);
  const { coords, status, error, source, locate, setManualCoords, geocodeAddress } = useDeviceLocation();
  const [manualVisible, setManualVisible] = useState(false);

  // ── Mezzi caricati dal Controller (DB) ─────────────────────────────────────
  const { token } = useAuth();
  const [vehicles, setVehicles] = useState<MapVehicle[]>([]);

  // ── Aree di parcheggio: caricate una sola volta appena disponibile il GPS ──
  const [parkingAreas, setParkingAreas] = useState<ApiParkingArea[]>([]);
  const parkingFetched = useRef(false);
  useEffect(() => {
    if (!coords || parkingFetched.current) return;
    parkingFetched.current = true;
    // Home map: carica TUTTE le aree di parcheggio (nessun filtro raggio),
    // così l'utente vede tutti gli hub disponibili su tutte le città.
    parkingApi.list()
      .then(setParkingAreas)
      .catch(() => {});
  }, [coords]);

  // ── Sessione corsa esplicita: banner solo se l'utente ha avviato una corsa ──
  const { session } = useRideSession();
  const { reservation, clearReservation } = useReservationSession();

  // Aggiorna il countdown della prenotazione ogni secondo.
  const [, forceUpdateRes] = useState(0);
  useEffect(() => {
    if (!reservation) return;
    const t = setInterval(() => forceUpdateRes(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [reservation]);
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => forceUpdate(n => n + 1), 60000);
    return () => clearInterval(t);
  }, [session]);
  const elapsedMin = session
    ? Math.floor((Date.now() - session.startedAtMs) / 60000)
    : 0;

  // Polling ogni 8s: la flotta si muove in tempo reale sulla mappa (drift GPS lato backend).
  useEffect(() => {
    let active = true;
    const fetchVehicles = () => {
      const lat = coords?.latitude;
      const lng = coords?.longitude;
      vehiclesApi.list(true, lat, lng)
        .then((list) => { if (active) setVehicles(list.map(toMapVehicle)); })
        .catch(() => {});
    };
    fetchVehicles();
    const id = setInterval(fetchVehicles, 8000);
    return () => { active = false; clearInterval(id); };
  }, [coords]);

  // Fetch urgente alla prima disponibilità del GPS: garantisce lo spawn dei veicoli
  // vicino alla posizione reale senza aspettare il prossimo ciclo da 8s.
  const prevCoords = useRef<typeof coords>(null);
  useEffect(() => {
    if (coords && !prevCoords.current) {
      vehiclesApi.list(true, coords.latitude, coords.longitude)
        .then((list) => setVehicles(list.map(toMapVehicle)))
        .catch(() => {});
    }
    prevCoords.current = coords;
  }, [coords]);

  // ── Task 1: mezzo selezionato per il pannello di dettaglio ─────────────────
  const [selectedVehicle, setSelectedVehicle] = useState<MapVehicle | null>(null);

  // Centra la mappa sulla posizione reale appena disponibile (CU-02 passo 2).
  useEffect(() => {
    if (coords) {
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 700);
    }
  }, [coords]);

  // SA-02a: GPS negato/non disponibile → apri inserimento manuale (una volta).
  useEffect(() => {
    if (status === 'denied' || status === 'error') setManualVisible(true);
  }, [status]);

  // SA-02b: nessun mezzo nel raggio dalla posizione utente.
  const noNearbyVehicles = useMemo(() => {
    if (!coords || vehicles.length === 0) return false;
    return !vehicles.some(
      (v) => haversineMeters(coords, { latitude: v.lat, longitude: v.lng }) <= NEARBY_RADIUS_M,
    );
  }, [coords, vehicles]);

  // Tap su mezzo → schermata di scelta avvio (prenota / scansiona QR / codice).
  const handleReserve = useCallback((v: MapVehicle) => {
    setSelectedVehicle(null);
    router.push({
      pathname: '/(app)/vehicle-action',
      params: {
        vehicleId: String(v.id),
        ...(coords ? { fromLat: String(coords.latitude), fromLng: String(coords.longitude) } : {}),
        // Propaga la destinazione condivisa (se valorizzata con coordinate).
        ...(destination && destination.lat != null && destination.lng != null ? {
          toAddr: destination.addr,
          toLat: String(destination.lat),
          toLng: String(destination.lng),
        } : {}),
      },
    });
  }, [coords, destination]);

  const drawerX        = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const isOpen         = useRef(false);
  const sheetHeight    = useRef(new Animated.Value(SNAP_COLLAPSED)).current;
  const lastHeight     = useRef(SNAP_COLLAPSED);

  const modalY       = useRef(new Animated.Value(-700)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  const qrBtn      = usePressAnim();
  const bonusBtn   = usePressAnim();
  const prenotaBtn = usePressAnim();

  // ── Sheet drag ─────────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        const next = lastHeight.current - g.dy;
        sheetHeight.setValue(Math.max(SNAP_COLLAPSED, Math.min(SNAP_EXPANDED + 40, next)));
      },
      onPanResponderRelease: (_, g) => {
        const next = lastHeight.current - g.dy;
        const snap = next > (SNAP_COLLAPSED + SNAP_EXPANDED) / 2 ? SNAP_EXPANDED : SNAP_COLLAPSED;
        lastHeight.current = snap;
        Animated.spring(sheetHeight, { toValue: snap, ...SPRING_SLOW }).start();
      },
    })
  ).current;

  // ── Drawer ─────────────────────────────────────────────────────────────────
  const openDrawer = useCallback(() => {
    isOpen.current = true;
    setDrawerVisible(true);
    drawerX.setValue(-DRAWER_WIDTH);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(drawerX,        { toValue: 0, ...SPRING_CFG }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  const closeDrawer = useCallback(() => {
    isOpen.current = false;
    Animated.parallel([
      Animated.timing(drawerX,        { toValue: -DRAWER_WIDTH, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setDrawerVisible(false));
  }, []);

  const handleMenuPress = useCallback(() => {
    isOpen.current ? closeDrawer() : openDrawer();
  }, [openDrawer, closeDrawer]);

  const drawerNav = (path: any) => { closeDrawer(); setTimeout(() => router.push(path), 220); };

  // ── Search modal ───────────────────────────────────────────────────────────
  // La query NON viene azzerata all'apertura/chiusura: è condivisa col context
  // e deve restare sincronizzata con la barra della tab Corsa.
  const openSearchModal = useCallback(() => {
    setSearchModalOpen(true);
    modalY.setValue(-700);
    modalOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(modalY,       { toValue: 0, ...SPRING_CFG }),
      Animated.timing(modalOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const closeSearchModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(modalY,       { toValue: -700, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 0,    duration: 200, useNativeDriver: true }),
    ]).start(() => setSearchModalOpen(false));
  }, []);

  // Conferma esplicita di una destinazione dalla ricerca Home: aggiorna il
  // context condiviso (destinazione + query), chiude la modale e reindirizza
  // alla tab Corsa (push, così il back riporta alla Home senza perdere la
  // ricerca). La barra di Corsa è già precompilata perché legge dal context.
  const selectHomeDestination = useCallback((r: ApiGeocodeResult) => {
    const short = r.label.split(',').slice(0, 2).join(',');
    setDestination({ addr: short, lat: r.lat, lng: r.lng });
    setQuery(short);
    closeSearchModal();
    router.push('/(app)/search');
  }, [closeSearchModal, setDestination, setQuery]);

  // Ricerca indirizzi reale via geocoding (OpenStreetMap), con debounce.
  const [geoResults, setGeoResults] = useState<ApiGeocodeResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  useEffect(() => {
    // Geocodifica solo a modale aperta: evita chiamate in background quando la
    // query cambia da un'altra tab (la query è condivisa via context).
    if (!searchModalOpen || query.trim().length < 2) { setGeoResults([]); return; }
    let active = true;
    setGeoLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await geoApi.geocode(query.trim());
        if (active) setGeoResults(res);
      } catch {
        if (active) setGeoResults([]);
      } finally {
        if (active) setGeoLoading(false);
      }
    }, 450);
    return () => { active = false; clearTimeout(t); };
  }, [query, searchModalOpen]);

  // Distanza utente→risultato (se disponibile la posizione GPS).
  const geoDistance = (r: ApiGeocodeResult): string | null =>
    coords ? formatDistance(haversineMeters(coords, { latitude: r.lat, longitude: r.lng })) : null;

  return (
    <View style={styles.container}>

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onPress={(e) => {
          // Su Android il tap su un marker propaga anche a onPress della mappa:
          // ignoriamo l'evento se proviene da un marker, altrimenti il pannello
          // appena aperto verrebbe chiuso nello stesso istante.
          if ((e.nativeEvent as any)?.action === 'marker-press') return;
          setSelectedVehicle(null);
        }}
      >
        <Circle
          center={coords ?? { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude }}
          radius={NEARBY_RADIUS_M}
          strokeColor="rgba(124,58,237,0.6)"
          strokeWidth={2}
          fillColor="rgba(124,58,237,0.06)"
        />
        {vehicles.map(v => {
          const isSelected = selectedVehicle?.id === v.id;
          const isParked   = v.status === 'parked';
          return (
            <Marker
              key={v.id}
              coordinate={{ latitude: v.lat, longitude: v.lng }}
              onPress={(e) => { e.stopPropagation?.(); setSelectedVehicle(v); }}
            >
              {isParked ? (
                <View style={[styles.markerParked, isSelected && styles.markerParkedSelected]}>
                  <MaterialCommunityIcons name={vehicleIcon[v.type] as any} size={15} color={isSelected ? Colors.text : Colors.success} />
                </View>
              ) : (
                <View style={[styles.marker, isSelected && styles.markerSelected]}>
                  <MaterialCommunityIcons name={vehicleIcon[v.type] as any} size={18} color={isSelected ? Colors.text : Colors.accent} />
                </View>
              )}
            </Marker>
          );
        })}

        {/* Aree di parcheggio: cerchio trasparente + pin "P" */}
        {parkingAreas.map(area => (
          <React.Fragment key={`parking-${area.id}`}>
            <Circle
              center={{ latitude: area.lat, longitude: area.lng }}
              radius={area.radius_m}
              strokeColor="rgba(16,185,129,0.5)"
              strokeWidth={1.5}
              fillColor="rgba(16,185,129,0.07)"
            />
            <Marker
              coordinate={{ latitude: area.lat, longitude: area.lng }}
              tracksViewChanges={false}
            >
              <View style={styles.parkingMarker}>
                <Text style={styles.parkingMarkerText}>P</Text>
              </View>
            </Marker>
          </React.Fragment>
        ))}
      </MapView>

      {/* Hamburger */}
      <TouchableOpacity style={styles.menuBtn} onPress={handleMenuPress} activeOpacity={0.75}>
        <View style={styles.menuBtnInner}>
          <Ionicons name={drawerVisible ? 'close' : 'menu'} size={22} color={Colors.text} />
        </View>
      </TouchableOpacity>

      {/* Ricentra su posizione GPS (o apre inserimento manuale se non disponibile) */}
      <TouchableOpacity
        style={styles.locateBtn}
        activeOpacity={0.75}
        onPress={() => {
          if (coords) mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
          else if (status === 'loading') return;
          else setManualVisible(true);
        }}
      >
        <View style={styles.menuBtnInner}>
          {status === 'loading'
            ? <Ionicons name="ellipsis-horizontal" size={22} color={Colors.muted} />
            : <Ionicons name={coords ? 'locate' : 'locate-outline'} size={22} color={coords ? Colors.accent : Colors.muted} />}
        </View>
      </TouchableOpacity>

      {/* SA-02b — nessun mezzo nel raggio dalla posizione utente */}
      {noNearbyVehicles && (
        <View style={styles.infoBanner} pointerEvents="none">
          <Ionicons name="information-circle" size={18} color={Colors.warning} />
          <Text style={styles.infoBannerText}>Nessun mezzo disponibile nelle vicinanze.</Text>
        </View>
      )}

      {/* Badge posizione manuale attiva (SA-02a) */}
      {source === 'manual' && (
        <View style={styles.manualBadge} pointerEvents="none">
          <Ionicons name="location" size={13} color={Colors.text} />
          <Text style={styles.manualBadgeText}>Posizione manuale</Text>
        </View>
      )}

      {/* Drawer */}
      {drawerVisible && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 20 }]} pointerEvents="box-none">
          <Animated.View style={[styles.drawerOverlayBase, { opacity: overlayOpacity }]} pointerEvents="auto">
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeDrawer} />
          </Animated.View>

          <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerX }] }]}>
            <LinearGradient colors={['#13132A', '#0D0D1A']} style={styles.drawerGradient}>
              <View style={styles.drawerTopRow}>
                <View style={styles.drawerLogoWrapper}>
                  <Image source={require('@/assets/logo.png')} style={{ width: 56, height: 56, borderRadius: 16 }} resizeMode="cover" />
                </View>
                <TouchableOpacity onPress={closeDrawer} style={styles.drawerCloseBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={22} color={Colors.muted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.drawerAppName}>Smart Mobility</Text>

              {[
                { icon: 'person-outline',   label: 'Profilo',          path: '/(app)/profile' },
                { icon: 'wallet-outline',   label: 'Portafoglio',      path: '/(app)/wallet' },
                { icon: 'gift-outline',     label: 'Promozioni',       path: '/(app)/promotions' },
                { icon: 'headset-outline',  label: 'Servizio clienti', path: '/(app)/support' },
                { icon: 'settings-outline', label: 'Impostazioni',     path: '/(app)/settings' },
              ].map(item => (
                <TouchableOpacity key={item.label} style={styles.drawerItem} onPress={() => drawerNav(item.path)} activeOpacity={0.65}>
                  <Ionicons name={item.icon as any} size={22} color={Colors.accent} />
                  <Text style={styles.drawerItemText}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(167,139,250,0.3)" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              ))}
            </LinearGradient>
          </Animated.View>
        </View>
      )}

      {/* Banner corsa in corso — solo se l'utente ha avviato una corsa in questa sessione */}
      {session && (
        <TouchableOpacity
          style={styles.activeBanner}
          onPress={() =>
            router.push({
              pathname: '/(app)/active-ride',
              params: {
                rideId:    String(session.rideId),
                vehicleId: String(session.vehicleId),
              },
            })
          }
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['rgba(124,58,237,0.9)', 'rgba(79,142,247,0.9)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.activeBannerInner}
          >
            <View style={styles.activeBannerDot} />
            <Text style={styles.activeBannerText}>Corsa in corso</Text>
            <Text style={styles.activeBannerSub}>{elapsedMin} min</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Banner prenotazione attiva — visibile solo in assenza di corsa */}
      {reservation && !session && (() => {
        const resSecondsLeft = Math.max(
          0,
          Math.floor((new Date(reservation.ora_scadenza).getTime() - Date.now()) / 1000),
        );

        // Scadenza già passata: puliamo lo stato e nascondiamo il banner.
        // setTimeout(0) evita la mutazione di stato durante il render.
        if (resSecondsLeft <= 0) {
          setTimeout(() => clearReservation(), 0);
          return null;
        }

        const resMm = String(Math.floor(resSecondsLeft / 60)).padStart(2, '0');
        const resSs = String(resSecondsLeft % 60).padStart(2, '0');
        return (
          <TouchableOpacity
            style={styles.reservationBanner}
            onPress={() =>
              router.push({
                pathname: '/(app)/active-reservation',
                params: {
                  reservationId: String(reservation.id),
                  vehicleId: String(reservation.id_mezzo),
                  vehicleType: reservation.mezzo?.tipo ?? 'scooter',
                  vehicleName: reservation.mezzo?.nome ?? '',
                  vehicleModel: reservation.mezzo?.modello ?? '',
                  batteryPct: String(reservation.mezzo?.livello_carica ?? 100),
                  oraScadenza: reservation.ora_scadenza,
                },
              })
            }
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['rgba(124,58,237,0.9)', 'rgba(79,142,247,0.9)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.activeBannerInner}
            >
              <Ionicons name="bookmark" size={15} color={Colors.text} />
              <Text style={styles.activeBannerText}>Prenotazione attiva</Text>
              <Text style={styles.activeBannerSub}>{resMm}:{resSs}</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        );
      })()}

      {/* Bottom sheet — nascosto quando è aperto il pannello di dettaglio mezzo */}
      <Animated.View
        style={[
          styles.sheet,
          { height: sheetHeight },
          session ? { bottom: 72 } : null,
          selectedVehicle ? styles.hidden : null,
        ]}
        pointerEvents={selectedVehicle ? 'none' : 'auto'}
      >
        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        <View style={styles.sheetContent}>
          {/* Search pill — opens isolated modal; mostra la destinazione scelta */}
          <TouchableOpacity style={styles.searchPill} onPress={openSearchModal} activeOpacity={0.8}>
            <Ionicons name="search-outline" size={16} color={destination ? Colors.accent : Colors.muted} />
            <Text style={[styles.searchPillText, destination ? { color: Colors.text } : null]} numberOfLines={1}>
              {destination ? destination.addr : 'Dove si va?'}
            </Text>
            {destination ? (
              <TouchableOpacity onPress={() => { clearDestination(); setQuery(''); }} hitSlop={8} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={18} color={Colors.muted} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={16} color="rgba(167,139,250,0.4)" />
            )}
          </TouchableOpacity>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Animated.View style={[{ flex: 1 }, { transform: [{ scale: bonusBtn.scale }] }]}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(app)/promotions')} onPressIn={bonusBtn.onPressIn} onPressOut={bonusBtn.onPressOut} activeOpacity={1}>
                <Ionicons name="flash-outline" size={18} color={Colors.accent} />
                <Text style={styles.actionBtnText}>Bonus</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[{ flex: 1.5 }, { transform: [{ scale: prenotaBtn.scale }] }]}>
              <TouchableOpacity style={[styles.actionBtn, { flex: undefined }]} onPress={() => router.push('/(app)/search')} onPressIn={prenotaBtn.onPressIn} onPressOut={prenotaBtn.onPressOut} activeOpacity={1}>
                <Ionicons name="people-outline" size={18} color={Colors.accent} />
                <Text style={styles.actionBtnText}>Prenota un mezzo</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* QR button */}
          <Animated.View style={[styles.qrBtn, { transform: [{ scale: qrBtn.scale }] }]}>
            <TouchableOpacity onPress={() => router.push('/(app)/activate')} onPressIn={qrBtn.onPressIn} onPressOut={qrBtn.onPressOut} activeOpacity={1} style={{ borderRadius: 16, overflow: 'hidden' }}>
              <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.qrBtnGradient}>
                <MaterialCommunityIcons name="qrcode" size={22} color={Colors.text} />
                <Text style={styles.qrBtnText}>Scansiona per iniziare</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>

      {/* ── Search modal (isolated, slides from top) ── */}
      {searchModalOpen && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 40 }]} pointerEvents="box-none">
          {/* Dim overlay */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: modalOpacity }]} pointerEvents="auto">
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeSearchModal} />
          </Animated.View>

          {/* Panel */}
          <Animated.View style={[styles.searchModal, { transform: [{ translateY: modalY }] }]} pointerEvents="box-none">
            <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={styles.searchModalBg} pointerEvents="none" />

            {/* Input row */}
            <View style={styles.searchModalInputRow}>
              <Ionicons name="search-outline" size={20} color={Colors.accent} />
              <TextInput
                style={styles.searchModalInput}
                placeholder="Dove si va?"
                placeholderTextColor={Colors.muted}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                autoFocus
                autoCorrect={false}
                onSubmitEditing={() => {
                  const r = geoResults[0];
                  if (r) selectHomeDestination(r);
                }}
              />
              <TouchableOpacity onPress={closeSearchModal} style={styles.searchModalCloseBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchModalDivider} />

            {/* Results body */}
            <View style={styles.searchModalBody}>
              {query.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                  <Ionicons name="search-outline" size={34} color={Colors.muted} />
                  <Text style={{ color: Colors.muted, fontSize: 14 }}>
                    Inizia a digitare per cercare una destinazione
                  </Text>
                </View>
              ) : geoResults.length > 0 ? (
                <>
                  <Text style={styles.searchModalSection}>RISULTATI</Text>
                  {geoResults.map((r, i) => {
                    const dist = geoDistance(r);
                    const short = r.label.split(',').slice(0, 2).join(',');
                    return (
                      <TouchableOpacity
                        key={`${r.lat}-${r.lng}-${i}`}
                        style={styles.searchModalItem}
                        activeOpacity={0.7}
                        onPress={() => selectHomeDestination(r)}
                      >
                        <View style={styles.searchModalItemIcon}>
                          <Ionicons name="location-outline" size={17} color={Colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.searchModalItemLabel} numberOfLines={1}>{short}</Text>
                          <Text style={styles.searchModalItemSub} numberOfLines={1}>
                            {dist ? `${dist} da te · ` : ''}{r.label.split(',').slice(2, 4).join(',').trim() || 'Indirizzo'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={15} color="rgba(167,139,250,0.4)" />
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
                  {geoLoading ? (
                    <>
                      <Ionicons name="search-outline" size={34} color={Colors.muted} />
                      <Text style={{ color: Colors.muted, fontSize: 14 }}>Ricerca in corso…</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="search-outline" size={34} color={Colors.muted} />
                      <Text style={{ color: Colors.muted, fontSize: 14 }}>Nessun risultato trovato</Text>
                    </>
                  )}
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      )}

      {/* ── Task 1: pannello di dettaglio mezzo (overlay sopra la mappa) ── */}
      <VehicleDetailSheet
        vehicle={selectedVehicle}
        userCoords={coords}
        onClose={() => setSelectedVehicle(null)}
        onReserve={handleReserve}
      />

      {/* ── SA-02a: inserimento manuale della posizione ── */}
      <ManualLocationModal
        visible={manualVisible}
        reason={
          status === 'denied'
            ? 'Permesso di localizzazione negato. Inserisci manualmente la tua posizione per vedere i mezzi vicini.'
            : error ?? 'Inserisci manualmente la tua posizione.'
        }
        geocode={geocodeAddress}
        onClose={() => setManualVisible(false)}
        onRetryGps={() => { setManualVisible(false); locate(); }}
        onResolved={(c) => { setManualCoords(c); setManualVisible(false); }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: Colors.bg },
  menuBtn:           { position: 'absolute', top: 52, left: 16, zIndex: 10 },
  menuBtnInner:      { backgroundColor: 'rgba(13,13,26,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },
  locateBtn:         { position: 'absolute', top: 52, right: 16, zIndex: 10 },
  hidden:            { opacity: 0 },

  infoBanner:        { position: 'absolute', top: 108, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(13,13,26,0.9)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, zIndex: 9, maxWidth: '88%' },
  infoBannerText:    { color: Colors.text, fontSize: 13, fontWeight: '500' },
  manualBadge:       { position: 'absolute', top: 108, left: 16, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, zIndex: 9 },
  manualBadgeText:   { color: Colors.text, fontSize: 11, fontWeight: '700' },

  drawerOverlayBase: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  drawer:            { width: DRAWER_WIDTH, height: '100%', position: 'absolute', top: 0, left: 0 },
  drawerGradient:    { flex: 1, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40, borderRightWidth: 1, borderRightColor: Colors.border },
  drawerTopRow:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  drawerLogoWrapper: { shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12 },
  drawerCloseBtn:    { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  drawerAppName:     { color: Colors.text, fontWeight: '800', fontSize: 18, marginBottom: 28 },
  drawerItem:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  drawerItemText:    { color: Colors.text, fontSize: 16, fontWeight: '500', flex: 1 },

  activeBanner:      { position: 'absolute', bottom: 8, left: 12, right: 12, zIndex: 11, borderRadius: 18, overflow: 'hidden' },
  reservationBanner: { position: 'absolute', bottom: 8, left: 12, right: 12, zIndex: 12, borderRadius: 18, overflow: 'hidden' },
  activeBannerInner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  activeBannerDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  activeBannerText:  { color: Colors.text, fontWeight: '700', fontSize: 15, flex: 1 },
  activeBannerSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 13 },

  sheet:             { position: 'absolute', bottom: 8, left: 12, right: 12, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', zIndex: 10, overflow: 'hidden', backgroundColor: 'rgba(8,8,24,0.6)' },
  handleArea:        { alignItems: 'center', paddingVertical: 12 },
  handle:            { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  sheetContent:      { paddingHorizontal: 14, paddingBottom: 16, gap: 10 },

  searchPill:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 14, paddingHorizontal: 12, height: 44 },
  searchPillText:    { color: Colors.muted, fontSize: 15, flex: 1 },

  actionRow:         { flexDirection: 'row', gap: 10 },
  actionBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', borderRadius: 16, paddingVertical: 13 },
  actionBtnText:     { color: Colors.text, fontSize: 14, fontWeight: '600' },
  qrBtn:             { borderRadius: 16, marginHorizontal: 4 },
  qrBtnGradient:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 13 },
  qrBtnText:         { color: Colors.text, fontSize: 16, fontWeight: '700' },
  marker:              { backgroundColor: 'rgba(13,13,26,0.85)', borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, padding: 6 },
  markerSelected:      { backgroundColor: Colors.primary, borderColor: Colors.accent, transform: [{ scale: 1.15 }] },
  markerParked:        { backgroundColor: 'rgba(13,13,26,0.85)', borderWidth: 1.5, borderColor: '#10B981', borderRadius: 8, padding: 5 },
  markerParkedSelected:{ backgroundColor: '#10B981', borderColor: '#34D399', transform: [{ scale: 1.15 }] },
  parkingMarker:     { backgroundColor: 'rgba(16,185,129,0.85)', borderWidth: 1.5, borderColor: '#10b981', borderRadius: 8, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  parkingMarkerText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Search modal
  searchModal:       { position: 'absolute', top: 0, left: 0, right: 0, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', borderWidth: 1, borderTopWidth: 0, borderColor: 'rgba(167,139,250,0.25)' },
  searchModalBg:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,8,24,0.88)' },
  searchModalInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 62, paddingHorizontal: 20, paddingBottom: 16 },
  searchModalInput:  { flex: 1, color: Colors.text, fontSize: 17, paddingVertical: 0 },
  searchModalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  searchModalDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },
  searchModalBody:   { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 16 },
  searchModalSection: { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  searchModalItem:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  searchModalItemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  searchModalItemLabel: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  searchModalItemSub:   { color: Colors.muted, fontSize: 12, marginTop: 2 },
});
