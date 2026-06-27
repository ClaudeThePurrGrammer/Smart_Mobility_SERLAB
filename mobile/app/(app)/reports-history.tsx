// app/(app)/reports-history.tsx
// Storico delle segnalazioni dell'utente + accesso rapido a una nuova segnalazione.
import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRideSession } from '@/lib/ride/RideSessionContext';
import { reportsApi } from '@/lib/api/endpoints';
import type { ApiReport } from '@/lib/api/types';

// ── Helpers di presentazione ─────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  veicolo:    'Veicolo',
  parcheggio: 'Parcheggio',
  sicurezza:  'Sicurezza',
  strada:     'Strada / percorso',
  altro:      'Altro',
};

const CATEGORY_ICONS: Record<string, string> = {
  veicolo:    'bicycle-outline',
  parcheggio: 'car-outline',
  sicurezza:  'warning-outline',
  strada:     'map-outline',
  altro:      'ellipsis-horizontal-outline',
};

const TIPO_LABELS: Record<string, string> = {
  MALFUNZIONAMENTO: 'Malfunzionamento',
  OSTACOLO:         'Ostacolo',
  PERCORSO:         'Percorso',
  ALTRO:            'Altro',
};

const GRAVITA_COLORS: Record<string, string> = {
  BASSA: Colors.success,
  MEDIA: Colors.warning,
  ALTA:  Colors.danger,
};

const STATO_COLORS: Record<string, string> = {
  APERTA: Colors.warning,
  CHIUSA: Colors.success,
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export default function ReportsHistoryScreen() {
  const { token } = useAuth();
  const { session } = useRideSession();
  // Se la corsa è attiva, la navigazione indietro deve andare ESCLUSIVAMENTE
  // alla schermata della corsa attiva — non alla home o allo stack precedente.
  const isDuringRide = session !== null;
  const goBack = () => isDuringRide
    ? router.replace('/(app)/active-ride')
    : router.back();

  const [reports, setReports] = useState<ApiReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!token) return;
    try {
      const data = await reportsApi.list(token);
      setReports(data);
      setError(null);
    } catch {
      setError('Impossibile caricare le segnalazioni.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Ricarica ogni volta che la schermata riceve focus (es. ritorno dopo invio).
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadReports();
    }, [loadReports]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Le mie segnalazioni</Text>
        {isDuringRide ? (
          <View style={styles.rideBadge}>
            <Ionicons name="bicycle" size={14} color={Colors.success} />
          </View>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Bottone nuova segnalazione */}
      <TouchableOpacity
        style={styles.newBtn}
        onPress={() => router.push({
          pathname: '/(app)/report',
          params: isDuringRide && session ? { rideId: String(session.rideId) } : {},
        })}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={Gradients.primaryBtn}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.newBtnGradient}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.text} />
          <Text style={styles.newBtnText}>Nuova segnalazione</Text>
        </LinearGradient>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.emptyText}>Caricamento...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={44} color={Colors.muted} />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={loadReports} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        >
          {reports.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="megaphone-outline" size={52} color={Colors.muted} />
              <Text style={styles.emptyTitle}>Nessuna segnalazione</Text>
              <Text style={styles.emptySubtitle}>
                Quando invii una segnalazione la trovi qui, con il suo stato aggiornato.
              </Text>
            </View>
          ) : (
            reports.map(r => (
              <View key={r.id} style={styles.card}>
                {/* Riga header card */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Ionicons
                      name={(CATEGORY_ICONS[r.category] ?? 'alert-circle-outline') as any}
                      size={20}
                      color={Colors.accent}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.cardTitle}>
                      {CATEGORY_LABELS[r.category] ?? r.category}
                    </Text>
                    <Text style={styles.cardDate}>{formatDate(r.created_at)}</Text>
                  </View>
                  {/* Stato badge */}
                  <View style={[
                    styles.statoBadge,
                    { backgroundColor: `${STATO_COLORS[r.status] ?? Colors.muted}22`,
                      borderColor: STATO_COLORS[r.status] ?? Colors.muted },
                  ]}>
                    <Text style={[styles.statoText, { color: STATO_COLORS[r.status] ?? Colors.muted }]}>
                      {r.status === 'APERTA' ? 'Aperta' : 'Chiusa'}
                    </Text>
                  </View>
                </View>

                {/* Pills tipo + gravità */}
                <View style={styles.pillRow}>
                  {r.tipo && r.tipo !== 'ALTRO' && (
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{TIPO_LABELS[r.tipo] ?? r.tipo}</Text>
                    </View>
                  )}
                  {r.gravita && (
                    <View style={[
                      styles.pill,
                      { borderColor: GRAVITA_COLORS[r.gravita] ?? Colors.muted,
                        backgroundColor: `${GRAVITA_COLORS[r.gravita] ?? Colors.muted}18` },
                    ]}>
                      <View style={[styles.gravDot, { backgroundColor: GRAVITA_COLORS[r.gravita] ?? Colors.muted }]} />
                      <Text style={[styles.pillText, { color: GRAVITA_COLORS[r.gravita] ?? Colors.muted }]}>
                        {r.gravita === 'ALTA' ? 'Alta' : r.gravita === 'MEDIA' ? 'Media' : 'Bassa'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Descrizione */}
                {r.description ? (
                  <Text style={styles.cardDesc} numberOfLines={3}>{r.description}</Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  backBtn:        { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title:          { color: Colors.text, fontSize: 18, fontWeight: '800' },
  rideBadge:      { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: Colors.success, alignItems: 'center', justifyContent: 'center' },

  newBtn:         { margin: 16, borderRadius: 16, overflow: 'hidden' },
  newBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  newBtnText:     { color: Colors.text, fontWeight: '700', fontSize: 15 },

  centered:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText:      { color: Colors.muted, fontSize: 14 },
  retryBtn:       { marginTop: 4, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText:   { color: Colors.text, fontWeight: '600' },

  emptyState:     { alignItems: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 24 },
  emptyTitle:     { color: Colors.text, fontSize: 18, fontWeight: '700' },
  emptySubtitle:  { color: Colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  card:           { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 16, gap: 10 },
  cardHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIconBox:    { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle:      { color: Colors.text, fontWeight: '700', fontSize: 14 },
  cardDate:       { color: Colors.muted, fontSize: 12 },
  statoBadge:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statoText:      { fontSize: 11, fontWeight: '700' },

  pillRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill:           { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.surface },
  pillText:       { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  gravDot:        { width: 7, height: 7, borderRadius: 3.5 },

  cardDesc:       { color: Colors.muted, fontSize: 13, lineHeight: 18 },
});
