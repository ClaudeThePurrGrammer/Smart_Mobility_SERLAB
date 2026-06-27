// CU-26 — Notifiche Aree a Diversa Disponibilità (UC-OP02)
// Lista di tutte le aree di parcheggio con segnalazione anomalie di densità.
//
// Logica icone:
//   mezzi > 5  → triangolo GIALLO (sovrabbondanza)
//   mezzi <= 2 → triangolo VERDE  (carenza)
//   3–5        → nessuna icona    (normale)

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/theme';
import GlassCard from '@/components/ui/GlassCard';
import { useAuth } from '@/lib/auth/AuthContext';
import { operatoreApi } from '@/lib/api/endpoints';
import type { ApiAreaDensita } from '@/lib/api/types';

// ── Soglie ────────────────────────────────────────────────────────────────────
const SOGLIA_PIENA   = 5;  // mezzi > SOGLIA_PIENA   → triangolo giallo
const SOGLIA_CRITICA = 2;  // mezzi <= SOGLIA_CRITICA → triangolo verde

type Anomalia = 'PIENA' | 'CRITICA' | 'OK';

function getAnomalia(mezzi: number): Anomalia {
  if (mezzi > SOGLIA_PIENA) return 'PIENA';
  if (mezzi <= SOGLIA_CRITICA) return 'CRITICA';
  return 'OK';
}

// ── Componente icona triangolo ────────────────────────────────────────────────
function IconaTriangolo({ color }: { color: string }) {
  return (
    <View style={[styles.triangleWrap, { borderColor: color, backgroundColor: `${color}18` }]}>
      <Text style={[styles.triangleText, { color }]}>!</Text>
    </View>
  );
}

// ── Barra capacità grafica ────────────────────────────────────────────────────
function BarraCapacita({ mezzi, capienza }: { mezzi: number; capienza: number }) {
  const pct = capienza > 0 ? Math.min(mezzi / capienza, 1) : 0;
  const anomalia = getAnomalia(mezzi);
  const barColor =
    anomalia === 'PIENA'   ? '#F59E0B' :
    anomalia === 'CRITICA' ? '#22C55E' :
    Colors.accent;
  return (
    <View style={styles.barContainer}>
      <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: barColor }]} />
    </View>
  );
}

// ── Riepilogo in cima ─────────────────────────────────────────────────────────
function Riepilogo({ aree }: { aree: ApiAreaDensita[] }) {
  const piene    = aree.filter(a => getAnomalia(a.mezzi) === 'PIENA').length;
  const critiche = aree.filter(a => getAnomalia(a.mezzi) === 'CRITICA').length;
  const ok       = aree.filter(a => getAnomalia(a.mezzi) === 'OK').length;
  return (
    <View style={styles.riepilogoRow}>
      <View style={[styles.riepilogoItem, { borderColor: '#F59E0B33' }]}>
        <Text style={[styles.riepilogoNum, { color: '#F59E0B' }]}>{piene}</Text>
        <Text style={styles.riepilogoLabel}>Sovraffollate</Text>
      </View>
      <View style={[styles.riepilogoItem, { borderColor: '#22C55E33' }]}>
        <Text style={[styles.riepilogoNum, { color: '#22C55E' }]}>{critiche}</Text>
        <Text style={styles.riepilogoLabel}>Carenza</Text>
      </View>
      <View style={[styles.riepilogoItem, { borderColor: Colors.border }]}>
        <Text style={[styles.riepilogoNum, { color: Colors.text }]}>{ok}</Text>
        <Text style={styles.riepilogoLabel}>Normali</Text>
      </View>
    </View>
  );
}

// ── Card singola area ─────────────────────────────────────────────────────────
function AreaCard({ area }: { area: ApiAreaDensita }) {
  const anomalia = getAnomalia(area.mezzi);
  return (
    <GlassCard style={styles.card}>
      {/* Riga principale: nome + icona anomalia */}
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardNome} numberOfLines={1}>{area.nome}</Text>
          <View style={styles.cardSubRow}>
            <Ionicons name="location-outline" size={12} color={Colors.muted} />
            <Text style={styles.cardCoords}>
              {area.lat.toFixed(4)}, {area.lng.toFixed(4)}
            </Text>
          </View>
        </View>
        {anomalia === 'PIENA'   && <IconaTriangolo color="#F59E0B" />}
        {anomalia === 'CRITICA' && <IconaTriangolo color="#22C55E" />}
      </View>

      {/* Barra capacità */}
      <BarraCapacita mezzi={area.mezzi} capienza={area.capienza} />

      {/* Footer: contatore + badge stato */}
      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="bicycle-outline" size={14} color={Colors.muted} />
          <Text style={styles.footerText}>
            <Text style={{ color: Colors.text, fontWeight: '700' }}>{area.mezzi}</Text>
            {' '}/ {area.capienza} posti
          </Text>
        </View>

        {anomalia === 'PIENA' && (
          <View style={[styles.badge, { backgroundColor: '#F59E0B18', borderColor: '#F59E0B55' }]}>
            <Text style={[styles.badgeText, { color: '#F59E0B' }]}>Sovraffollata</Text>
          </View>
        )}
        {anomalia === 'CRITICA' && (
          <View style={[styles.badge, { backgroundColor: '#22C55E14', borderColor: '#22C55E55' }]}>
            <Text style={[styles.badgeText, { color: '#22C55E' }]}>Carenza mezzi</Text>
          </View>
        )}
        {anomalia === 'OK' && (
          <View style={[styles.badge, { backgroundColor: `${Colors.accent}14`, borderColor: `${Colors.accent}44` }]}>
            <Text style={[styles.badgeText, { color: Colors.accent }]}>Normale</Text>
          </View>
        )}
      </View>
    </GlassCard>
  );
}

// ── Schermata principale ──────────────────────────────────────────────────────
export default function DisponibilitaAreeScreen() {
  const { token } = useAuth();
  const [aree, setAree]       = useState<ApiAreaDensita[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchAree = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await operatoreApi.areeDensita(token);
      // Ordine: anomalie prima (PIENA → CRITICA → OK)
      data.sort((a, b) => {
        const ord: Record<Anomalia, number> = { PIENA: 0, CRITICA: 1, OK: 2 };
        return ord[getAnomalia(a.mezzi)] - ord[getAnomalia(b.mezzi)];
      });
      setAree(data);
    } catch (e: any) {
      setError(e?.message ?? 'Errore nel caricamento delle aree.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchAree(); }, [fetchAree]));

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
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchAree} tintColor={Colors.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="map-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Disponibilità Aree</Text>
          <Text style={styles.subtitle}>
            Monitoraggio distribuzione mezzi nelle aree di parcheggio
          </Text>
        </View>

        {/* Legenda */}
        <View style={styles.legenda}>
          <View style={styles.legendaItem}>
            <IconaTriangolo color="#F59E0B" />
            <Text style={styles.legendaText}>Sovraffollata ({'>'} 5 mezzi)</Text>
          </View>
          <View style={styles.legendaItem}>
            <IconaTriangolo color="#22C55E" />
            <Text style={styles.legendaText}>Carenza (≤ 2 mezzi)</Text>
          </View>
        </View>

        {/* Loading iniziale */}
        {loading && aree.length === 0 && (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.accent} size="large" />
            <Text style={styles.loadingText}>Caricamento aree…</Text>
          </View>
        )}

        {/* Errore */}
        {!loading && error && (
          <GlassCard>
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={36} color={Colors.danger} />
              <Text style={[styles.loadingText, { color: Colors.danger }]}>{error}</Text>
              <TouchableOpacity onPress={fetchAree} style={styles.retryBtn}>
                <Text style={{ color: Colors.accent, fontWeight: '600' }}>Riprova</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Nessuna area */}
        {!loading && !error && aree.length === 0 && (
          <GlassCard>
            <View style={styles.center}>
              <Ionicons name="information-circle-outline" size={36} color={Colors.muted} />
              <Text style={styles.loadingText}>Nessuna area di parcheggio configurata.</Text>
            </View>
          </GlassCard>
        )}

        {/* Riepilogo + lista */}
        {aree.length > 0 && (
          <>
            <Riepilogo aree={aree} />
            {aree.map(area => <AreaCard key={area.area_id} area={area} />)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  backBtn:        { position: 'absolute', top: 52, left: 16, zIndex: 10, backgroundColor: 'rgba(13,13,26,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },
  scroll:         { paddingTop: 112, paddingHorizontal: 16, paddingBottom: 40 },

  // Header
  header:         { alignItems: 'center', gap: 6, marginBottom: 20 },
  headerIcon:     { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  title:          { color: Colors.text, fontSize: 22, fontWeight: '800' },
  subtitle:       { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },

  // Legenda
  legenda:        { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 16 },
  legendaItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaText:    { color: Colors.muted, fontSize: 12 },

  // Riepilogo
  riepilogoRow:   { flexDirection: 'row', gap: 10, marginBottom: 16 },
  riepilogoItem:  { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 4 },
  riepilogoNum:   { fontSize: 22, fontWeight: '800' },
  riepilogoLabel: { color: Colors.muted, fontSize: 11 },

  // Card area
  card:           { marginBottom: 12 },
  cardRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardNome:       { color: Colors.text, fontSize: 15, fontWeight: '700' },
  cardSubRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardCoords:     { color: Colors.muted, fontSize: 11 },

  // Barra
  barContainer:   { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  barFill:        { height: '100%', borderRadius: 3 },

  // Footer card
  cardFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerItem:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText:     { color: Colors.muted, fontSize: 13 },
  badge:          { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:      { fontSize: 11, fontWeight: '600' },

  // Icona triangolo
  triangleWrap:   { width: 30, height: 30, borderWidth: 2, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  triangleText:   { fontSize: 16, fontWeight: '900', lineHeight: 22 },

  // Stati
  center:         { alignItems: 'center', gap: 12, paddingVertical: 24 },
  loadingText:    { color: Colors.muted, fontSize: 14, textAlign: 'center' },
  retryBtn:       { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 },
});
