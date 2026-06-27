import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, Circle, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { parkingApi } from '@/lib/api/endpoints';
import { vehicleIcon, vehicleTypeLabel } from '@/lib/vehicles';
import { useFleetSimulation, type SimType } from '@/lib/tracking/fleetSimulator';
import type { ApiParkingArea } from '@/lib/api/types';

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
  { featureType: 'poi',                 elementType: 'geometry',        stylers: [{ color: '#13132a' }] },
  { featureType: 'poi.park',            elementType: 'geometry',        stylers: [{ color: '#111122' }] },
  { featureType: 'transit',             elementType: 'geometry',        stylers: [{ color: '#1a1a35' }] },
  { featureType: 'administrative',      elementType: 'geometry.stroke', stylers: [{ color: '#2a2a50' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a78bfa' }] },
  { featureType: 'landscape',           elementType: 'geometry',        stylers: [{ color: '#0f0f24' }] },
];

const DEFAULT_REGION = { latitude: 41.1177, longitude: 16.8718, latitudeDelta: 0.08, longitudeDelta: 0.08 };

// I mezzi IN USO sono sempre viola (richiesta operatore).
const IN_USE_COLOR = Colors.primary;

export default function TracciamentoMezziScreen() {
  const sims = useFleetSimulation();
  const mapRef = useRef<MapView>(null);
  const didFit = useRef(false);
  const [filtro, setFiltro] = useState<'tutti' | SimType>('tutti');
  const [aree, setAree] = useState<ApiParkingArea[]>([]);

  // Aree di parcheggio sincronizzate dal sistema (come nella mappa utente).
  useEffect(() => {
    parkingApi.list().then(setAree).catch(() => {});
  }, []);

  const visible = useMemo(
    () => (filtro === 'tutti' ? sims : sims.filter((v) => v.type === filtro)),
    [sims, filtro],
  );

  const counts = useMemo(() => ({
    tutti: sims.length,
    scooter: sims.filter((v) => v.type === 'scooter').length,
    ebike: sims.filter((v) => v.type === 'ebike').length,
    car: sims.filter((v) => v.type === 'car').length,
  }), [sims]);

  // Centra una sola volta sulla flotta appena le posizioni sono disponibili.
  useEffect(() => {
    if (didFit.current || sims.length === 0) return;
    didFit.current = true;
    const lats = sims.map((v) => v.lat);
    const lngs = sims.map((v) => v.lng);
    mapRef.current?.animateToRegion({
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta: Math.max(0.05, (Math.max(...lats) - Math.min(...lats)) * 1.6),
      longitudeDelta: Math.max(0.05, (Math.max(...lngs) - Math.min(...lngs)) * 1.6),
    }, 800);
  }, [sims]);

  const FILTERS: { key: 'tutti' | SimType; label: string }[] = [
    { key: 'tutti',   label: `Tutti ${counts.tutti}` },
    { key: 'scooter', label: `🛴 ${counts.scooter}` },
    { key: 'ebike',   label: `🚲 ${counts.ebike}` },
    { key: 'car',     label: `🚗 ${counts.car}` },
  ];

  return (
    <View style={styles.container}>
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

        {/* Mezzi in uso — sempre viola */}
        {visible.map((v) => (
          <Marker
            key={v.id}
            coordinate={{ latitude: v.lat, longitude: v.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
          >
            <View style={styles.marker}>
              <MaterialCommunityIcons name={vehicleIcon[v.type] as any} size={15} color={Colors.text} />
            </View>
            <Callout tooltip>
              <View style={styles.callout}>
                <View style={styles.calloutRow}>
                  <MaterialCommunityIcons name={vehicleIcon[v.type] as any} size={18} color={IN_USE_COLOR} />
                  <Text style={styles.calloutTitle}>{v.name}</Text>
                </View>
                <Text style={styles.calloutSub}>{vehicleTypeLabel[v.type]}</Text>
                <View style={styles.calloutRow}>
                  <Text style={[styles.calloutBadge, { color: IN_USE_COLOR }]}>● IN USO</Text>
                  <Text style={[styles.calloutBadge, { color: Colors.accent }]}>{v.speedKmh} km/h</Text>
                  <Text style={[styles.calloutBadge, { color: Colors.text }]}>🔋 {v.batteryPct}%</Text>
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

      {/* Overlay titolo + live + filtri */}
      <View style={styles.topCard} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={styles.liveDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Tracciamento Live</Text>
            <Text style={styles.subtitle}>{visible.length} mezzi in uso · tempo reale</Text>
          </View>
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

      {/* Nota: simulazione */}
      <View style={styles.note} pointerEvents="none">
        <Ionicons name="information-circle-outline" size={14} color={Colors.muted} />
        <Text style={styles.noteText}>Monitoraggio simulato — mezzi non presenti in flotta</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  backBtn:        { position: 'absolute', top: 52, left: 16, zIndex: 20, backgroundColor: 'rgba(13,13,26,0.85)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },

  // Mezzo in uso → viola
  marker:         { backgroundColor: 'rgba(124,58,237,0.95)', borderWidth: 2, borderColor: '#A78BFA', borderRadius: 11, padding: 5 },
  pMarker:        { width: 22, height: 22, borderRadius: 7, backgroundColor: 'rgba(13,13,26,0.9)', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pText:          { fontWeight: '900', fontSize: 12 },

  // Callout (info box) curato
  callout:        { minWidth: 180, maxWidth: 250, backgroundColor: '#13132A', borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)', borderRadius: 14, padding: 12, gap: 6 },
  calloutRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  calloutTitle:   { color: Colors.text, fontWeight: '800', fontSize: 14 },
  calloutSub:     { color: Colors.muted, fontSize: 12 },
  calloutBadge:   { fontSize: 12, fontWeight: '700' },

  topCard:        { position: 'absolute', top: 48, left: 70, right: 16, zIndex: 15, backgroundColor: 'rgba(13,13,26,0.9)', borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 12, gap: 10 },
  topRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  title:          { color: Colors.text, fontSize: 17, fontWeight: '800' },
  subtitle:       { color: Colors.accent, fontSize: 12, fontWeight: '600', marginTop: 2 },
  filters:        { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip:           { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive:     { backgroundColor: 'rgba(124,58,237,0.25)', borderColor: Colors.primary },
  chipText:       { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: Colors.text },

  note:           { position: 'absolute', bottom: 28, left: 16, right: 16, zIndex: 15, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(13,13,26,0.9)', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  noteText:       { color: Colors.muted, fontSize: 11, flex: 1 },
});
