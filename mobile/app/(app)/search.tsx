import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import VehicleCard, { Vehicle } from '@/components/ui/VehicleCard';

const VEHICLES: Vehicle[] = [
  { id: '1', name: 'Monopattino', model: 'Flash F2', type: 'scooter', batteryPct: 78, distanceToM: 120, walkMinutes: 8, tripKm: 2.4, estimatedEur: 3.50, recommended: true },
  { id: '2', name: 'Bici elettrica', model: 'E-Bike X', type: 'ebike', batteryPct: 65, distanceToM: 180, walkMinutes: 9, tripKm: 2.6, estimatedEur: 3.80 },
  { id: '3', name: 'Scooter elettrico', model: 'EcoRide S', type: 'scooter', batteryPct: 92, distanceToM: 250, walkMinutes: 7, tripKm: 2.3, estimatedEur: 4.20 },
];

const TABS = ['Miglior scelta', 'Più veloce', 'Più economico'] as const;

export default function SearchScreen() {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Miglior scelta');
  const [selected, setSelected] = useState<Vehicle>(VEHICLES[0]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.searchBarInner}>
          <Ionicons name="search-outline" size={16} color={Colors.muted} />
          <Text style={{ color: Colors.text, fontSize: 15, flex: 1 }}>Porta Romana, Milano</Text>
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Ionicons name="options-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={styles.tripInfo}>
          <View style={styles.tripStat}>
            <Text style={styles.tripStatLabel}>Distanza</Text>
            <Text style={styles.tripStatValue}>2,4 km</Text>
          </View>
          <View style={styles.tripStat}>
            <Ionicons name="time-outline" size={14} color={Colors.muted} />
            <Text style={styles.tripStatLabel}>Tempo stimato</Text>
            <Text style={styles.tripStatValue}>8 min</Text>
          </View>
          <View style={styles.tripStat}>
            <Text style={styles.tripStatLabel}>Prezzo stimato</Text>
            <Text style={[styles.tripStatValue, { color: Colors.accent }]}>€ 3,50 – 4,20</Text>
          </View>
        </View>

        <View style={styles.mapPreview}>
          <LinearGradient colors={['#13132A', '#1A1A35']} style={styles.mapPlaceholder}>
            <View style={styles.routeLine} />
            <View style={[styles.mapDot, { bottom: 24, left: 40 }]} />
            <View style={[styles.mapDot, { top: 24, right: 40, backgroundColor: Colors.success }]} />
            <Text style={styles.mapLabel}>Miglior scelta</Text>
          </LinearGradient>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'Miglior scelta' ? '⭐ ' : tab === 'Più veloce' ? '⚡ ' : '$ '}
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.vehicleSection}>
          <View style={styles.vehicleSectionHeader}>
            <Text style={styles.vehicleSectionTitle}>Mezzi disponibili</Text>
            <TouchableOpacity style={styles.refreshBtn}>
              <Ionicons name="refresh" size={16} color={Colors.muted} />
            </TouchableOpacity>
            <Text style={styles.sortLabel}>Ordina: Migliore</Text>
            <Ionicons name="chevron-down" size={14} color={Colors.muted} />
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            {VEHICLES.map(v => (
              <VehicleCard key={v.id} vehicle={v} selected={selected.id === v.id} onPress={setSelected} />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.bottomBarInfo}>
          <Text style={styles.bottomBarName}>{selected.name}</Text>
          <Text style={styles.bottomBarModel}>{selected.model}</Text>
          <Text style={styles.bottomBarBattery}>{selected.batteryPct}%</Text>
          <Text style={styles.bottomBarDetails}>
            {selected.tripKm} km · {selected.walkMinutes} min
          </Text>
        </View>
        <View style={styles.bottomBarRight}>
          <Text style={styles.bottomBarPrice}>€ {selected.estimatedEur.toFixed(2)}</Text>
          <Ionicons name="information-circle-outline" size={14} color={Colors.muted} />
        </View>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => router.push('/(app)/active-ride')}
        >
          <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.startBtnGradient}>
            <Text style={styles.startBtnText}>Inizia corsa</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.text} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: Colors.bg },
  header:              { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:             { padding: 4 },
  searchBarInner:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, height: 40 },
  filterBtn:           { padding: 4 },
  tripInfo:            { flexDirection: 'row', justifyContent: 'space-around', padding: 16, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tripStat:            { alignItems: 'center', gap: 2 },
  tripStatLabel:       { color: Colors.muted, fontSize: 11 },
  tripStatValue:       { color: Colors.text, fontWeight: '700', fontSize: 15 },
  mapPreview:          { height: 140, margin: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  mapPlaceholder:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  routeLine:           { position: 'absolute', width: 2, height: 80, backgroundColor: Colors.accent, borderRadius: 1, transform: [{ rotate: '30deg' }] },
  mapDot:              { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.text },
  mapLabel:            { position: 'absolute', top: 10, left: 10, backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tabsScroll:          { marginBottom: 16 },
  tab:                 { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  tabActive:           { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: Colors.primary },
  tabText:             { color: Colors.muted, fontSize: 13, fontWeight: '500' },
  tabTextActive:       { color: Colors.text, fontWeight: '700' },
  vehicleSection:      { gap: 12 },
  vehicleSectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  vehicleSectionTitle: { color: Colors.text, fontWeight: '700', fontSize: 16, flex: 1 },
  refreshBtn:          { padding: 2 },
  sortLabel:           { color: Colors.muted, fontSize: 13 },
  bottomBar:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottomBarInfo:       { flex: 1, gap: 2 },
  bottomBarName:       { color: Colors.text, fontWeight: '700', fontSize: 14 },
  bottomBarModel:      { color: Colors.muted, fontSize: 12 },
  bottomBarBattery:    { color: Colors.success, fontSize: 12 },
  bottomBarDetails:    { color: Colors.muted, fontSize: 11 },
  bottomBarRight:      { alignItems: 'flex-end', gap: 2 },
  bottomBarPrice:      { color: Colors.accent, fontWeight: '800', fontSize: 18 },
  startBtn:            { borderRadius: 14, overflow: 'hidden' },
  startBtnGradient:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 20 },
  startBtnText:        { color: Colors.text, fontWeight: '700', fontSize: 15 },
});
