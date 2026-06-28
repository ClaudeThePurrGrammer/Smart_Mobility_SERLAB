import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import GlassCard from '@/components/ui/GlassCard';
import GradientButton from '@/components/ui/GradientButton';
import { amministrazioneApi, geoApi } from '@/lib/api/endpoints';
import type { ApiGeocodeResult } from '@/lib/api/types';

// Stile mappa scuro identico a quello dell'app utente.
const DARK_MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#0d0d1a' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0d0d1a' }] },
  { featureType: 'road',                elementType: 'geometry',        stylers: [{ color: '#1e1e3a' }] },
  { featureType: 'water',               elementType: 'geometry',        stylers: [{ color: '#0a0a18' }] },
  { featureType: 'poi',                 elementType: 'geometry',        stylers: [{ color: '#13132a' }] },
  { featureType: 'landscape',           elementType: 'geometry',        stylers: [{ color: '#0f0f24' }] },
];

// ─── Costanti dominio ─────────────────────────────────────────────────────────

type TipoRestrizione = 'NO_GO' | 'NO_PARKING' | 'ZTL' | 'PEDONALE' | 'LIMITE_VELOCITA';
type VehicleType     = 'scooter' | 'ebike' | 'car';
type PickerTarget    = 'dal' | 'al' | null;

const TIPO_OPTIONS: { value: TipoRestrizione; label: string; icon: string }[] = [
  { value: 'NO_GO',          label: 'Zona Vietata',    icon: 'ban-outline' },
  { value: 'NO_PARKING',     label: 'Divieto Sosta',   icon: 'car-outline' },
  { value: 'ZTL',            label: 'ZTL',             icon: 'key-outline' },
  { value: 'PEDONALE',       label: 'Zona Pedonale',   icon: 'walk-outline' },
  { value: 'LIMITE_VELOCITA', label: 'Limite Velocità', icon: 'speedometer-outline' },
];

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: string }[] = [
  { type: 'scooter', label: 'Monopattino Elettrico', icon: 'speedometer-outline' },
  { type: 'ebike',   label: 'Bici Elettrica',        icon: 'bicycle-outline' },
  { type: 'car',     label: 'Auto Elettrica',         icon: 'car-outline' },
];

// ─── Helper date ─────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDisplay(d: Date): string {
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function InserisciAreaRestrizioneScreen() {
  const { token } = useAuth();

  // Campi form
  const [indirizzo,    setIndirizzo]    = useState('');
  const [raggio,       setRaggio]       = useState('100');
  const [tipo,         setTipo]         = useState<TipoRestrizione>('NO_GO');
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [descrizione,  setDescrizione]  = useState('');

  // Ricerca zona (stesso meccanismo/sorgente dati della destinazione utente).
  const [coords,      setCoords]      = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<ApiGeocodeResult[]>([]);
  const [searching,   setSearching]   = useState(false);

  // Autocompletamento in tempo reale via geocoding (debounce), come lato utente.
  // Non cerca se è già stato selezionato un risultato (coords valorizzate).
  useEffect(() => {
    if (coords || indirizzo.trim().length < 2) { setSuggestions([]); return; }
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await geoApi.geocode(indirizzo.trim());
        if (active) setSuggestions(res);
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 450);
    return () => { active = false; clearTimeout(t); };
  }, [indirizzo, coords]);

  const selezionaZona = (r: ApiGeocodeResult) => {
    const short = r.label.split(',').slice(0, 2).join(',');
    setIndirizzo(short);
    setCoords({ lat: r.lat, lng: r.lng });
    setSuggestions([]);
    setError(null);
  };

  // Date
  const today       = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() + 1);
  const defaultTo   = new Date(today);
  defaultTo.setDate(defaultTo.getDate() + 30);

  const [validaDal, setValidaDal] = useState<Date>(defaultFrom);
  const [validaAl,  setValidaAl]  = useState<Date>(defaultTo);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  // Stato UI
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const dateError   = validaDal > validaAl;
  const raggioParsed = parseInt(raggio, 10);
  const raggioError = isNaN(raggioParsed) || raggioParsed < 1;

  // Toggle multi-select tipologie mezzo
  const toggleVehicle = (vt: VehicleType) => {
    setVehicleTypes(prev =>
      prev.includes(vt) ? prev.filter(v => v !== vt) : [...prev, vt],
    );
    setError(null);
  };

  const handlePickerChange = (_event: any, date?: Date) => {
    if (Platform.OS === 'android') setPickerTarget(null);
    if (!date) return;
    if (pickerTarget === 'dal') setValidaDal(date);
    if (pickerTarget === 'al')  setValidaAl(date);
    setError(null);
  };

  // Validazione frontend
  const validate = (): string | null => {
    if (!coords)                       return 'Cerca la zona e seleziona un risultato dai suggerimenti';
    if (raggioError)                   return 'Il raggio deve essere un numero intero positivo (≥ 1 m)';
    if (vehicleTypes.length === 0)     return 'Seleziona almeno una tipologia di mezzo';
    if (dateError)                     return 'La data di fine deve essere uguale o successiva alla data di inizio';
    return null;
  };

  const handleConfigura = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);
    try {
      await amministrazioneApi.inserisciAreaRestrizione(token!, {
        indirizzo: indirizzo.trim(),
        radius_m:  raggioParsed,
        tipo,
        vehicle_types: vehicleTypes,
        note:      descrizione.trim(),
        valida_dal: toISODate(validaDal),
        valida_al:  toISODate(validaAl),
        lat: coords!.lat,
        lng: coords!.lng,
      });
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  const handleNuova = () => {
    setIndirizzo(''); setRaggio('100'); setTipo('NO_GO');
    setVehicleTypes([]); setDescrizione('');
    setCoords(null); setSuggestions([]);
    setValidaDal(defaultFrom); setValidaAl(defaultTo);
    setSuccess(false); setError(null);
  };

  const canSubmit = !!coords && !raggioError && vehicleTypes.length > 0 && !dateError;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              <Ionicons name="shield-outline" size={28} color={Colors.accent} />
            </View>
            <Text style={styles.title}>Inserisci Area Restrizione</Text>
            <Text style={styles.subtitle}>Configura una nuova zona con restrizioni al transito</Text>
          </View>

          {!success ? (
            <>
              {/* Zona / Indirizzo — ricerca con autocompletamento (come lato utente) */}
              <Text style={styles.sectionLabel}>CERCA LA ZONA</Text>
              <View style={[styles.inputWrapper, coords && { borderColor: Colors.primary }]}>
                <Ionicons name="search-outline" size={18} color={coords ? Colors.accent : Colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Cerca un luogo: via, piazza, quartiere…"
                  placeholderTextColor={Colors.muted}
                  value={indirizzo}
                  onChangeText={t => { setIndirizzo(t); setCoords(null); setError(null); }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {searching && <ActivityIndicator size="small" color={Colors.accent} />}
                {coords && !searching && (
                  <TouchableOpacity onPress={() => { setIndirizzo(''); setCoords(null); }} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={Colors.muted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Suggerimenti in tempo reale */}
              {suggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {suggestions.map((s, i) => {
                    const short = s.label.split(',').slice(0, 2).join(',');
                    return (
                      <TouchableOpacity
                        key={`${s.lat}-${s.lng}-${i}`}
                        style={[styles.suggestRow, i < suggestions.length - 1 && styles.suggestRowBorder]}
                        onPress={() => selezionaZona(s)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="location-outline" size={16} color={Colors.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestLabel} numberOfLines={1}>{short}</Text>
                          <Text style={styles.suggestSub} numberOfLines={1}>{s.label.split(',').slice(2, 4).join(',').trim() || 'Indirizzo'}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Anteprima mappa: posiziona la restrizione (R + circonferenza rossa) */}
              {coords && (
                <View style={styles.mapPreview}>
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={StyleSheet.absoluteFillObject}
                    region={{
                      latitude: coords.lat,
                      longitude: coords.lng,
                      latitudeDelta: Math.max(0.006, (raggioParsed || 100) / 50000),
                      longitudeDelta: Math.max(0.006, (raggioParsed || 100) / 50000),
                    }}
                    customMapStyle={DARK_MAP_STYLE}
                    pointerEvents="none"
                  >
                    <Circle
                      center={{ latitude: coords.lat, longitude: coords.lng }}
                      radius={raggioError ? 100 : raggioParsed}
                      strokeColor="#EF4444"
                      strokeWidth={2}
                      fillColor="rgba(239,68,68,0.18)"
                    />
                    <Marker coordinate={{ latitude: coords.lat, longitude: coords.lng }} anchor={{ x: 0.5, y: 0.5 }}>
                      <View style={styles.rMarker}><Text style={styles.rMarkerText}>R</Text></View>
                    </Marker>
                  </MapView>
                </View>
              )}
              <Text style={styles.hint}>
                {coords
                  ? 'Zona selezionata. Regola il raggio per definire i confini dell\'area.'
                  : 'Digita per cercare e seleziona un risultato: la mappa si centra sulla zona.'}
              </Text>

              {/* Raggio */}
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>RAGGIO (metri)</Text>
              <View style={[styles.inputWrapper, raggioError && raggio !== '' && styles.inputWrapperError]}>
                <Ionicons name="radio-button-on-outline" size={18} color={raggioError && raggio !== '' ? Colors.danger : Colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, raggioError && raggio !== '' && { color: Colors.danger }]}
                  placeholder="100"
                  placeholderTextColor={Colors.muted}
                  value={raggio}
                  onChangeText={t => { setRaggio(t.replace(/[^0-9]/g, '')); setError(null); }}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
                <Text style={styles.inputSuffix}>m</Text>
              </View>

              {/* Tipo di restrizione */}
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>TIPO DI RESTRIZIONE</Text>
              <View style={styles.chipGrid}>
                {TIPO_OPTIONS.map(opt => {
                  const active = tipo === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => { setTipo(opt.value); setError(null); }}
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

              {/* Tipologie di mezzo — multi-select */}
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>TIPOLOGIE DI MEZZO COINVOLTE</Text>
              <Text style={styles.hint}>Seleziona una o più tipologie. Lasciare vuoto = vale per tutti.</Text>
              <View style={[styles.chipGrid, { marginTop: 8 }]}>
                {VEHICLE_OPTIONS.map(opt => {
                  const selected = vehicleTypes.includes(opt.type);
                  return (
                    <TouchableOpacity
                      key={opt.type}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => toggleVehicle(opt.type)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={opt.icon as any} size={20} color={selected ? Colors.text : Colors.muted} />
                      <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>{opt.label}</Text>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={14} color={Colors.accent} style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Descrizione */}
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>DESCRIZIONE (opzionale)</Text>
              <View style={[styles.inputWrapper, styles.inputWrapperMulti]}>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  placeholder="Note sull'area, motivazione della restrizione…"
                  placeholderTextColor={Colors.muted}
                  value={descrizione}
                  onChangeText={setDescrizione}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Periodo di validità */}
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>PERIODO DI VALIDITÀ</Text>
              <View style={styles.dateRow}>
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

              {/* iOS picker inline */}
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

              {/* Android dialog nativo */}
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
                title="Configura area"
                onPress={handleConfigura}
                loading={loading}
                full
                style={{ marginTop: 32, opacity: canSubmit ? 1 : 0.45 }}
                icon={<Ionicons name="shield-checkmark-outline" size={18} color={Colors.text} />}
              />
            </>
          ) : (
            /* Stato successo */
            <GlassCard style={{ marginTop: 8 }} padding={32}>
              <View style={styles.successContent}>
                <View style={styles.successIconWrapper}>
                  <Ionicons name="checkmark-circle" size={52} color={Colors.success} />
                </View>
                <Text style={styles.successTitle}>Area configurata</Text>
                <Text style={styles.successBody}>
                  L'area di restrizione{indirizzo.trim() ? ` "${indirizzo.trim()}"` : ''} è stata
                  salvata correttamente.{'\n'}
                  Tipo: {TIPO_OPTIONS.find(t => t.value === tipo)?.label ?? tipo}.{'\n'}
                  Valida dal {formatDisplay(validaDal)} al {formatDisplay(validaAl)}.
                </Text>

                <GradientButton
                  title="Inserisci altra area"
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: Colors.bg },
  backBtn:             { position: 'absolute', top: 52, left: 16, zIndex: 10, backgroundColor: 'rgba(13,13,26,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },
  scroll:              { paddingTop: 112, paddingHorizontal: 20, paddingBottom: 40 },

  header:              { alignItems: 'center', gap: 8, marginBottom: 32 },
  headerIcon:          { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  title:               { color: Colors.text, fontSize: 22, fontWeight: '800' },
  subtitle:            { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  sectionLabel:        { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  hint:                { color: Colors.muted, fontSize: 11, marginTop: 6, lineHeight: 16 },

  inputWrapper:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
  inputWrapperError:   { borderColor: Colors.danger, backgroundColor: 'rgba(239,68,68,0.06)' },
  inputWrapperMulti:   { alignItems: 'flex-start', paddingVertical: 12 },
  inputIcon:           { marginRight: 10 },
  inputSuffix:         { color: Colors.muted, fontSize: 13, marginLeft: 4 },
  input:               { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 10 },
  inputMulti:          { minHeight: 72, paddingVertical: 0 },

  suggestions:         { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, marginTop: 8, overflow: 'hidden' },
  suggestRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  suggestRowBorder:    { borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestLabel:        { color: Colors.text, fontSize: 14, fontWeight: '600' },
  suggestSub:          { color: Colors.muted, fontSize: 11, marginTop: 2 },

  mapPreview:          { height: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, marginTop: 12 },
  rMarker:             { width: 26, height: 26, borderRadius: 6, backgroundColor: 'rgba(13,13,26,0.95)', borderWidth: 2, borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  rMarkerText:         { color: '#EF4444', fontWeight: '900', fontSize: 14 },

  chipGrid:            { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:                { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, flex: 1, minWidth: '44%' },
  chipActive:          { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.2)' },
  chipLabel:           { color: Colors.muted, fontSize: 13, fontWeight: '500', flex: 1 },
  chipLabelActive:     { color: Colors.text, fontWeight: '700' },

  dateRow:             { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  dateField:           { flex: 1, gap: 6 },
  dateFieldLabel:      { color: Colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  dateBtn:             { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  dateBtnError:        { borderColor: Colors.danger, backgroundColor: 'rgba(239,68,68,0.06)' },
  dateBtnText:         { color: Colors.text, fontSize: 13, fontWeight: '500', flex: 1 },
  dateArrow:           { marginBottom: 13 },
  dateErrorHint:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dateErrorHintText:   { color: Colors.danger, fontSize: 12, flex: 1 },

  iosPickerContainer:  { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  iosConfirmBtn:       { backgroundColor: Colors.primary, paddingVertical: 13, alignItems: 'center' },
  iosConfirmBtnText:   { color: Colors.text, fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },

  errorBox:            { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: Colors.danger, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 16 },
  errorText:           { color: Colors.danger, fontSize: 13, flex: 1 },

  successContent:      { alignItems: 'center', gap: 12 },
  successIconWrapper:  { width: 88, height: 88, borderRadius: 24, backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', alignItems: 'center', justifyContent: 'center' },
  successTitle:        { color: Colors.text, fontSize: 20, fontWeight: '800', marginTop: 8 },
  successBody:         { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  backToDashBtn:       { marginTop: 12, paddingVertical: 8 },
  backToDashText:      { color: Colors.muted, fontSize: 14, fontWeight: '500' },
});
