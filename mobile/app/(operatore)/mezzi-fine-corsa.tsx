import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker, Circle, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { operatoreApi, parkingApi } from '@/lib/api/endpoints';
import { vehicleIcon, vehicleTypeLabel } from '@/lib/vehicles';
import type { ApiVehicle, ApiParkingArea } from '@/lib/api/types';
import type { VehicleType } from '@/components/ui/VehicleCard';

const battColor = (pct: number) => (pct > 50 ? Colors.success : pct > 20 ? Colors.warning : Colors.danger);

// Stile mappa scuro identico a quello dell'app utente (Home).
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
  { featureType: 'administrative',      elementType: 'geometry.stroke', stylers: [{ color: '#2a2a50' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'landscape',           elementType: 'geometry',        stylers: [{ color: '#0f0f24' }] },
];

const DEFAULT_REGION = { latitude: 41.1177, longitude: 16.8718, latitudeDelta: 0.14, longitudeDelta: 0.14 };

type Filtro = 'tutti' | 'scooter' | 'ebike' | 'car';

export default function MezziFineCorsa() {
  const { token } = useAuth();
  const mapRef = useRef<MapView>(null);
  const [mezzi, setMezzi] = useState<ApiVehicle[]>([]);
  const [aree, setAree] = useState<ApiParkingArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('tutti');

  const load = () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    // Aree di parcheggio sincronizzate dal sistema (come nella mappa utente).
    parkingApi.list().then(setAree).catch(() => {});
    operatoreApi.listFlotta(token)
      .then((list) => setMezzi(list.filter((v) => v.status === 'parked')))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [token]);

  const filtered = useMemo(
    () => (filtro === 'tutti' ? mezzi : mezzi.filter((v) => v.type === filtro)),
    [mezzi, filtro],
  );

  const counts = useMemo(() => ({
    tutti: mezzi.length,
    scooter: mezzi.filter((v) => v.type === 'scooter').length,
    ebike: mezzi.filter((v) => v.type === 'ebike').length,
    car: mezzi.filter((v) => v.type === 'car').length,
  }), [mezzi]);

  // Inquadra automaticamente tutti i mezzi visibili.
  useEffect(() => {
    if (!filtered.length) return;
    const lats = filtered.map((v) => v.lat);
    const lngs = filtered.map((v) => v.lng);
    mapRef.current?.animateToRegion({
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta: Math.max(0.03, (Math.max(...lats) - Math.min(...lats)) * 1.4),
      longitudeDelta: Math.max(0.03, (Math.max(...lngs) - Math.min(...lngs)) * 1.4),
    }, 600);
  }, [filtered]);

  const FILTERS: { key: Filtro; label: string }[] = [
    { key: 'tutti',   label: `Tutti ${counts.tutti}` },
    { key: 'scooter', label: `🛴 ${counts.scooter}` },
    { key: 'ebike',   label: `🚲 ${counts.ebike}` },
    { key: 'car',     label: `🚗 ${counts.car}` },
  ];

  return (
    <View style={styles.container}>
      {/* Mappa a schermo intero — stessa mappa scura dell'utente */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        customMapStyle={DARK_MAP_STYLE}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Aree di parcheggio (sincronizzate dal sistema, come la mappa utente) */}
        {aree.map((a) => {
          const full = a.occupied >= a.capacity;
          const color = full ? Colors.danger : Colors.success;
          return (
            <React.Fragment key={`area-${a.id}`}>
              <Circle
                center={{ latitude: a.lat, longitude: a.lng }}
                radius={a.radius_m}
                strokeColor={color}
                strokeWidth={1.5}
                fillColor={full ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)'}
              />
              <Marker coordinate={{ latitude: a.lat, longitude: a.lng }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[styles.pMarker, { borderColor: color }]}>
                  <Text style={[styles.pText, { color }]}>P</Text>
                </View>
                <Callout tooltip>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>🅿️ {a.name}</Text>
                    <Text style={styles.calloutSub}>{a.address}</Text>
                    <Text style={[styles.calloutBadge, { color }]}>
                      {full ? 'Completo' : `${a.capacity - a.occupied} posti liberi`} · cap. {a.capacity}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Mezzi parcheggiati */}
        {filtered.map((v) => (
          <Marker key={v.id} coordinate={{ latitude: v.lat, longitude: v.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.marker, v.locked ? styles.markerLocked : styles.markerFree]}>
              <MaterialCommunityIcons
                name={vehicleIcon[v.type as VehicleType] as any}
                size={16}
                color={v.locked ? Colors.danger : Colors.success}
              />
            </View>
            <Callout tooltip>
              <View style={styles.callout}>
                <View style={styles.calloutRow}>
                  <MaterialCommunityIcons name={vehicleIcon[v.type as VehicleType] as any} size={18} color={Colors.accent} />
                  <Text style={styles.calloutTitle}>{v.name}</Text>
                </View>
                <Text style={styles.calloutSub}>{vehicleTypeLabel[v.type as VehicleType] ?? v.type} · {v.model}</Text>
                <View style={styles.calloutRow}>
                  <Text style={[styles.calloutBadge, { color: battColor(v.battery_pct) }]}>🔋 {v.battery_pct}%</Text>
                  {v.locked
                    ? <Text style={[styles.calloutBadge, { color: Colors.danger }]}>🔒 BLOCCATO</Text>
                    : <Text style={[styles.calloutBadge, { color: Colors.success }]}>● LIBERO</Text>}
                </View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Back */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
        <Ionicons name="arrow-back" size={22} color={Colors.text} />
      </TouchableOpacity>

      {/* Overlay titolo + conteggio + filtri */}
      <View style={styles.topCard} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Mezzi a Fine Corsa</Text>
            <Text style={styles.subtitle}>{filtered.length} mezzi parcheggiati</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={load} activeOpacity={0.75}>
            <Ionicons name="refresh" size={18} color={Colors.accent} />
          </TouchableOpacity>
        </View>
        <View style={styles.filters}>
          {FILTERS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => setFiltro(key)}
              style={[styles.chip, filtro === key && styles.chipActive]}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, filtro === key && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Legenda */}
      <View style={styles.legend} pointerEvents="none">
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: Colors.success }]} />
          <Text style={styles.legendText}>Libero</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: Colors.danger }]} />
          <Text style={styles.legendText}>Bloccato</Text>
        </View>
      </View>

      {loading && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      )}
      {!loading && mezzi.length === 0 && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <Ionicons name="flag-outline" size={40} color={Colors.muted} />
          <Text style={styles.emptyText}>Nessun mezzo parcheggiato</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  backBtn:        { position: 'absolute', top: 52, left: 16, zIndex: 20, backgroundColor: 'rgba(13,13,26,0.85)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },

  marker:         { backgroundColor: 'rgba(13,13,26,0.9)', borderWidth: 2, borderRadius: 11, padding: 5 },
  markerFree:     { borderColor: Colors.success },
  markerLocked:   { borderColor: Colors.danger },

  topCard:        { position: 'absolute', top: 48, left: 70, right: 16, zIndex: 15, backgroundColor: 'rgba(13,13,26,0.9)', borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 12, gap: 10 },
  topRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:          { color: Colors.text, fontSize: 17, fontWeight: '800' },
  subtitle:       { color: Colors.accent, fontSize: 12, fontWeight: '600', marginTop: 2 },
  refreshBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  filters:        { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip:           { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive:     { backgroundColor: 'rgba(124,58,237,0.25)', borderColor: Colors.primary },
  chipText:       { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: Colors.text },

  legend:         { position: 'absolute', bottom: 28, left: 16, zIndex: 15, flexDirection: 'row', gap: 14, backgroundColor: 'rgba(13,13,26,0.9)', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  legendItem:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:            { width: 10, height: 10, borderRadius: 5 },
  legendText:     { color: Colors.text, fontSize: 12, fontWeight: '500' },

  centerOverlay:  { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText:      { color: Colors.muted, fontSize: 15, fontWeight: '600' },

  pMarker:        { width: 22, height: 22, borderRadius: 7, backgroundColor: 'rgba(13,13,26,0.9)', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pText:          { fontWeight: '900', fontSize: 12 },

  // Callout (info box) curato
  callout:        { minWidth: 180, maxWidth: 240, backgroundColor: '#13132A', borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)', borderRadius: 14, padding: 12, gap: 6 },
  calloutRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  calloutTitle:   { color: Colors.text, fontWeight: '800', fontSize: 14 },
  calloutSub:     { color: Colors.muted, fontSize: 12 },
  calloutBadge:   { fontSize: 12, fontWeight: '700' },
});
