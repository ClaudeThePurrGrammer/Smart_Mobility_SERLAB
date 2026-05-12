import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';

type Filter = 'Tutte' | 'Questo mese' | 'Precedenti';

interface Ride {
  id: string;
  type: 'scooter' | 'bike' | 'ebike';
  date: string;
  from: string;
  to: string;
  km: number;
  minutes: number;
  cost: number;
  points: number;
}

const RIDES: Ride[] = [
  { id: '1', type: 'scooter', date: 'Oggi, 08:24',        from: 'Via Roma 12',        to: 'Porta Romana',    km: 2.4, minutes: 12, cost: 3.60, points: 18 },
  { id: '2', type: 'bike',    date: 'Ieri, 17:45',        from: 'Stazione Centrale',  to: 'Corso Italia',    km: 1.8, minutes: 9,  cost: 2.80, points: 12 },
  { id: '3', type: 'ebike',   date: '10 mag, 09:10',      from: 'Piazza Garibaldi',   to: 'Viale Europa',    km: 3.2, minutes: 18, cost: 4.50, points: 24 },
  { id: '4', type: 'scooter', date: '8 mag, 14:30',       from: 'Via Napoli 5',       to: 'Università',      km: 2.1, minutes: 11, cost: 3.20, points: 16 },
  { id: '5', type: 'bike',    date: '5 mag, 08:00',       from: 'Casa',               to: 'Lavoro',          km: 4.1, minutes: 22, cost: 5.10, points: 30 },
  { id: '6', type: 'scooter', date: '28 apr, 11:15',      from: 'Centro Commerciale', to: 'Parco Cittadino', km: 1.5, minutes: 8,  cost: 2.40, points: 10 },
  { id: '7', type: 'ebike',   date: '21 apr, 16:00',      from: 'Ospedale',           to: 'Via Roma 12',     km: 2.8, minutes: 15, cost: 3.90, points: 20 },
];

const VEHICLE_ICON: Record<Ride['type'], string> = {
  scooter: 'scooter',
  bike: 'bicycle',
  ebike: 'bicycle-electric',
};

const FILTERS: Filter[] = ['Tutte', 'Questo mese', 'Precedenti'];

export default function RideHistoryScreen() {
  const [filter, setFilter] = useState<Filter>('Tutte');

  const filtered = filter === 'Questo mese'
    ? RIDES.filter(r => r.date.includes('mag') || r.date.includes('Oggi') || r.date.includes('Ieri'))
    : filter === 'Precedenti'
    ? RIDES.filter(r => r.date.includes('apr'))
    : RIDES;

  const totKm   = filtered.reduce((s, r) => s + r.km, 0).toFixed(1);
  const totEur  = filtered.reduce((s, r) => s + r.cost, 0).toFixed(2);
  const totPts  = filtered.reduce((s, r) => s + r.points, 0);

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
        {filtered.map((ride, idx) => (
          <TouchableOpacity key={ride.id} style={[styles.rideCard, idx === 0 && { marginTop: 16 }]}>
            <View style={styles.rideIcon}>
              <MaterialCommunityIcons name={VEHICLE_ICON[ride.type] as any} size={24} color={Colors.accent} />
            </View>
            <View style={styles.rideInfo}>
              <Text style={styles.rideDate}>{ride.date}</Text>
              <Text style={styles.rideRoute} numberOfLines={1}>{ride.from} → {ride.to}</Text>
              <View style={styles.rideMeta}>
                <Ionicons name="map-outline" size={12} color={Colors.muted} />
                <Text style={styles.rideMetaText}>{ride.km} km</Text>
                <Ionicons name="time-outline" size={12} color={Colors.muted} />
                <Text style={styles.rideMetaText}>{ride.minutes} min</Text>
                <Ionicons name="star-outline" size={12} color={Colors.warning} />
                <Text style={[styles.rideMetaText, { color: Colors.warning }]}>+{ride.points} pt</Text>
              </View>
            </View>
            <View style={styles.rideCost}>
              <Text style={styles.rideCostValue}>€ {ride.cost.toFixed(2)}</Text>
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
