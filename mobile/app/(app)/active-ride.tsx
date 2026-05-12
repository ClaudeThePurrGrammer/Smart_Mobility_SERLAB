import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';

const ROUTE_COORDS = [
  { latitude: 41.1177, longitude: 16.8718 },
  { latitude: 41.1185, longitude: 16.8725 },
  { latitude: 41.1195, longitude: 16.8730 },
  { latitude: 41.1200, longitude: 16.8740 },
  { latitude: 41.1210, longitude: 16.8755 },
];


export default function ActiveRideScreen() {
  const [seconds, setSeconds] = useState(504);
  const [paused, setPaused] = useState(false);
  const cost = ((seconds / 60) * 0.22).toFixed(2);

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
          <Text style={styles.topStatValue} numberOfLines={1}>Porta Romana</Text>
          <Text style={styles.topStatLabel}>13 min · 2,4 km</Text>
        </View>
      </View>

      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: 41.1192,
          longitude: 16.8737,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        showsUserLocation={false}
        showsCompass={false}
      >
        <Polyline
          coordinates={ROUTE_COORDS}
          strokeColor={Colors.accent}
          strokeWidth={4}
          lineDashPattern={undefined}
        />
        <Marker coordinate={ROUTE_COORDS[0]}>
          <View style={styles.startMarker}>
            <Ionicons name="radio-button-on" size={24} color={Colors.primary} />
          </View>
        </Marker>
        <Marker coordinate={ROUTE_COORDS[ROUTE_COORDS.length - 1]}>
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
            onPress={() => setPaused(true)}
          >
            <Ionicons name="pause" size={20} color={paused ? Colors.primary : Colors.text} />
            <Text style={[styles.ctrlLabel, paused && { color: Colors.primary }]}>Pausa corsa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ctrlBtn, styles.ctrlBtnEnd]}
            onPress={() => router.replace('/(app)/end-ride')}
          >
            <Ionicons name="stop" size={22} color={Colors.text} />
            <Text style={[styles.ctrlLabel, { color: Colors.text, fontWeight: '700' }]}>Termina corsa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ctrlBtn, !paused ? styles.ctrlBtnActive : null]}
            onPress={() => setPaused(false)}
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
  container:        { flex: 1, backgroundColor: Colors.bg },
  topBar:           { position: 'absolute', top: 52, left: 16, right: 16, zIndex: 10, flexDirection: 'row', backgroundColor: 'rgba(19,19,42,0.95)', borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 10 },
  topStat:          { flex: 1, alignItems: 'center', gap: 2 },
  topStatCenter:    { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  topStatValue:     { color: Colors.text, fontWeight: '700', fontSize: 15 },
  topStatLabel:     { color: Colors.muted, fontSize: 10 },
  mapActions:       { position: 'absolute', right: 16, top: '40%', zIndex: 10, gap: 10 },
  mapActionBtn:     { backgroundColor: 'rgba(19,19,42,0.9)', borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 10, alignItems: 'center', gap: 4, width: 76 },
  mapActionText:    { color: Colors.text, fontSize: 10, fontWeight: '500', textAlign: 'center' },
  bottomPanel:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: Colors.border, padding: 16, gap: 14 },
  vehicleRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon:      { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  vehicleName:      { color: Colors.text, fontWeight: '700', fontSize: 15 },
  vehicleModel:     { color: Colors.muted, fontSize: 12 },
  rideId:           { color: Colors.muted, fontSize: 12 },
  statsRow:         { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  statBox:          { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  statLabel:        { color: Colors.muted, fontSize: 12, flex: 1 },
  statValue:        { color: Colors.text, fontWeight: '700', fontSize: 16 },
  controls:         { flexDirection: 'row', gap: 10, paddingBottom: 8 },
  ctrlBtn:          { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 6 },
  ctrlBtnActive:    { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.1)' },
  ctrlBtnEnd:       { backgroundColor: Colors.danger, borderColor: Colors.danger },
  ctrlLabel:        { color: Colors.muted, fontSize: 11, fontWeight: '500', textAlign: 'center' },
  startMarker:      { padding: 4 },
  endMarker:        { padding: 4 },
});
