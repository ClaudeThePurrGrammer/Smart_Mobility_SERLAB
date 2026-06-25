// components/map/ManualLocationModal.tsx
// SA-02a — GPS non disponibile / permesso negato: l'utente inserisce manualmente
// la posizione (indirizzo), che viene geocodificata e usata per centrare la mappa.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import type { Coords } from '@/lib/geo';

interface Props {
  visible: boolean;
  /** Messaggio contestuale (es. permesso negato vs GPS non disponibile). */
  reason?: string;
  onClose: () => void;
  onResolved: (coords: Coords) => void;
  /** Geocodifica fornita dall'hook di localizzazione. */
  geocode: (address: string) => Promise<Coords | null>;
  /** Permette di ritentare il GPS invece dell'inserimento manuale. */
  onRetryGps: () => void;
}

export default function ManualLocationModal({
  visible, reason, onClose, onResolved, geocode, onRetryGps,
}: Props) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  if (!visible) return null;

  const submit = async () => {
    const q = address.trim();
    if (!q) return;
    setLoading(true);
    setNotFound(false);
    const coords = await geocode(q);
    setLoading(false);
    if (coords) {
      onResolved(coords);
      setAddress('');
    } else {
      setNotFound(true);
    }
  };

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.root]} pointerEvents="box-none">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.cardWrapper}
        pointerEvents="box-none"
      >
        <View style={styles.card}>
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={styles.cardBg} pointerEvents="none" />

          <View style={styles.header}>
            <View style={styles.warnIcon}>
              <Ionicons name="location-outline" size={22} color={Colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Posizione non disponibile</Text>
              <Text style={styles.reason}>{reason ?? 'Inserisci manualmente la tua posizione.'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={Colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <Ionicons name="search-outline" size={18} color={Colors.accent} />
            <TextInput
              style={styles.input}
              placeholder="Indirizzo o città (es. Via Roma, Bari)"
              placeholderTextColor={Colors.muted}
              value={address}
              onChangeText={(t) => { setAddress(t); setNotFound(false); }}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={submit}
            />
          </View>

          {notFound && (
            <Text style={styles.notFound}>Indirizzo non trovato. Riprova con più dettagli.</Text>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={submit} activeOpacity={0.85} disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.text} />
              : <Text style={styles.primaryBtnText}>Usa questo indirizzo</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.retryBtn} onPress={onRetryGps} activeOpacity={0.7}>
            <Ionicons name="refresh" size={15} color={Colors.accent} />
            <Text style={styles.retryText}>Riprova con il GPS</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { zIndex: 60 },
  overlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  cardWrapper:  { flex: 1, justifyContent: 'center', paddingHorizontal: 22 },
  card:         { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)', padding: 20 },
  cardBg:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,8,24,0.9)' },

  header:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  warnIcon:     { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center' },
  title:        { color: Colors.text, fontSize: 16, fontWeight: '800' },
  reason:       { color: Colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },

  inputRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)', borderRadius: 16, paddingHorizontal: 14, height: 52 },
  input:        { flex: 1, color: Colors.text, fontSize: 15 },
  notFound:     { color: Colors.danger, fontSize: 12, marginTop: 8, marginLeft: 4 },

  primaryBtn:   { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  primaryBtnText:{ color: Colors.text, fontSize: 15, fontWeight: '700' },
  retryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  retryText:    { color: Colors.accent, fontSize: 14, fontWeight: '600' },
});
