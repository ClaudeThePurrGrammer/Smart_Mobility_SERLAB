import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { ridesApi } from '@/lib/api/endpoints';
import type { ApiRide } from '@/lib/api/types';
import { shortDateTime } from '@/lib/format';

type Filter = 'Tutte' | 'Questo mese' | 'Precedenti';

const VEHICLE_ICON: Record<string, string> = {
  scooter: 'scooter',
  ebike: 'bicycle-electric',
  car: 'car-electric',
};

const FILTERS: Filter[] = ['Tutte', 'Questo mese', 'Precedenti'];

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function RideHistoryScreen() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<Filter>('Tutte');
  const [rides, setRides] = useState<ApiRide[]>([]);
  const [loading, setLoading] = useState(true);

  // Rifetch ad ogni apertura della schermata: lo storico deve riflettere
  // le corse appena terminate senza richiedere un logout/login.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      ridesApi.history(token)
        .then(setRides)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [token]),
  );

  const filtered = filter === 'Questo mese'
    ? rides.filter(r => isThisMonth(r.started_at))
    : filter === 'Precedenti'
    ? rides.filter(r => !isThisMonth(r.started_at))
    : rides;

  const totKm   = filtered.reduce((s, r) => s + (r.km   ?? 0), 0).toFixed(1);
  const totEur  = filtered.reduce((s, r) => s + (r.cost  ?? 0), 0).toFixed(2);
  const totPts  = filtered.reduce((s, r) => s + (r.points ?? 0), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Storico corse</Text>
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{filtered.length}</Text>
          <Text style={styles.summaryLabel}>Corse</Text>
        </View>
        <View style={[styles.summaryItem, styles.summaryBorder]}>
          <Text style={styles.summaryValue}>{totKm} km</Text>
          <Text style={styles.summaryLabel}>Percorsi</Text>
        </View>
        <View style={[styles.summaryItem, styles.summaryBorder]}>
          <Text style={[styles.summaryValue, { color: Colors.accent }]}>€ {totEur}</Text>
          <Text style={styles.summaryLabel}>Spesi</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.warning }]}>{totPts} pt</Text>
          <Text style={styles.summaryLabel}>Punti</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
            <Ionicons name="bicycle-outline" size={44} color={Colors.muted} />
            <Text style={{ color: Colors.muted, fontSize: 15 }}>Nessuna corsa</Text>
          </View>
        ) : filtered.map((ride, idx) => (
          <TouchableOpacity key={ride.id} style={[styles.rideCard, idx === 0 && { marginTop: 16 }]}>
            <View style={styles.rideIcon}>
              <MaterialCommunityIcons name={(VEHICLE_ICON[ride.vehicle_type] ?? 'car-electric') as any} size={24} color={Colors.accent} />
            </View>
            <View style={styles.rideInfo}>
              <Text style={styles.rideDate}>{shortDateTime(ride.started_at)}</Text>
              <Text style={styles.rideRoute} numberOfLines={1}>{ride.from_addr} → {ride.to_addr}</Text>
              <View style={styles.rideMeta}>
                <Ionicons name="map-outline" size={12} color={Colors.muted} />
                <Text style={styles.rideMetaText}>{ride.km ?? 0} km</Text>
                <Ionicons name="time-outline" size={12} color={Colors.muted} />
                <Text style={styles.rideMetaText}>{ride.minutes ?? 0} min</Text>
                <Ionicons name="star-outline" size={12} color={Colors.warning} />
                <Text style={[styles.rideMetaText, { color: Colors.warning }]}>+{ride.points ?? 0} pt</Text>
              </View>
            </View>
            <View style={styles.rideCost}>
              <Text style={styles.rideCostValue}>€ {(ride.cost ?? 0).toFixed(2)}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.bg },
  header:           { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  backBtn:          { padding: 2 },
  title:            { color: Colors.text, fontSize: 20, fontWeight: '800' },
  summary:          { flexDirection: 'row', backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  summaryItem:      { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 3 },
  summaryBorder:    { borderLeftWidth: 1, borderLeftColor: Colors.border },
  summaryValue:     { color: Colors.text, fontSize: 18, fontWeight: '900' },
  summaryLabel:     { color: Colors.muted, fontSize: 11 },
  filters:          { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  filterTab:        { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  filterTabActive:  { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: Colors.primary },
  filterText:       { color: Colors.muted, fontSize: 13, fontWeight: '500' },
  filterTextActive: { color: Colors.text, fontWeight: '700' },
  rideCard:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 14 },
  rideIcon:         { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  rideInfo:         { flex: 1, gap: 4 },
  rideDate:         { color: Colors.muted, fontSize: 11 },
  rideRoute:        { color: Colors.text, fontWeight: '600', fontSize: 14 },
  rideMeta:         { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  rideMetaText:     { color: Colors.muted, fontSize: 12 },
  rideCost:         { alignItems: 'flex-end', gap: 4 },
  rideCostValue:    { color: Colors.accent, fontWeight: '800', fontSize: 15 },
});
