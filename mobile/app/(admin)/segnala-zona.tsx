import React, { useState } from 'react';
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import GlassCard from '@/components/ui/GlassCard';
import GradientButton from '@/components/ui/GradientButton';
import GravitaSelector, { type Gravita } from '@/components/ui/GravitaSelector';
import { amministrazioneApi } from '@/lib/api/endpoints';

function toISODate(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDisplay(d: Date): string {
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

type PickerTarget = 'dal' | 'al' | null;

export default function SegnalaZonaScreen() {
  const { token } = useAuth();

  const [zona,        setZona]        = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [gravita,     setGravita]     = useState<Gravita>('MEDIA');

  const today        = new Date();
  const defaultFrom  = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() + 1);
  const defaultTo    = new Date(today);
  defaultTo.setDate(defaultTo.getDate() + 30);

  const [validaDal, setValidaDal] = useState<Date>(defaultFrom);
  const [validaAl,  setValidaAl]  = useState<Date>(defaultTo);

  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const dateError = validaDal > validaAl;

  const handlePickerChange = (_event: any, date?: Date) => {
    if (Platform.OS === 'android') setPickerTarget(null);
    if (!date) return;
    if (pickerTarget === 'dal') setValidaDal(date);
    if (pickerTarget === 'al')  setValidaAl(date);
    setError(null);
  };

  const handleInvia = async () => {
    const trimmedZona = zona.trim();
    if (trimmedZona.length < 3) {
      setError('Inserisci un nome di zona di almeno 3 caratteri');
      return;
    }
    if (dateError) {
      setError('La data di fine validità deve essere uguale o successiva alla data di inizio');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await amministrazioneApi.segnalaZona(token!, {
        zona: trimmedZona,
        descrizione: descrizione.trim(),
        valida_dal: toISODate(validaDal),
        valida_al:  toISODate(validaAl),
        gravita,
      });
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  const handleNuova = () => {
    setZona('');
    setDescrizione('');
    setGravita('MEDIA');
    setValidaDal(defaultFrom);
    setValidaAl(defaultTo);
    setSuccess(false);
    setError(null);
  };

  const canSubmit = zona.trim().length >= 3 && !dateError;

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
            <Ionicons name="location-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Segnala Zona</Text>
          <Text style={styles.subtitle}>
            Segnala un'area urbana che richiede manutenzione o attenzione
          </Text>
        </View>

        {!success ? (
          <>
            {/* Campo zona */}
            <Text style={styles.sectionLabel}>ZONA / INDIRIZZO</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="search-outline" size={18} color={Colors.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="es. Via Roma 12, Piazza della Repubblica…"
                placeholderTextColor={Colors.muted}
                value={zona}
                onChangeText={t => { setZona(t); setError(null); setSuccess(false); }}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
            <Text style={styles.hint}>
              La posizione GPS sarà determinata automaticamente tramite geocoding.
            </Text>

            {/* Campo descrizione */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>DESCRIZIONE (opzionale)</Text>
            <View style={[styles.inputWrapper, styles.inputWrapperMulti]}>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Descrivi il problema o la necessità di manutenzione…"
                placeholderTextColor={Colors.muted}
                value={descrizione}
                onChangeText={setDescrizione}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                returnKeyType="default"
              />
            </View>

            {/* Gravità */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>GRAVITÀ *</Text>
            <GravitaSelector value={gravita} onChange={setGravita} />

            {/* Periodo di validità */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>PERIODO DI VALIDITÀ</Text>
            <View style={styles.dateRow}>
              {/* Valida dal */}
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>Data inizio</Text>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setPickerTarget('dal')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={17} color={Colors.accent} />
                  <Text style={styles.dateBtnText}>{formatDisplay(validaDal)}</Text>
                </TouchableOpacity>
              </View>

              <Ionicons name="arrow-forward" size={16} color={Colors.muted} style={styles.dateArrow} />

              {/* Valida al */}
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>Data fine</Text>
                <TouchableOpacity
                  style={[styles.dateBtn, dateError && styles.dateBtnError]}
                  onPress={() => setPickerTarget('al')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={17}
                    color={dateError ? Colors.danger : Colors.accent}
                  />
                  <Text style={[styles.dateBtnText, dateError && { color: Colors.danger }]}>
                    {formatDisplay(validaAl)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {dateError && (
              <View style={styles.dateErrorHint}>
                <Ionicons name="warning-outline" size={13} color={Colors.danger} />
                <Text style={styles.dateErrorHintText}>
                  La data di fine deve essere uguale o successiva alla data di inizio
                </Text>
              </View>
            )}

            {/* iOS: picker inline */}
            {Platform.OS === 'ios' && pickerTarget !== null && (
              <View style={styles.iosPickerContainer}>
                <DateTimePicker
                  value={pickerTarget === 'dal' ? validaDal : validaAl}
                  mode="date"
                  display="spinner"
                  onChange={handlePickerChange}
                  minimumDate={pickerTarget === 'al' ? validaDal : undefined}
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

            {/* Android: dialog nativo */}
            {Platform.OS === 'android' && pickerTarget !== null && (
              <DateTimePicker
                value={pickerTarget === 'dal' ? validaDal : validaAl}
                mode="date"
                display="default"
                onChange={handlePickerChange}
                minimumDate={pickerTarget === 'al' ? validaDal : undefined}
              />
            )}

            {/* Errore */}
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={16} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* CTA */}
            <GradientButton
              title={loading ? '' : 'Invia segnalazione'}
              onPress={handleInvia}
              loading={loading}
              full
              style={{ marginTop: 32, opacity: canSubmit ? 1 : 0.45 }}
              icon={
                loading
                  ? <ActivityIndicator size="small" color={Colors.text} />
                  : <Ionicons name="send-outline" size={18} color={Colors.text} />
              }
            />
          </>
        ) : (
          /* Stato successo */
          <GlassCard style={{ marginTop: 8 }} padding={32}>
            <View style={styles.successContent}>
              <View style={styles.successIconWrapper}>
                <Ionicons name="checkmark-circle" size={52} color={Colors.success} />
              </View>
              <Text style={styles.successTitle}>Segnalazione inviata</Text>
              <Text style={styles.successBody}>
                La zona{zona.trim() ? ` "${zona.trim()}"` : ''} è stata segnalata correttamente.
                {'\n'}Valida dal {formatDisplay(validaDal)} al {formatDisplay(validaAl)}.
              </Text>

              <GradientButton
                title="Nuova segnalazione"
                onPress={handleNuova}
                full
                style={{ marginTop: 24 }}
                icon={<Ionicons name="add-circle-outline" size={18} color={Colors.text} />}
              />
              <TouchableOpacity style={styles.backToDashBtn} onPress={() => router.back()} activeOpacity={0.75}>
                <Text style={styles.backToDashText}>Torna alla dashboard</Text>
              </TouchableOpacity>
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

  inputWrapper:       { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
  inputWrapperMulti:  { alignItems: 'flex-start', paddingVertical: 12 },
  inputIcon:          { marginRight: 10 },
  input:              { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 10 },
  inputMulti:         { minHeight: 72, paddingVertical: 0 },
  hint:               { color: Colors.muted, fontSize: 11, marginTop: 6, lineHeight: 16 },

  dateRow:            { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  dateField:          { flex: 1, gap: 6 },
  dateFieldLabel:     { color: Colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  dateBtn:            { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  dateBtnError:       { borderColor: Colors.danger, backgroundColor: 'rgba(239,68,68,0.06)' },
  dateBtnText:        { color: Colors.text, fontSize: 13, fontWeight: '500', flex: 1 },
  dateArrow:          { marginBottom: 13 },
  dateErrorHint:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dateErrorHintText:  { color: Colors.danger, fontSize: 12, flex: 1 },

  iosPickerContainer: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  iosConfirmBtn:      { backgroundColor: Colors.primary, paddingVertical: 13, alignItems: 'center' },
  iosConfirmBtnText:  { color: Colors.text, fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },

  errorBox:           { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: Colors.danger, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 16 },
  errorText:          { color: Colors.danger, fontSize: 13, flex: 1 },

  successContent:     { alignItems: 'center', gap: 12 },
  successIconWrapper: { width: 88, height: 88, borderRadius: 24, backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', alignItems: 'center', justifyContent: 'center' },
  successTitle:       { color: Colors.text, fontSize: 20, fontWeight: '800', marginTop: 8 },
  successBody:        { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  backToDashBtn:      { marginTop: 12, paddingVertical: 8 },
  backToDashText:     { color: Colors.muted, fontSize: 14, fontWeight: '500' },
});
