import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/theme';
import GlassCard from '@/components/ui/GlassCard';
import { useAuth } from '@/lib/auth/AuthContext';
import { operatoreApi } from '@/lib/api/endpoints';
import type { ApiVehicle } from '@/lib/api/types';

// ── Costanti UI ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available:   { label: 'Disponibile',  color: '#22C55E' },
  in_use:      { label: 'In uso',       color: '#F59E0B' },
  maintenance: { label: 'Manutenzione', color: '#EF4444' },
};

const TYPE_ICON: Record<string, string> = {
  scooter: 'speedometer-outline',
  bike:    'bicycle-outline',
  ebike:   'flash-outline',
  car:     'car-outline',
};

const TYPE_LABEL: Record<string, string> = {
  scooter: 'Scooter',
  bike:    'Bici',
  ebike:   'E-Bike',
  car:     'Auto',
};

// ── Componenti locali ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: Colors.muted };
  return (
    <View style={[styles.badge, { borderColor: cfg.color, backgroundColor: `${cfg.color}18` }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ── Schermata principale ────────────────────────────────────────────────────

export default function BloccoRemotoScreen() {
  const { token } = useAuth();

  const [items,      setItems]      = useState<ApiVehicle[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [query,      setQuery]      = useState('');

  // Modale dettaglio mezzo
  const [selectedVehicle, setSelectedVehicle] = useState<ApiVehicle | null>(null);
  const [actionLoading,   setActionLoading]   = useState(false);
  const [actionError,     setActionError]     = useState<string | null>(null);
  const [actionNotice,    setActionNotice]    = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await operatoreApi.listFlotta(token!);
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? 'Errore di rete');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const filtered = query.trim()
    ? items.filter(v => {
        const q = query.trim().toLowerCase();
        return (
          String(v.id).includes(q) ||
          v.type.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q)
        );
      })
    : items;

  function openDetail(vehicle: ApiVehicle) {
    setSelectedVehicle(vehicle);
    setActionError(null);
    setActionNotice(null);
  }

  function closeDetail() {
    if (actionLoading) return;
    setSelectedVehicle(null);
  }

  async function handleAction(vehicle: ApiVehicle) {
    if (actionLoading) return;
    const prevStatus = vehicle.status;
    const willLock = !vehicle.locked;

    setActionLoading(true);
    setActionError(null);
    setActionNotice(null);

    try {
      const updated = await operatoreApi.bloccaMezzo(token!, vehicle.id, willLock);
      setItems(prev => prev.map(v => v.id === updated.id ? updated : v));
      setSelectedVehicle(updated); // mantieni modale aperto con dati aggiornati

      if (willLock && prevStatus === 'in_use') {
        setActionNotice('Mezzo bloccato. La corsa in corso è stata interrotta automaticamente.');
      }
    } catch (e: any) {
      setActionError(e?.message ?? 'Errore di rete');
    } finally {
      setActionLoading(false);
    }
  }

  const nBloccati = items.filter(v => v.locked).length;
  const nInUso    = items.filter(v => v.status === 'in_use').length;
  const nLiberi   = items.filter(v => v.status === 'available').length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D0D1A', '#1A0A2E', '#0D0D1A']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
        <Ionicons name="arrow-back" size={22} color={Colors.text} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={Colors.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="lock-closed-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Blocco Remoto</Text>
          <Text style={styles.subtitle}>Gestione blocco mezzi della flotta</Text>
        </View>

        {/* Riepilogo pill row */}
        {!loading && !error && items.length > 0 && (
          <View style={styles.summaryRow}>
            {[
              { label: 'Liberi',   count: nLiberi,   color: '#22C55E' },
              { label: 'In uso',   count: nInUso,    color: '#F59E0B' },
              { label: 'Bloccati', count: nBloccati, color: '#EF4444' },
            ].map(({ label, count, color }) => (
              <View key={label} style={[styles.summaryPill, { borderColor: color, backgroundColor: `${color}14` }]}>
                <View style={[styles.summaryDot, { backgroundColor: color }]} />
                <Text style={[styles.summaryCount, { color }]}>{count}</Text>
                <Text style={styles.summaryLabel}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Barra di ricerca */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca per id, tipo o modello…"
            placeholderTextColor={Colors.muted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={Colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Caricamento flotta…</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <GlassCard style={{ marginBottom: 16 }}>
            <View style={styles.centered}>
              <Ionicons name="cloud-offline-outline" size={36} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()} activeOpacity={0.8}>
                <Text style={styles.retryText}>Riprova</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <GlassCard>
            <View style={styles.centered}>
              <Ionicons name="car-outline" size={44} color={Colors.muted} />
              <Text style={styles.emptyTitle}>{query ? 'Nessun risultato' : 'Nessun mezzo'}</Text>
            </View>
          </GlassCard>
        )}

        {/* Contatore */}
        {!loading && !error && items.length > 0 && (
          <Text style={styles.countLabel}>
            {filtered.length} {filtered.length === 1 ? 'mezzo' : 'mezzi'}
            {query ? ' trovati' : ' in flotta'}
          </Text>
        )}

        {/* Lista mezzi — tap apre il dettaglio */}
        {!loading && !error && filtered.map(vehicle => (
          <TouchableOpacity key={vehicle.id} onPress={() => openDetail(vehicle)} activeOpacity={0.82}>
            <GlassCard style={styles.vehicleCard} padding={0}>
              <View style={styles.cardContent}>
                {/* Icona tipo */}
                <View style={[styles.typeIcon, vehicle.locked && styles.typeIconLocked]}>
                  <Ionicons
                    name={(TYPE_ICON[vehicle.type] ?? 'car-outline') as any}
                    size={22}
                    color={vehicle.locked ? '#EF4444' : Colors.accent}
                  />
                </View>

                {/* Info mezzo */}
                <View style={styles.vehicleInfo}>
                  <View style={styles.vehicleTopRow}>
                    <Text style={styles.vehicleName}>#{vehicle.id} · {vehicle.name}</Text>
                    {vehicle.locked && (
                      <View style={styles.lockedBadge}>
                        <Ionicons name="lock-closed" size={11} color="#EF4444" />
                        <Text style={styles.lockedBadgeText}>Bloccato</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.vehicleModel}>
                    {TYPE_LABEL[vehicle.type] ?? vehicle.type} · {vehicle.model}
                  </Text>
                  <View style={styles.vehicleMetaRow}>
                    <StatusBadge status={vehicle.status} />
                    <View style={styles.batteryRow}>
                      <Ionicons
                        name={vehicle.battery_pct > 30 ? 'battery-half-outline' : 'battery-dead-outline'}
                        size={14}
                        color={vehicle.battery_pct > 30 ? Colors.muted : Colors.danger}
                      />
                      <Text style={[styles.batteryText, vehicle.battery_pct <= 30 && { color: Colors.danger }]}>
                        {vehicle.battery_pct}%
                      </Text>
                    </View>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
              </View>
            </GlassCard>
          </TouchableOpacity>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modale dettaglio mezzo */}
      <Modal
        visible={!!selectedVehicle}
        transparent
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={closeDetail}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={styles.detailSheet}
          >
            <LinearGradient
              colors={['#1A1A35', '#0D0D1A']}
              style={StyleSheet.absoluteFillObject}
              borderRadius={24}
            />

            {selectedVehicle && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.detailScroll}
              >
                {/* Handle */}
                <View style={styles.sheetHandle} />

                {/* Intestazione */}
                <View style={styles.detailHeader}>
                  <View style={[styles.detailTypeIcon, selectedVehicle.locked && styles.typeIconLocked]}>
                    <Ionicons
                      name={(TYPE_ICON[selectedVehicle.type] ?? 'car-outline') as any}
                      size={26}
                      color={selectedVehicle.locked ? '#EF4444' : Colors.accent}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.detailTitle}>#{selectedVehicle.id} · {selectedVehicle.name}</Text>
                    <Text style={styles.detailSubtitle}>
                      {TYPE_LABEL[selectedVehicle.type] ?? selectedVehicle.type} · {selectedVehicle.model}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeDetail} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={22} color={Colors.muted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.detailDivider} />

                {/* Badge stato e blocco */}
                <View style={styles.detailBadgeRow}>
                  <StatusBadge status={selectedVehicle.status} />
                  {selectedVehicle.locked && (
                    <View style={styles.lockedBadge}>
                      <Ionicons name="lock-closed" size={11} color="#EF4444" />
                      <Text style={styles.lockedBadgeText}>Bloccato da operatore</Text>
                    </View>
                  )}
                </View>

                {/* Info in griglia */}
                <View style={styles.detailGrid}>
                  <View style={styles.detailCell}>
                    <Text style={styles.detailCellLabel}>BATTERIA</Text>
                    <View style={styles.batteryRow}>
                      <Ionicons
                        name={selectedVehicle.battery_pct > 30 ? 'battery-half-outline' : 'battery-dead-outline'}
                        size={16}
                        color={selectedVehicle.battery_pct > 30 ? '#22C55E' : Colors.danger}
                      />
                      <Text style={[styles.detailCellValue, selectedVehicle.battery_pct <= 30 && { color: Colors.danger }]}>
                        {selectedVehicle.battery_pct}%
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailCell}>
                    <Text style={styles.detailCellLabel}>SBLOCCO</Text>
                    <Text style={styles.detailCellValue}>€{selectedVehicle.unlock_fee.toFixed(2)}</Text>
                  </View>
                  <View style={styles.detailCell}>
                    <Text style={styles.detailCellLabel}>TARIFFA/MIN</Text>
                    <Text style={styles.detailCellValue}>€{selectedVehicle.price_per_min.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Mappa posizione */}
                <Text style={styles.detailSectionLabel}>POSIZIONE ATTUALE</Text>
                <View style={styles.mapContainer}>
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.miniMap}
                    region={{
                      latitude: selectedVehicle.lat,
                      longitude: selectedVehicle.lng,
                      latitudeDelta: 0.004,
                      longitudeDelta: 0.004,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    pointerEvents="none"
                  >
                    <Marker
                      coordinate={{ latitude: selectedVehicle.lat, longitude: selectedVehicle.lng }}
                      pinColor={selectedVehicle.locked ? '#EF4444' : '#A78BFA'}
                    />
                  </MapView>
                </View>
                <Text style={styles.coordsText}>
                  {selectedVehicle.lat.toFixed(5)}, {selectedVehicle.lng.toFixed(5)}
                </Text>

                {/* Avviso corsa interrotta */}
                {actionNotice && (
                  <View style={styles.noticeRow}>
                    <Ionicons name="information-circle-outline" size={15} color={Colors.warning} />
                    <Text style={styles.noticeText}>{actionNotice}</Text>
                  </View>
                )}

                {/* Errore azione */}
                {actionError && (
                  <Text style={styles.actionErrorText}>{actionError}</Text>
                )}

                {/* Bottone azione */}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    selectedVehicle.locked ? styles.actionBtnUnlock : styles.actionBtnLock,
                    actionLoading && { opacity: 0.5 },
                  ]}
                  onPress={() => handleAction(selectedVehicle)}
                  disabled={actionLoading}
                  activeOpacity={0.82}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name={selectedVehicle.locked ? 'lock-open-outline' : 'lock-closed-outline'}
                        size={18}
                        color="#fff"
                      />
                      <Text style={styles.actionBtnText}>
                        {selectedVehicle.locked ? 'Sblocca mezzo' : 'Blocca da remoto'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Stili ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg },
  backBtn:     { position: 'absolute', top: 52, left: 16, zIndex: 10, backgroundColor: 'rgba(13,13,26,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },
  scroll:      { paddingTop: 112, paddingHorizontal: 16, paddingBottom: 40 },

  header:      { alignItems: 'center', gap: 8, marginBottom: 20 },
  headerIcon:  { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  title:       { color: Colors.text, fontSize: 22, fontWeight: '800' },
  subtitle:    { color: Colors.muted, fontSize: 13, textAlign: 'center' },

  summaryRow:   { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryPill:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingVertical: 8 },
  summaryDot:   { width: 7, height: 7, borderRadius: 3.5 },
  summaryCount: { fontSize: 16, fontWeight: '800' },
  summaryLabel: { color: Colors.muted, fontSize: 11, fontWeight: '600' },

  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, padding: 0 },

  countLabel:  { color: Colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 10, paddingLeft: 2 },

  centered:    { alignItems: 'center', gap: 12, paddingVertical: 24 },
  loadingText: { color: Colors.muted, fontSize: 14 },
  errorText:   { color: Colors.danger, fontSize: 13, textAlign: 'center' },
  retryBtn:    { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: Colors.danger, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  retryText:   { color: Colors.danger, fontSize: 13, fontWeight: '600' },
  emptyTitle:  { color: Colors.text, fontSize: 16, fontWeight: '700' },

  vehicleCard:     { marginBottom: 12 },
  cardContent:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  typeIcon:        { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(167,139,250,0.12)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', alignItems: 'center', justifyContent: 'center' },
  typeIconLocked:  { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.35)' },

  vehicleInfo:     { flex: 1, gap: 4 },
  vehicleTopRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  vehicleName:     { color: Colors.text, fontSize: 14, fontWeight: '700' },
  vehicleModel:    { color: Colors.muted, fontSize: 12 },
  vehicleMetaRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },

  lockedBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.14)', borderWidth: 1, borderColor: '#EF4444', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  lockedBadgeText: { color: '#EF4444', fontSize: 10, fontWeight: '700' },

  badge:       { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 11, fontWeight: '600' },

  batteryRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  batteryText: { color: Colors.muted, fontSize: 12 },

  noticeRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 12 },
  noticeText:    { color: Colors.warning, fontSize: 12, flex: 1, lineHeight: 17 },
  actionErrorText: { color: Colors.danger, fontSize: 12, marginBottom: 8 },

  actionBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  actionBtnLock:   { backgroundColor: '#DC2626' },
  actionBtnUnlock: { backgroundColor: '#059669' },
  actionBtnText:   { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Modale dettaglio — bottom sheet
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailSheet:  { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', maxHeight: '90%' },
  detailScroll: { padding: 20, paddingBottom: 36 },
  sheetHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },

  detailHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  detailTypeIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(167,139,250,0.12)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', alignItems: 'center', justifyContent: 'center' },
  detailTitle:    { color: Colors.text, fontSize: 16, fontWeight: '800' },
  detailSubtitle: { color: Colors.muted, fontSize: 13 },
  detailDivider:  { height: 1, backgroundColor: Colors.border, marginBottom: 14 },

  detailBadgeRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },

  detailGrid:     { flexDirection: 'row', gap: 8, marginBottom: 16 },
  detailCell:     { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, gap: 6 },
  detailCellLabel:{ color: Colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  detailCellValue:{ color: Colors.text, fontSize: 15, fontWeight: '800' },

  detailSectionLabel: { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  mapContainer:  { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  miniMap:       { width: '100%', height: 180 },
  coordsText:    { color: Colors.muted, fontSize: 11, textAlign: 'center', marginBottom: 20, fontFamily: 'monospace' } as any,
});
