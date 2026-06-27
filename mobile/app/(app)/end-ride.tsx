import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, BackHandler } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { parkingApi } from '@/lib/api/endpoints';
import { vehicleTypeLabel, vehicleIcon } from '@/lib/vehicles';
import { haversineMeters, formatDistance } from '@/lib/geo';
import { useDeviceLocation } from '@/lib/useDeviceLocation';
import type { VehicleType } from '@/components/ui/VehicleCard';
import type { ApiParkingArea } from '@/lib/api/types';

const TAGS = [
  { id: 'ostacolo', icon: 'warning-outline', label: 'Ostacolo' },
  { id: 'danno',    icon: 'bicycle',         label: 'Veicolo danneggiato' },
  { id: 'parking',  icon: 'car-outline',     label: 'Parcheggio pieno' },
  { id: 'altro',    icon: 'ellipsis-horizontal', label: 'Altro' },
] as const;

const DEFAULT_CENTER = { latitude: 41.1177, longitude: 16.8718 };

export default function EndRideScreen() {
  const params = useLocalSearchParams<{
    km?: string; minutes?: string; cost?: string; points?: string;
    vehicleType?: string; endLat?: string; endLng?: string;
  }>();
  const [rating, setRating] = useState(0);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Reset valutazione e tag ad ogni nuova corsa.
  // I params cambiano ad ogni chiamata di router.replace verso end-ride,
  // quindi questo effect si attiva ogni volta che arriva una corsa diversa.
  // Lo screen è tenuto in memoria dai Tabs: senza reset, il rating della
  // corsa precedente rimarrebbe visibile.
  useEffect(() => {
    setRating(0);
    setSelectedTag(null);
    setSelectedArea(null);
  }, [params.km, params.minutes, params.cost]);

  const km = Number(params.km ?? 0);
  const minutes = Number(params.minutes ?? 0);
  const cost = Number(params.cost ?? 0);
  const points = Number(params.points ?? 0);
  const vtype = (params.vehicleType ?? 'scooter') as VehicleType;

  // Coordinate "di rotta" ricevute da active-ride (ultima posizione calcolata).
  const routeEndCoords = (params.endLat && params.endLng)
    ? { latitude: Number(params.endLat), longitude: Number(params.endLng) }
    : DEFAULT_CENTER;

  // GPS reale del dispositivo: usato per trovare le aree parcheggio più vicine
  // alla posizione EFFETTIVA in cui l'utente ha terminato la corsa. La corsa
  // può finire prima della destinazione, quindi il GPS reale è più preciso
  // delle coordinate del percorso calcolato.
  const { coords: gpsCoords } = useDeviceLocation();
  // Usiamo il GPS reale appena disponibile; fallback alle coordinate di rotta.
  const endCoords = gpsCoords ?? routeEndCoords;

  // Flag: carica le aree solo una volta, usando la miglior posizione disponibile.
  const areasFetchedRef = useRef(false);

  // Blocca il back hardware: la corsa è chiusa sul backend ma la sessione è
  // ancora attiva (tab bloccate). L'unica uscita è "Conferma parcheggio e
  // termina", che chiama endSession() e sblocca la navigazione.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // ── Aree di parcheggio ─────────────────────────────────────────────────────
  const [areas, setAreas] = useState<ApiParkingArea[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [selectedArea, setSelectedArea] = useState<ApiParkingArea | null>(null);

  // Carica le aree quando abbiamo una posizione valida (GPS reale o fallback rotta).
  // Si ri-esegue quando il GPS reale diventa disponibile la prima volta (sostituisce
  // i risultati basati sul fallback con quelli basati sul GPS effettivo).
  useEffect(() => {
    const lat = endCoords.latitude;
    const lng = endCoords.longitude;
    // Se il GPS reale è disponibile, forza un nuovo fetch anche se già eseguito con fallback.
    const isRealGps = !!gpsCoords;
    if (areasFetchedRef.current && !isRealGps) return;
    areasFetchedRef.current = true;

    let active = true;
    setLoadingAreas(true);
    parkingApi.list(lat, lng, 8)
      .then((list) => {
        if (!active) return;
        if (list.length > 0) {
          setAreas(list);
          setLoadingAreas(false);
        } else {
          // Nessuna area nel raggio 8 km: mostra tutte le aree disponibili
          // ordinate per distanza, così l'utente può sempre scegliere un hub.
          parkingApi.list(lat, lng)
            .then((all) => { if (active) setAreas(all); })
            .catch(() => {})
            .finally(() => { if (active) setLoadingAreas(false); });
        }
      })
      .catch(() => {
        // In caso di errore carica tutte le aree come fallback.
        parkingApi.list(lat, lng)
          .then((all) => { if (active) setAreas(all); })
          .catch(() => {})
          .finally(() => { if (active) setLoadingAreas(false); });
      });
    return () => { active = false; };
  }, [gpsCoords?.latitude, gpsCoords?.longitude]);

  const areaDistance = (a: ApiParkingArea) =>
    haversineMeters(endCoords, { latitude: a.lat, longitude: a.lng });

  // La mappa si centra sulla posizione GPS reale se disponibile, altrimenti sulla rotta.
  const mapRegion = useMemo(() => ({
    ...endCoords, latitudeDelta: 0.03, longitudeDelta: 0.03,
  }), [endCoords.latitude, endCoords.longitude]);

  const goToPayment = () => {
    if (!selectedArea) return;
    // Naviga alla pagina di pagamento, passando tutto il necessario per chiudere la sessione
    // dopo il pagamento (incluso tag per eventuale segnalazione a fine corsa).
    router.push({
      pathname: '/(app)/ride-payment',
      params: {
        cost:        String(cost),
        km:          String(km),
        minutes:     String(minutes),
        points:      String(points),
        vehicleType: vtype,
        areaId:      String(selectedArea.id),
        areaName:    selectedArea.name,
        selectedTag: selectedTag ?? '',
        rating:      String(rating),
      },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.successHeader}>
        <View style={styles.checkCircle}>
          <LinearGradient colors={Gradients.primary} style={styles.checkGradient}>
            <Ionicons name="checkmark" size={32} color={Colors.text} />
          </LinearGradient>
        </View>
        <Text style={styles.successTitle}>Corsa terminata!</Text>
        <Text style={styles.successSub}>Scegli un'area di sosta per completare</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <MaterialCommunityIcons name="map-marker-distance" size={16} color={Colors.muted} />
          <Text style={styles.statLabel}>Distanza</Text>
          <Text style={styles.statValue}>{km.toFixed(1).replace('.', ',')} km</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="time-outline" size={16} color={Colors.muted} />
          <Text style={styles.statLabel}>Tempo totale</Text>
          <Text style={styles.statValue}>{minutes} min</Text>
        </View>
        <View style={styles.stat}>
          <MaterialCommunityIcons name="currency-eur" size={16} color={Colors.muted} />
          <Text style={styles.statLabel}>Costo finale</Text>
          <Text style={[styles.statValue, { color: Colors.accent }]}>€ {cost.toFixed(2).replace('.', ',')}</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="star-outline" size={16} color={Colors.muted} />
          <Text style={styles.statLabel}>Punti</Text>
          <Text style={[styles.statValue, { color: Colors.warning }]}>+{points} pt</Text>
        </View>
      </View>

      {/* ── Mappa con aree di sosta ── */}
      <View style={styles.mapCard}>
        <MapView provider={PROVIDER_GOOGLE} style={styles.map} region={mapRegion} pointerEvents="none">
          <Marker coordinate={endCoords}>
            <View style={styles.endMarker}><Ionicons name="locate" size={20} color={Colors.accent} /></View>
          </Marker>
          {areas.map((a) => {
            const isSel = selectedArea?.id === a.id;
            const full = a.occupied >= a.capacity;
            const color = full ? Colors.danger : isSel ? Colors.primary : Colors.success;
            return (
              <React.Fragment key={a.id}>
                <Circle
                  center={{ latitude: a.lat, longitude: a.lng }}
                  radius={a.radius_m}
                  strokeColor={color}
                  strokeWidth={2}
                  fillColor={isSel ? 'rgba(124,58,237,0.25)' : 'rgba(34,197,94,0.12)'}
                />
                <Marker coordinate={{ latitude: a.lat, longitude: a.lng }}>
                  <View style={[styles.pMarker, { backgroundColor: color }]}>
                    <Text style={styles.pMarkerText}>P</Text>
                  </View>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapView>
      </View>

      {/* ── Selezione area ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aree di sosta vicine</Text>
        <Text style={styles.sectionSub}>Seleziona dove hai parcheggiato il mezzo</Text>

        {loadingAreas ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}><ActivityIndicator color={Colors.accent} /></View>
        ) : areas.length === 0 ? (
          <Text style={styles.emptyText}>Nessuna area di sosta disponibile.</Text>
        ) : (
          <View style={{ gap: 10, marginTop: 12 }}>
            {areas.map((a) => {
              const isSel = selectedArea?.id === a.id;
              const full = a.occupied >= a.capacity;
              const free = a.capacity - a.occupied;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.areaRow, isSel && styles.areaRowActive, full && styles.areaRowDisabled]}
                  activeOpacity={full ? 1 : 0.7}
                  onPress={() => { if (!full) setSelectedArea(a); }}
                >
                  <View style={[styles.areaIcon, { backgroundColor: full ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)' }]}>
                    <MaterialCommunityIcons name="parking" size={20} color={full ? Colors.danger : Colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.areaName} numberOfLines={1}>{a.name}</Text>
                    <Text style={styles.areaSub} numberOfLines={1}>
                      {formatDistance(areaDistance(a))} · {full ? 'Completo' : `${free} posti liberi`}
                    </Text>
                  </View>
                  <Ionicons
                    name={isSel ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isSel ? Colors.primary : Colors.muted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Segnalazione */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Segnala un problema</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} style={{ marginLeft: 'auto' }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 12 }}>
          {TAGS.map(tag => (
            <TouchableOpacity
              key={tag.id}
              onPress={() => setSelectedTag(tag.id === selectedTag ? null : tag.id)}
              style={[styles.tag, selectedTag === tag.id && styles.tagActive]}
            >
              <Ionicons name={tag.icon as any} size={14} color={selectedTag === tag.id ? Colors.text : Colors.muted} />
              <Text style={[styles.tagText, selectedTag === tag.id && { color: Colors.text }]}>{tag.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Rating */}
      <View style={styles.ratingCard}>
        <View style={styles.vehicleRow}>
          <MaterialCommunityIcons name={vehicleIcon[vtype] as any} size={26} color={Colors.accent} />
          <View>
            <Text style={{ color: Colors.text, fontWeight: '700' }}>{vehicleTypeLabel[vtype]}</Text>
            <Text style={{ color: Colors.muted, fontSize: 12 }}>Corsa completata</Text>
          </View>
        </View>
        <Text style={{ color: Colors.text, fontWeight: '600', marginBottom: 8 }}>Valuta la corsa</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map(s => (
            <TouchableOpacity key={s} onPress={() => setRating(s)}>
              <FontAwesome name={s <= rating ? 'star' : 'star-o'} size={30} color={s <= rating ? Colors.warning : Colors.border} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.homeBtn} onPress={goToPayment} disabled={!selectedArea} activeOpacity={0.85}>
        <LinearGradient
          colors={selectedArea ? Gradients.primaryBtn : ['#2A2A40', '#22223A']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.homeBtnGradient}
        >
          <Ionicons name={selectedArea ? 'card-outline' : 'lock-closed'} size={18} color={selectedArea ? Colors.text : Colors.muted} />
          <Text style={[styles.homeBtnText, !selectedArea && { color: Colors.muted }]}>
            {selectedArea ? 'Procedi al pagamento' : 'Seleziona un\'area di sosta'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  successHeader:  { alignItems: 'center', paddingTop: 60, paddingBottom: 24, gap: 8 },
  checkCircle:    { marginBottom: 4 },
  checkGradient:  { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  successTitle:   { color: Colors.text, fontSize: 24, fontWeight: '800' },
  successSub:     { color: Colors.muted, fontSize: 14 },
  statsRow:       { flexDirection: 'row', marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  stat:           { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  statLabel:      { color: Colors.muted, fontSize: 10, textAlign: 'center' },
  statValue:      { color: Colors.text, fontWeight: '800', fontSize: 14 },
  mapCard:        { marginHorizontal: 16, height: 180, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  map:            { ...StyleSheet.absoluteFillObject },
  endMarker:      { padding: 2 },
  pMarker:        { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.text },
  pMarkerText:    { color: Colors.text, fontWeight: '800', fontSize: 12 },
  section:        { marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 16 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle:   { color: Colors.text, fontWeight: '700', fontSize: 15 },
  sectionSub:     { color: Colors.muted, fontSize: 12, marginTop: 2 },
  emptyText:      { color: Colors.muted, fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  areaRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  areaRowActive:  { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.1)' },
  areaRowDisabled:{ opacity: 0.45 },
  areaIcon:       { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  areaName:       { color: Colors.text, fontWeight: '700', fontSize: 14 },
  areaSub:        { color: Colors.muted, fontSize: 12, marginTop: 2 },
  ratingCard:     { marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16, gap: 12 },
  vehicleRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stars:          { flexDirection: 'row', gap: 8 },
  tag:            { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  tagActive:      { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.2)' },
  tagText:        { color: Colors.muted, fontSize: 13, fontWeight: '600' },
  homeBtn:        { marginHorizontal: 16, marginBottom: 32, borderRadius: 16, overflow: 'hidden' },
  homeBtnGradient:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  homeBtnText:    { color: Colors.text, fontWeight: '800', fontSize: 16 },
});
