// UC-31 — Assegnazione Automatica Bonus (OP.07)
// L'operatore configura la soglia di corse e i punti bonus,
// poi attiva la regola: tutti gli utenti idonei ricevono i punti e una notifica.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import GlassCard from '@/components/ui/GlassCard';
import GradientButton from '@/components/ui/GradientButton';
import { useAuth } from '@/lib/auth/AuthContext';
import { operatoreApi } from '@/lib/api/endpoints';

// ── Validazione ───────────────────────────────────────────────────────────────
function validate(soglia: string, punti: string): string | null {
  const s = parseInt(soglia, 10);
  const p = parseInt(punti, 10);
  if (!soglia.trim() || isNaN(s) || s <= 0)
    return 'Il numero di corse deve essere un intero maggiore di zero.';
  if (!punti.trim() || isNaN(p) || p <= 0)
    return 'I punti bonus devono essere un intero maggiore di zero.';
  return null;
}

// ── Componente campo numerico ─────────────────────────────────────────────────
function NumericField({
  icon, label, value, onChange, placeholder, invalid,
}: {
  icon: any; label: string; value: string;
  onChange: (v: string) => void; placeholder: string; invalid?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, invalid && { borderColor: Colors.danger }]}>
        <Ionicons name={icon} size={20} color={Colors.muted} style={{ marginRight: 12 }} />
        <TextInput
          value={value}
          onChangeText={v => onChange(v.replace(/\D/g, ''))}
          placeholder={placeholder}
          placeholderTextColor={Colors.muted}
          keyboardType="number-pad"
          style={styles.input}
        />
      </View>
    </View>
  );
}

// ── Schermata principale ──────────────────────────────────────────────────────
export default function AssegnaBonusScreen() {
  const { token } = useAuth();

  const [soglia, setSoglia]             = useState('');
  const [punti, setPunti]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [result, setResult]             = useState<{
    premiati: number[]; punti_assegnati: number; soglia_corse: number;
  } | null>(null);

  // Carica configurazione attiva all'apertura
  useFocusEffect(useCallback(() => {
    if (!token) return;
    setLoadingConfig(true);
    setResult(null);
    setError(null);
    operatoreApi.getBonusConfig(token)
      .then(cfg => {
        setSoglia(String(cfg.soglia_corse));
        setPunti(String(cfg.punti_bonus));
      })
      .catch(() => { /* usa campi vuoti se config non disponibile */ })
      .finally(() => setLoadingConfig(false));
  }, [token]));

  const handleAttiva = async () => {
    const err = validate(soglia, punti);
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await operatoreApi.assegnaBonus(
        token!, parseInt(soglia, 10), parseInt(punti, 10),
      );
      setResult(res);
    } catch (e: any) {
      setError(e?.message ?? "Errore durante l'attivazione della regola bonus.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
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
      >
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient colors={Gradients.primary} style={styles.headerIcon}>
            <Ionicons name="gift-outline" size={28} color={Colors.text} />
          </LinearGradient>
          <Text style={styles.title}>Assegna Bonus</Text>
          <Text style={styles.subtitle}>
            Configura la regola di premiazione automatica per gli utenti virtuosi
          </Text>
        </View>

        {/* Info */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
            <Text style={styles.infoText}>
              Il sistema assegnerà i punti a tutti gli utenti attivi che hanno completato
              almeno il numero di corse indicato. Ogni utente idoneo riceverà anche
              una notifica in-app.
            </Text>
          </View>
        </GlassCard>

        {/* Form */}
        <GlassCard>
          <Text style={styles.sectionTitle}>Parametri della regola</Text>
          {loadingConfig ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              <NumericField
                icon="checkmark-done-outline"
                label="Corse completate richieste"
                value={soglia}
                onChange={v => { setSoglia(v); setError(null); setResult(null); }}
                placeholder="Es. 5"
                invalid={!!error && (parseInt(soglia, 10) <= 0 || !soglia.trim())}
              />
              <NumericField
                icon="star-outline"
                label="Punti bonus da assegnare"
                value={punti}
                onChange={v => { setPunti(v); setError(null); setResult(null); }}
                placeholder="Es. 50"
                invalid={!!error && (parseInt(punti, 10) <= 0 || !punti.trim())}
              />
            </View>
          )}
        </GlassCard>

        {/* Anteprima regola */}
        {soglia && punti && parseInt(soglia, 10) > 0 && parseInt(punti, 10) > 0 && (
          <GlassCard style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Ionicons name="flash-outline" size={16} color={Colors.accent} />
              <Text style={styles.previewText}>
                Gli utenti con almeno{' '}
                <Text style={{ color: Colors.text, fontWeight: '700' }}>{soglia} corse</Text>
                {' '}riceveranno{' '}
                <Text style={{ color: Colors.accent, fontWeight: '700' }}>{punti} punti</Text>
              </Text>
            </View>
          </GlassCard>
        )}

        {/* Errore */}
        {error && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Risultato */}
        {result && (
          <GlassCard style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
              <Text style={styles.resultTitle}>Regola attivata!</Text>
            </View>
            <View style={styles.resultStats}>
              <View style={styles.resultStat}>
                <Text style={[styles.resultStatNum, { color: Colors.accent }]}>
                  {result.premiati.length}
                </Text>
                <Text style={styles.resultStatLabel}>utenti premiati</Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultStat}>
                <Text style={[styles.resultStatNum, { color: '#F59E0B' }]}>
                  {result.punti_assegnati}
                </Text>
                <Text style={styles.resultStatLabel}>punti / utente</Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultStat}>
                <Text style={[styles.resultStatNum, { color: Colors.text }]}>
                  {result.soglia_corse}
                </Text>
                <Text style={styles.resultStatLabel}>corse soglia</Text>
              </View>
            </View>
            {result.premiati.length === 0 && (
              <Text style={styles.noPremiatiText}>
                Nessun utente ha ancora raggiunto la soglia impostata.
              </Text>
            )}
          </GlassCard>
        )}

        {/* CTA */}
        <GradientButton
          title={result ? 'Riapplica regola' : 'Attiva regola bonus'}
          onPress={handleAttiva}
          loading={loading}
          full
          icon={<Ionicons name="gift-outline" size={18} color={Colors.text} />}
          style={{ marginTop: 4 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.bg },
  backBtn:         { position: 'absolute', top: 52, left: 16, zIndex: 10, backgroundColor: 'rgba(13,13,26,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },
  scroll:          { paddingTop: 112, paddingHorizontal: 16, paddingBottom: 40, gap: 14 },

  header:          { alignItems: 'center', gap: 8, marginBottom: 6 },
  headerIcon:      { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title:           { color: Colors.text, fontSize: 22, fontWeight: '800' },
  subtitle:        { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },

  infoCard:        { marginBottom: 0 },
  infoRow:         { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText:        { color: Colors.muted, fontSize: 13, flex: 1, lineHeight: 19 },

  sectionTitle:    { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 14 },
  fieldLabel:      { color: Colors.muted, fontSize: 13, paddingLeft: 2 },
  inputWrap:       { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, height: 54 },
  input:           { flex: 1, color: Colors.text, fontSize: 18, fontWeight: '600' },

  previewCard:     { marginBottom: 0 },
  previewRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewText:     { color: Colors.muted, fontSize: 13, flex: 1, lineHeight: 19 },

  errorRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText:       { color: Colors.danger, fontSize: 13, flex: 1 },

  resultCard:      { marginBottom: 0 },
  resultHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  resultTitle:     { color: Colors.text, fontSize: 17, fontWeight: '700' },
  resultStats:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  resultStat:      { alignItems: 'center', gap: 4 },
  resultStatNum:   { fontSize: 26, fontWeight: '800' },
  resultStatLabel: { color: Colors.muted, fontSize: 11 },
  resultDivider:   { width: 1, height: 36, backgroundColor: Colors.border },
  noPremiatiText:  { color: Colors.muted, fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 18 },

  center:          { alignItems: 'center', paddingVertical: 16 },
});
