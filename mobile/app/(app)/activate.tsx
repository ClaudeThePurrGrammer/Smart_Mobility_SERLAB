/**
 * ActivateScreen — pagina di attivazione corsa tramite codice.
 *
 * Funzionalità:
 *  - Inserimento manuale del codice (es. SM-42)
 *  - Griglia visuale dei QR code di test (SM-01 … SM-10)
 *    generati con l'API pubblica qrserver.com (no dipendenze extra)
 *  - Tap su un QR → precompila l'input
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Image, KeyboardAvoidingView, Platform, ActivityIndicator,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { vehiclesApi, ridesApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRideSession } from '@/lib/ride/RideSessionContext';

// Codici di test predefiniti (corrispondono ai veicoli generati dal seed)
const TEST_VEHICLES = Array.from({ length: 20 }, (_, i) => ({
  code: `SM-${String(i + 1).padStart(2, '0')}`,
  id: i + 1,
}));

function qrUrl(code: string): string {
  // API pubblica per generare QR on-the-fly: nessun pacchetto extra necessario.
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(code)}&format=png&margin=8`;
}

export default function ActivateScreen() {
  const params = useLocalSearchParams<{ prefill?: string }>();
  const { token } = useAuth();
  const { startSession } = useRideSession();

  const [code, setCode] = useState(params.prefill ?? '');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async (rawCode?: string) => {
    const input = rawCode ?? code;
    const match = input.match(/\d+/);
    if (!match) { setError('Codice non valido — usa il formato SM-42 o digita solo il numero.'); return; }
    const vid = Number(match[0]);
    if (!token) return;

    setActivating(true);
    setError(null);
    try {
      const v = await vehiclesApi.get(vid);
      if (v.status !== 'available') {
        setError(`Il mezzo ${input.toUpperCase()} non è disponibile al momento.`);
        return;
      }
      const ride = await ridesApi.start(token, {
        vehicle_id: v.id,
        vehicle_type: v.type,
        from_addr: 'Posizione attuale',
      });
      startSession(ride);
      router.replace({
        pathname: '/(app)/active-ride',
        params: { rideId: String(ride.id), vehicleId: String(v.id) },
      });
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      if (msg.includes('409') || msg.toLowerCase().includes('corso')) {
        setError('Hai già una corsa in corso. Termina quella attiva prima di iniziarne una nuova.');
      } else if (msg.includes('404')) {
        setError('Codice non trovato. Controlla il numero sul mezzo.');
      } else {
        setError('Impossibile attivare la corsa. Riprova tra qualche secondo.');
      }
    } finally {
      setActivating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <LinearGradient colors={['#1A0A2E', '#0D0D1A']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attiva corsa</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* Sezione inserimento codice */}
        <View style={styles.inputSection}>
          <View style={styles.inputHeader}>
            <Ionicons name="keypad-outline" size={20} color={Colors.accent} />
            <Text style={styles.inputTitle}>Inserisci il codice del mezzo</Text>
          </View>
          <Text style={styles.inputSub}>
            Trovi il codice (formato SM-XX) stampato sul mezzo o sullo schermo del QR.
          </Text>

          <TextInput
            style={styles.codeInput}
            placeholder="SM-42"
            placeholderTextColor={Colors.muted}
            value={code}
            onChangeText={(t) => { setCode(t.toUpperCase()); setError(null); }}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => handleActivate()}
          />

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.activateBtn, (!code.trim() || activating) && { opacity: 0.45 }]}
            onPress={() => handleActivate()}
            disabled={!code.trim() || activating}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#7C3AED', '#4F8EF7']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.activateBtnInner}
            >
              {activating
                ? <ActivityIndicator color={Colors.text} size="small" />
                : <Ionicons name="flash" size={20} color={Colors.text} />
              }
              <Text style={styles.activateBtnText}>
                {activating ? 'Attivazione in corso...' : 'Attiva corsa'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OPPURE SCANSIONA UN QR DI TEST</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Info QR */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
          <Text style={styles.infoText}>
            Tocca un QR per copiare il codice nel campo sopra, oppure usa la
            fotocamera dalla schermata "Scansiona".
          </Text>
        </View>

        {/* Griglia QR codes */}
        <View style={styles.qrGrid}>
          {TEST_VEHICLES.map(({ code: vCode, id }) => (
            <TouchableOpacity
              key={id}
              style={styles.qrCard}
              activeOpacity={0.75}
              onPress={() => {
                setCode(vCode);
                setError(null);
              }}
            >
              <View style={styles.qrImageBox}>
                <Image
                  source={{ uri: qrUrl(vCode) }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.qrLabel}>{vCode}</Text>
              <View style={styles.qrActivateRow}>
                <TouchableOpacity
                  style={styles.qrActivateBtn}
                  onPress={() => handleActivate(vCode)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#4F8EF7']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.qrActivateBtnInner}
                  >
                    <Ionicons name="flash" size={12} color={Colors.text} />
                    <Text style={styles.qrActivateBtnText}>Usa</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Nota footer */}
        <Text style={styles.footerNote}>
          I codici SM-01 → SM-20 corrispondono ai primi 20 veicoli del database.
          Assicurati che il backend sia avviato e il mezzo sia disponibile.
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:        { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { color: Colors.text, fontSize: 18, fontWeight: '800' },

  inputSection:   { margin: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, padding: 18, gap: 12 },
  inputHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputTitle:     { color: Colors.text, fontSize: 16, fontWeight: '700' },
  inputSub:       { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  codeInput:      { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 16, color: Colors.text, fontSize: 22, fontWeight: '800', letterSpacing: 4, textAlign: 'center' },
  errorBox:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  errorText:      { color: Colors.danger, fontSize: 13, flex: 1, lineHeight: 18 },
  activateBtn:    { borderRadius: 14, overflow: 'hidden' },
  activateBtnInner:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  activateBtnText:{ color: Colors.text, fontWeight: '800', fontSize: 16 },

  divider:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginVertical: 20 },
  dividerLine:    { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText:    { color: Colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  infoBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, marginBottom: 16, backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' },
  infoText:       { color: Colors.muted, fontSize: 13, flex: 1, lineHeight: 18 },

  qrGrid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  qrCard:         { width: '46%', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden', alignItems: 'center', paddingBottom: 10 },
  qrImageBox:     { backgroundColor: '#FFFFFF', width: '100%', padding: 10, alignItems: 'center' },
  qrImage:        { width: 120, height: 120 },
  qrLabel:        { color: Colors.text, fontWeight: '800', fontSize: 15, letterSpacing: 2, marginTop: 10, marginBottom: 6 },
  qrActivateRow:  { width: '80%' },
  qrActivateBtn:  { borderRadius: 10, overflow: 'hidden' },
  qrActivateBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  qrActivateBtnText:  { color: Colors.text, fontWeight: '700', fontSize: 12 },

  footerNote:     { color: Colors.muted, fontSize: 12, textAlign: 'center', marginHorizontal: 24, marginTop: 20, lineHeight: 18 },
});
