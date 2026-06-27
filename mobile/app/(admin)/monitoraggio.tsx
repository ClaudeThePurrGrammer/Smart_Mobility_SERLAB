import React, { useState } from 'react';
import {
  Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import GlassCard from '@/components/ui/GlassCard';
import GradientButton from '@/components/ui/GradientButton';
import { amministrazioneApi } from '@/lib/api/endpoints';
import type { ApiMonitoraggioFrequenza } from '@/lib/api/types';

type VehicleType = 'scooter' | 'ebike' | 'car';
type PeriodMode  = 'week' | 'month' | 'year' | 'custom';

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: string }[] = [
  { type: 'scooter', label: 'Monopattino Elettrico', icon: 'speedometer-outline' },
  { type: 'ebike',   label: 'Bici Elettrica',        icon: 'bicycle-outline' },
  { type: 'car',     label: 'Auto Elettrica',         icon: 'car-outline' },
];

const PERIOD_OPTIONS: { mode: PeriodMode; label: string; icon: string }[] = [
  { mode: 'week',   label: 'Ultima settimana', icon: 'today-outline' },
  { mode: 'month',  label: 'Ultimo mese',      icon: 'calendar-outline' },
  { mode: 'year',   label: 'Ultimo anno',      icon: 'calendar-number-outline' },
  { mode: 'custom', label: 'Personalizzato',   icon: 'options-outline' },
];

function toISODate(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDisplay(d: Date): string {
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function computeRange(mode: PeriodMode, customFrom: Date, customTo: Date): { from: string; to: string } {
  const today = new Date();
  if (mode === 'custom') return { from: toISODate(customFrom), to: toISODate(customTo) };
  const from = new Date(today);
  if (mode === 'week')  from.setDate(from.getDate() - 7);
  if (mode === 'month') from.setMonth(from.getMonth() - 1);
  if (mode === 'year')  from.setFullYear(from.getFullYear() - 1);
  return { from: toISODate(from), to: toISODate(today) };
}

export default function MonitoraggioScreen() {
  const { token } = useAuth();

  const [vehicleType, setVehicleType] = useState<VehicleType>('scooter');
  const [periodMode, setPeriodMode]   = useState<PeriodMode>('month');

  const today        = new Date();
  const defaultFrom  = new Date(today);
  defaultFrom.setMonth(defaultFrom.getMonth() - 1);
  const [customFrom, setCustomFrom] = useState<Date>(defaultFrom);
  const [customTo,   setCustomTo]   = useState<Date>(today);

  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);

  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<ApiMonitoraggioFrequenza | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const resetResult = (fn: () => void) => { fn(); setResult(null); setError(null); };

  const handlePickerChange = (_event: any, date?: Date) => {
    if (Platform.OS === 'android') setPickerTarget(null);
    if (!date) return;
    if (pickerTarget === 'from') { setCustomFrom(date); setResult(null); setError(null); }
    if (pickerTarget === 'to')   { setCustomTo(date);   setResult(null); setError(null); }
  };

  const handleAnalizza = async () => {
    if (periodMode === 'custom' && customFrom > customTo) {
      setError('La data di inizio deve essere precedente alla data di fine');
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const range = computeRange(periodMode, customFrom, customTo);
      const res = await amministrazioneApi.monitoraggioFrequenza(
        token!,
        vehicleType,
        range.from,
        range.to,
      );
      setResult(res);
    } catch (e: any) {
      setError(e?.message ?? 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  const isAnalizzaDisabled = periodMode === 'custom' && customFrom > customTo;

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
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="pulse-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Monitoraggio</Text>
          <Text style={styles.subtitle}>Frequenza di utilizzo per tipologia di mezzo</Text>
        </View>

        {/* Tipologia mezzo */}
        <Text style={styles.sectionLabel}>TIPOLOGIA MEZZO</Text>
        <View style={styles.chipGrid}>
          {VEHICLE_OPTIONS.map(opt => {
            const active = vehicleType === opt.type;
            return (
              <TouchableOpacity
                key={opt.type}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => resetResult(() => setVehicleType(opt.type))}
                activeOpacity={0.75}
              >
                <Ionicons name={opt.icon as any} size={20} color={active ? Colors.text : Colors.muted} />
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Periodo */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>PERIODO</Text>
        <View style={styles.chipGrid}>
          {PERIOD_OPTIONS.map(opt => {
            const active = periodMode === opt.mode;
            return (
              <TouchableOpacity
                key={opt.mode}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => resetResult(() => setPeriodMode(opt.mode))}
                activeOpacity={0.75}
              >
                <Ionicons name={opt.icon as any} size={18} color={active ? Colors.text : Colors.muted} />
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selettori data personalizzata */}
        {periodMode === 'custom' && (
          <View style={styles.customDateSection}>
            <View style={styles.dateRow}>
              {/* Dal */}
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>Data inizio</Text>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setPickerTarget('from')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={17} color={Colors.accent} />
                  <Text style={styles.dateBtnText}>{formatDisplay(customFrom)}</Text>
                </TouchableOpacity>
              </View>

              <Ionicons name="arrow-forward" size={16} color={Colors.muted} style={styles.dateArrow} />

              {/* Al */}
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>Data fine</Text>
                <TouchableOpacity
                  style={[styles.dateBtn, customFrom > customTo && styles.dateBtnError]}
                  onPress={() => setPickerTarget('to')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={17} color={customFrom > customTo ? Colors.danger : Colors.accent} />
                  <Text style={[styles.dateBtnText, customFrom > customTo && { color: Colors.danger }]}>
                    {formatDisplay(customTo)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {customFrom > customTo && (
              <View style={styles.dateErrorHint}>
                <Ionicons name="warning-outline" size={13} color={Colors.danger} />
                <Text style={styles.dateErrorHintText}>
                  La data di inizio deve essere precedente alla data di fine
                </Text>
              </View>
            )}

            {/* iOS: picker inline */}
            {Platform.OS === 'ios' && pickerTarget !== null && (
              <View style={styles.iosPickerContainer}>
                <DateTimePicker
                  value={pickerTarget === 'from' ? customFrom : customTo}
                  mode="date"
                  display="spinner"
                  onChange={handlePickerChange}
                  maximumDate={new Date()}
                  minimumDate={pickerTarget === 'to' ? customFrom : undefined}
                  themeVariant="dark"
                />
                <TouchableOpacity
                  style={styles.iosConfirmBtn}
                  onPress={() => setPickerTarget(null)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.iosConfirmBtnText}>Conferma</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Android: dialog nativo (si apre automaticamente al render) */}
            {Platform.OS === 'android' && pickerTarget !== null && (
              <DateTimePicker
                value={pickerTarget === 'from' ? customFrom : customTo}
                mode="date"
                display="default"
                onChange={handlePickerChange}
                maximumDate={new Date()}
                minimumDate={pickerTarget === 'to' ? customFrom : undefined}
              />
            )}
          </View>
        )}

        {/* Errore generico */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* CTA */}
        <GradientButton
          title="Analizza"
          onPress={handleAnalizza}
          loading={loading}
          full
          style={{ marginTop: 28, opacity: isAnalizzaDisabled ? 0.45 : 1 }}
          icon={<Ionicons name="search-outline" size={18} color={Colors.text} />}
        />

        {/* Risultato */}
        {result && (
          <GlassCard style={{ marginTop: 28 }} padding={24}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
              <Text style={styles.resultHeaderText}>Risultato analisi</Text>
            </View>
            <Text style={styles.resultNumber}>{result.totale_corse}</Text>
            <Text style={styles.resultSub}>
              {result.totale_corse === 1 ? 'corsa completata' : 'corse completate'}
            </Text>
            <View style={styles.resultChips}>
              <View style={styles.resultChip}>
                <Ionicons
                  name={(VEHICLE_OPTIONS.find(v => v.type === result.tipo)?.icon ?? 'help-circle-outline') as any}
                  size={14}
                  color={Colors.accent}
                />
                <Text style={styles.resultChipText}>
                  {VEHICLE_OPTIONS.find(v => v.type === result.tipo)?.label ?? result.tipo}
                </Text>
              </View>
              {(result.da || result.a) && (
                <View style={styles.resultChip}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
                  <Text style={styles.resultChipText}>{result.da ?? '—'} → {result.a ?? '—'}</Text>
                </View>
              )}
            </View>
          </GlassCard>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.bg },
  backBtn:            { position: 'absolute', top: 52, left: 16, zIndex: 10, backgroundColor: 'rgba(13,13,26,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },
  scroll:             { paddingTop: 112, paddingHorizontal: 20, paddingBottom: 40 },

  header:             { alignItems: 'center', gap: 8, marginBottom: 32 },
  headerIcon:         { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  title:              { color: Colors.text, fontSize: 22, fontWeight: '800' },
  subtitle:           { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  sectionLabel:       { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },

  chipGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:               { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, flex: 1, minWidth: '44%' },
  chipActive:         { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.2)' },
  chipLabel:          { color: Colors.muted, fontSize: 13, fontWeight: '500', flex: 1 },
  chipLabelActive:    { color: Colors.text, fontWeight: '700' },

  customDateSection:  { marginTop: 16, gap: 10 },
  dateRow:            { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  dateField:          { flex: 1, gap: 6 },
  dateFieldLabel:     { color: Colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  dateBtn:            { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  dateBtnError:       { borderColor: Colors.danger, backgroundColor: 'rgba(239,68,68,0.06)' },
  dateBtnText:        { color: Colors.text, fontSize: 13, fontWeight: '500', flex: 1 },
  dateArrow:          { marginBottom: 13 },

  dateErrorHint:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateErrorHintText:  { color: Colors.danger, fontSize: 12, flex: 1 },

  iosPickerContainer: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  iosConfirmBtn:      { backgroundColor: Colors.primary, paddingVertical: 13, alignItems: 'center' },
  iosConfirmBtnText:  { color: Colors.text, fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },

  errorBox:           { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: Colors.danger, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 16 },
  errorText:          { color: Colors.danger, fontSize: 13, flex: 1 },

  resultHeader:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  resultHeaderText:   { color: Colors.success, fontSize: 14, fontWeight: '600' },
  resultNumber:       { color: Colors.text, fontSize: 56, fontWeight: '900', textAlign: 'center' },
  resultSub:          { color: Colors.muted, fontSize: 15, textAlign: 'center', marginTop: 2, marginBottom: 20 },
  resultChips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  resultChip:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  resultChipText:     { color: Colors.accent, fontSize: 12, fontWeight: '600' },
});
