import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/theme';
import GlassCard from '@/components/ui/GlassCard';
import { useAuth } from '@/lib/auth/AuthContext';
import { segnalazioniApi } from '@/lib/api/endpoints';
import type { ApiSegnalazione } from '@/lib/api/types';

const GRAVITA_COLOR: Record<string, string> = {
  ALTA:  '#EF4444',
  MEDIA: '#F59E0B',
  BASSA: '#10B981',
};

const TIPO_LABEL: Record<string, string> = {
  MALFUNZIONAMENTO: 'Malfunzionamento',
  OSTACOLO:         'Ostacolo',
  PERCORSO:         'Percorso',
  ALTRO:            'Altro',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function posizione(s: ApiSegnalazione): string {
  if (s.zona) return s.zona;
  if (s.gps_lat != null && s.gps_lng != null) {
    return `${s.gps_lat.toFixed(4)}, ${s.gps_lng.toFixed(4)}`;
  }
  return '—';
}

export default function MalfunzionamentiMezziScreen() {
  const { token } = useAuth();

  const [items,      setItems]      = useState<ApiSegnalazione[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await segnalazioniApi.listAperte(token!);
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? 'Errore di rete');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // Contatori per gravità (riepilogo rapido)
  const nAlta  = items.filter(i => i.gravita === 'ALTA').length;
  const nMedia = items.filter(i => i.gravita === 'MEDIA').length;
  const nBassa = items.filter(i => i.gravita === 'BASSA').length;

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
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={Colors.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="build-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Malfunzionamenti Mezzi</Text>
          <Text style={styles.subtitle}>Segnalazioni aperte · ordinate per gravità</Text>
        </View>

        {/* Riepilogo pill row — visibile solo quando ci sono dati */}
        {!loading && !error && items.length > 0 && (
          <View style={styles.summaryRow}>
            {[
              { label: 'Alta',  count: nAlta,  color: '#EF4444' },
              { label: 'Media', count: nMedia, color: '#F59E0B' },
              { label: 'Bassa', count: nBassa, color: '#10B981' },
            ].map(({ label, count, color }) => (
              <View key={label} style={[styles.summaryPill, { borderColor: color, backgroundColor: `${color}14` }]}>
                <View style={[styles.summaryDot, { backgroundColor: color }]} />
                <Text style={[styles.summaryCount, { color }]}>{count}</Text>
                <Text style={styles.summaryLabel}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Caricamento segnalazioni…</Text>
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
        {!loading && !error && items.length === 0 && (
          <GlassCard>
            <View style={styles.centered}>
              <Ionicons name="checkmark-circle-outline" size={44} color={Colors.success} />
              <Text style={styles.emptyTitle}>Nessuna segnalazione aperta</Text>
              <Text style={styles.emptyBody}>Tutte le segnalazioni sono state gestite.</Text>
            </View>
          </GlassCard>
        )}

        {/* List */}
        {!loading && !error && items.map(item => {
          const color = GRAVITA_COLOR[item.gravita] ?? Colors.muted;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.82}
              onPress={() => router.push({ pathname: '/(operatore)/segnalazione-dettaglio', params: { id: String(item.id), contesto: 'malfunzionamenti' } } as any)}
            >
            <GlassCard style={styles.card} padding={0}>
              <View style={styles.cardRow}>
                {/* Colored accent bar */}
                <View style={[styles.accentBar, { backgroundColor: color }]} />

                <View style={styles.cardBody}>
                  {/* Badges */}
                  <View style={styles.badgeRow}>
                    <View style={[styles.gravBadge, { borderColor: color, backgroundColor: `${color}22` }]}>
                      <View style={[styles.badgeDot, { backgroundColor: color }]} />
                      <Text style={[styles.gravText, { color }]}>{item.gravita}</Text>
                    </View>
                    <View style={styles.tipoBadge}>
                      <Text style={styles.tipoText}>{TIPO_LABEL[item.tipo] ?? item.tipo}</Text>
                    </View>
                  </View>

                  {/* Description */}
                  <Text style={styles.desc} numberOfLines={3}>
                    {item.description || '—'}
                  </Text>

                  {/* Footer */}
                  <View style={styles.footerRow}>
                    <View style={styles.footerItem}>
                      <Ionicons name="location-outline" size={13} color={Colors.muted} />
                      <Text style={styles.footerText} numberOfLines={1}>{posizione(item)}</Text>
                    </View>
                    <View style={styles.footerItem}>
                      <Ionicons name="time-outline" size={13} color={Colors.muted} />
                      <Text style={styles.footerText}>{formatDate(item.created_at)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </GlassCard>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg },
  backBtn:      { position: 'absolute', top: 52, left: 16, zIndex: 10, backgroundColor: 'rgba(13,13,26,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },
  scroll:       { paddingTop: 112, paddingHorizontal: 16, paddingBottom: 40 },

  header:       { alignItems: 'center', gap: 8, marginBottom: 24 },
  headerIcon:   { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  title:        { color: Colors.text, fontSize: 22, fontWeight: '800' },
  subtitle:     { color: Colors.muted, fontSize: 13, textAlign: 'center' },

  summaryRow:   { flexDirection: 'row', gap: 8, marginBottom: 20 },
  summaryPill:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingVertical: 8 },
  summaryDot:   { width: 7, height: 7, borderRadius: 3.5 },
  summaryCount: { fontSize: 16, fontWeight: '800' },
  summaryLabel: { color: Colors.muted, fontSize: 11, fontWeight: '600' },

  centered:     { alignItems: 'center', gap: 12, paddingVertical: 24 },
  loadingText:  { color: Colors.muted, fontSize: 14 },
  errorText:    { color: Colors.danger, fontSize: 13, textAlign: 'center' },
  retryBtn:     { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: Colors.danger, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  retryText:    { color: Colors.danger, fontSize: 13, fontWeight: '600' },
  emptyTitle:   { color: Colors.text, fontSize: 16, fontWeight: '700' },
  emptyBody:    { color: Colors.muted, fontSize: 13, textAlign: 'center' },

  card:         { marginBottom: 12 },
  cardRow:      { flexDirection: 'row' },
  accentBar:    { width: 4, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  cardBody:     { flex: 1, padding: 14, gap: 8 },

  badgeRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  gravBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeDot:     { width: 6, height: 6, borderRadius: 3 },
  gravText:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  tipoBadge:    { backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  tipoText:     { color: Colors.accent, fontSize: 11, fontWeight: '600' },

  desc:         { color: Colors.text, fontSize: 14, lineHeight: 20 },

  footerRow:    { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  footerItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText:   { color: Colors.muted, fontSize: 12, maxWidth: 170 },
});
