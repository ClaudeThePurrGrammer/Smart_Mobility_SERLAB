import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function posizioneDettaglio(s: ApiSegnalazione): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (s.zona) rows.push({ label: 'Zona', value: s.zona });
  if (s.gps_lat != null && s.gps_lng != null) {
    rows.push({ label: 'GPS', value: `${s.gps_lat.toFixed(6)}, ${s.gps_lng.toFixed(6)}` });
  }
  if (rows.length === 0) rows.push({ label: 'Posizione', value: '—' });
  return rows;
}

function InfoRow({ icon, label, value, valueColor }: {
  icon: any; label: string; value: string; valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={17} color={Colors.accent} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      </View>
    </View>
  );
}

export default function SegnalazioneDettaglioScreen() {
  const { token } = useAuth();
  const { id, contesto } = useLocalSearchParams<{ id: string; contesto?: string }>();

  const [item,    setItem]    = useState<ApiSegnalazione | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [closing,    setClosing]    = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await segnalazioniApi.getById(token!, Number(id));
      setItem(data);
    } catch (e: any) {
      setError(e?.message ?? 'Errore di rete');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleChiudi = useCallback(async () => {
    if (!item || !token) return;
    setClosing(true);
    setCloseError(null);
    try {
      await segnalazioniApi.chiudi(token, item.id);
      router.back();
    } catch (e: any) {
      setCloseError(e?.message ?? 'Errore durante la chiusura');
      setClosing(false);
    }
  }, [item, token]);

  const gravColor = item ? (GRAVITA_COLOR[item.gravita] ?? Colors.muted) : Colors.muted;

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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIcon, item ? { borderColor: gravColor, backgroundColor: `${gravColor}14` } : null]}>
            <Ionicons name="build-outline" size={28} color={item ? gravColor : Colors.accent} />
          </View>
          <Text style={styles.title}>Dettaglio Segnalazione</Text>
          {item && (
            <Text style={styles.idLabel}>#{item.id}</Text>
          )}
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Caricamento…</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <GlassCard>
            <View style={styles.centered}>
              <Ionicons name="cloud-offline-outline" size={36} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchData} activeOpacity={0.8}>
                <Text style={styles.retryText}>Riprova</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Detail */}
        {!loading && !error && item && (
          <>
            {/* Gravità badge prominente */}
            <View style={[styles.gravBanner, { backgroundColor: `${gravColor}18`, borderColor: gravColor }]}>
              <View style={[styles.gravDot, { backgroundColor: gravColor }]} />
              <Text style={[styles.gravText, { color: gravColor }]}>
                Gravità {item.gravita}
              </Text>
              <View style={styles.statoBadge}>
                <Text style={styles.statoText}>{item.stato}</Text>
              </View>
            </View>

            {/* Info card */}
            <Text style={styles.sectionLabel}>INFORMAZIONI</Text>
            <GlassCard style={styles.infoCard} padding={0}>
              <InfoRow
                icon="alert-circle-outline"
                label="Tipologia"
                value={TIPO_LABEL[item.tipo] ?? item.tipo}
              />
              <View style={styles.divider} />
              <InfoRow
                icon="document-text-outline"
                label="Categoria"
                value={item.category || '—'}
              />
              <View style={styles.divider} />
              <InfoRow
                icon="warning-outline"
                label="Gravità"
                value={item.gravita}
                valueColor={gravColor}
              />
              <View style={styles.divider} />
              <InfoRow
                icon="checkmark-circle-outline"
                label="Stato"
                value={item.stato}
                valueColor={item.stato === 'APERTA' ? Colors.warning : Colors.success}
              />
            </GlassCard>

            {/* Descrizione */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>DESCRIZIONE</Text>
            <GlassCard>
              <Text style={styles.descText}>{item.description || '—'}</Text>
            </GlassCard>

            {/* Posizione */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>POSIZIONE</Text>
            <GlassCard style={styles.infoCard} padding={0}>
              {posizioneDettaglio(item).map((row, idx) => (
                <View key={row.label}>
                  {idx > 0 && <View style={styles.divider} />}
                  <InfoRow icon="location-outline" label={row.label} value={row.value} />
                </View>
              ))}
            </GlassCard>

            {/* Date */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>DATE</Text>
            <GlassCard style={styles.infoCard} padding={0}>
              <InfoRow
                icon="time-outline"
                label="Segnalata il"
                value={formatDateTime(item.created_at)}
              />
              {item.closed_at && (
                <>
                  <View style={styles.divider} />
                  <InfoRow
                    icon="checkmark-done-outline"
                    label="Chiusa il"
                    value={formatDateTime(item.closed_at)}
                  />
                </>
              )}
            </GlassCard>
          </>
        )}

        {/* Chiudi segnalazione — solo se aperta E si arriva dalla sezione Chiusura Segnalazioni */}
        {!loading && !error && item?.stato === 'APERTA' && contesto === 'chiusura' && (
          <View style={{ marginTop: 28 }}>
            {closeError && (
              <Text style={styles.closeErrorText}>{closeError}</Text>
            )}
            <TouchableOpacity
              style={[styles.closeBtn, closing && styles.closeBtnDisabled]}
              onPress={handleChiudi}
              disabled={closing}
              activeOpacity={0.8}
            >
              {closing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                  <Text style={styles.closeBtnText}>Chiudi segnalazione</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg },
  backBtn:      { position: 'absolute', top: 52, left: 16, zIndex: 10, backgroundColor: 'rgba(13,13,26,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },
  scroll:       { paddingTop: 112, paddingHorizontal: 16, paddingBottom: 40 },

  header:       { alignItems: 'center', gap: 6, marginBottom: 24 },
  headerIcon:   { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  title:        { color: Colors.text, fontSize: 20, fontWeight: '800' },
  idLabel:      { color: Colors.muted, fontSize: 13, fontWeight: '500' },

  centered:     { alignItems: 'center', gap: 12, paddingVertical: 32 },
  loadingText:  { color: Colors.muted, fontSize: 14 },
  errorText:    { color: Colors.danger, fontSize: 13, textAlign: 'center' },
  retryBtn:     { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: Colors.danger, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  retryText:    { color: Colors.danger, fontSize: 13, fontWeight: '600' },

  gravBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 24 },
  gravDot:      { width: 10, height: 10, borderRadius: 5 },
  gravText:     { fontSize: 15, fontWeight: '700', flex: 1 },
  statoBadge:   { backgroundColor: 'rgba(148,163,184,0.12)', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statoText:    { color: Colors.muted, fontSize: 12, fontWeight: '600' },

  sectionLabel: { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, paddingLeft: 2 },

  infoCard:     { marginBottom: 0 },
  divider:      { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  infoIcon:     { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  infoContent:  { flex: 1 },
  infoLabel:    { color: Colors.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  infoValue:    { color: Colors.text, fontSize: 14, fontWeight: '500', marginTop: 1 },

  descText:     { color: Colors.text, fontSize: 14, lineHeight: 22 },

  closeBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#059669', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 20 },
  closeBtnDisabled: { opacity: 0.5 },
  closeBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeErrorText:   { color: Colors.danger, fontSize: 13, textAlign: 'center', marginBottom: 10 },
});
