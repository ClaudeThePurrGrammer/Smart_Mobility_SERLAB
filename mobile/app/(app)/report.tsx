import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Gradients } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { reportsApi } from '@/lib/api/endpoints';

const MAX_ATTACHMENTS = 3;

// ── Dati form ───────────────────────────────────────────────────────────────
type Category = 'veicolo' | 'parcheggio' | 'sicurezza' | 'strada' | 'altro';
type Tipo = 'MALFUNZIONAMENTO' | 'OSTACOLO' | 'PERCORSO' | 'ALTRO';
type Gravita = 'BASSA' | 'MEDIA' | 'ALTA';

const CATEGORIES: { id: Category; icon: string; label: string; sub: string }[] = [
  { id: 'veicolo',    icon: 'bicycle-outline',            label: 'Veicolo',           sub: 'Guasto, batteria, danneggiato' },
  { id: 'parcheggio', icon: 'car-outline',                label: 'Parcheggio',        sub: 'Area piena o non autorizzata' },
  { id: 'sicurezza',  icon: 'warning-outline',            label: 'Sicurezza',         sub: 'Situazione pericolosa' },
  { id: 'strada',     icon: 'map-outline',                label: 'Strada / percorso', sub: 'Ostacolo, lavori, deviazione' },
  { id: 'altro',      icon: 'ellipsis-horizontal-outline',label: 'Altro',             sub: 'Qualsiasi altra segnalazione' },
];

const TIPI: { id: Tipo; label: string }[] = [
  { id: 'MALFUNZIONAMENTO', label: 'Malfunzionamento' },
  { id: 'OSTACOLO',         label: 'Ostacolo' },
  { id: 'PERCORSO',         label: 'Percorso' },
  { id: 'ALTRO',            label: 'Altro' },
];

const GRAVITA_OPTIONS: { id: Gravita; label: string; color: string }[] = [
  { id: 'BASSA',  label: 'Bassa',  color: Colors.success },
  { id: 'MEDIA',  label: 'Media',  color: Colors.warning },
  { id: 'ALTA',   label: 'Alta',   color: Colors.danger  },
];

export default function ReportScreen() {
  const { token } = useAuth();
  const params = useLocalSearchParams<{
    rideId?: string;
    fromLat?: string;
    fromLng?: string;
  }>();

  const [category, setCategory] = useState<Category | null>(null);
  const [tipo, setTipo]         = useState<Tipo>('ALTRO');
  const [gravita, setGravita]   = useState<Gravita>('MEDIA');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);

  // Reset completo del form ad ogni focus: evita che lo stato residuo
  // (incluso `sent=true`) rimanga visibile quando si apre una nuova segnalazione
  // (lo screen è tenuto in memoria dal tab navigator anche tra navigazioni).
  useFocusEffect(
    useCallback(() => {
      setCategory(null);
      setTipo('ALTRO');
      setGravita('MEDIA');
      setDescription('');
      setAttachments([]);
      setLoading(false);
      setSent(false);
    }, []),
  );

  const pickImage = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Limite raggiunto', `Puoi allegare al massimo ${MAX_ATTACHMENTS} immagini.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permesso negato', 'Abilita l\'accesso alla galleria nelle impostazioni.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.35,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setAttachments(prev => [...prev, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert('Campo obbligatorio', 'Seleziona una categoria prima di inviare.');
      return;
    }
    if (!token) return;
    setLoading(true);
    try {
      await reportsApi.create(token, {
        category,
        description,
        tipo,
        gravita,
        ride_id: params.rideId ? Number(params.rideId) : undefined,
        gps_lat: params.fromLat ? Number(params.fromLat) : undefined,
        gps_lng: params.fromLng ? Number(params.fromLng) : undefined,
        attachments,
      });
      setSent(true);
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? 'Invio segnalazione non riuscito.');
    } finally {
      setLoading(false);
    }
  };

  // ── Schermata di conferma invio ──────────────────────────────────────────
  if (sent) {
    return (
      <View style={styles.successContainer}>
        <LinearGradient
          colors={['#10b981', '#059669']}
          style={styles.successIcon}
        >
          <Ionicons name="checkmark" size={42} color={Colors.text} />
        </LinearGradient>
        <Text style={styles.successTitle}>Segnalazione inviata</Text>
        <Text style={styles.successSub}>
          Grazie! Il nostro team esaminerà la tua segnalazione al più presto.
          Riceverai una notifica quando verrà gestita.
        </Text>

        <View style={styles.successActions}>
          <TouchableOpacity
            style={styles.successBtnPrimary}
            onPress={() => params.rideId
              ? router.replace('/(app)/active-ride')
              : router.back()
            }
          >
            <LinearGradient
              colors={Gradients.primaryBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.successBtnGradient}
            >
              <Ionicons name="arrow-back" size={18} color={Colors.text} />
              <Text style={styles.successBtnPrimaryText}>
                {params.rideId ? 'Torna alla corsa' : 'Torna indietro'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.successBtnSecondary}
            onPress={() => router.replace('/(app)/reports-history')}
          >
            <Ionicons name="list-outline" size={18} color={Colors.accent} />
            <Text style={styles.successBtnSecondaryText}>Vedi le mie segnalazioni</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Form segnalazione ────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => params.rideId
            ? router.replace('/(app)/active-ride')
            : router.back()
          }
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Segnala un problema</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Categoria */}
        <View>
          <Text style={styles.label}>Categoria *</Text>
          <View style={styles.categories}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catCard, category === cat.id && styles.catCardActive]}
                onPress={() => setCategory(cat.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.catIcon, category === cat.id && styles.catIconActive]}>
                  <Ionicons
                    name={cat.icon as any}
                    size={22}
                    color={category === cat.id ? Colors.text : Colors.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.catLabel, category === cat.id && { color: Colors.text }]}>
                    {cat.label}
                  </Text>
                  <Text style={styles.catSub}>{cat.sub}</Text>
                </View>
                {category === cat.id && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tipo */}
        <View>
          <Text style={styles.label}>Tipo di problema</Text>
          <View style={styles.chipRow}>
            {TIPI.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.chip, tipo === t.id && styles.chipActive]}
                onPress={() => setTipo(t.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, tipo === t.id && styles.chipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Gravità */}
        <View>
          <Text style={styles.label}>Gravità</Text>
          <View style={styles.chipRow}>
            {GRAVITA_OPTIONS.map(g => (
              <TouchableOpacity
                key={g.id}
                style={[
                  styles.chip,
                  gravita === g.id && { backgroundColor: `${g.color}22`, borderColor: g.color },
                ]}
                onPress={() => setGravita(g.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.gravDot, { backgroundColor: g.color }]} />
                <Text style={[
                  styles.chipText,
                  gravita === g.id && { color: g.color, fontWeight: '700' },
                ]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Descrizione */}
        <View>
          <Text style={styles.label}>Descrizione</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Descrivi il problema nel dettaglio..."
            placeholderTextColor={Colors.muted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={styles.textarea}
          />
        </View>

        {/* Allegati */}
        <View>
          <Text style={styles.label}>Allegati ({attachments.length}/{MAX_ATTACHMENTS})</Text>
          <View style={styles.attachRow}>
            {attachments.map((uri, idx) => (
              <View key={idx} style={styles.thumbWrapper}>
                <Image source={{ uri }} style={styles.thumb} />
                <TouchableOpacity
                  style={styles.thumbRemove}
                  onPress={() => removeAttachment(idx)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
            {attachments.length < MAX_ATTACHMENTS && (
              <TouchableOpacity style={styles.attachAddBtn} onPress={pickImage} activeOpacity={0.75}>
                <Ionicons name="image-outline" size={24} color={Colors.accent} />
                <Text style={styles.attachAddText}>Aggiungi foto</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Contesto corsa (se presente) */}
        {params.rideId && (
          <View style={styles.rideCtxBadge}>
            <Ionicons name="bicycle" size={15} color={Colors.accent} />
            <Text style={styles.rideCtxText}>
              Associata alla corsa #{params.rideId}
            </Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (!category || loading) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!category || loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={Gradients.primaryBtn}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.submitBtnInner}
          >
            {loading
              ? <ActivityIndicator color={Colors.text} size="small" />
              : <Ionicons name="send-outline" size={18} color={Colors.text} />
            }
            <Text style={styles.submitBtnText}>
              {loading ? 'Invio in corso...' : 'Invia segnalazione'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  backBtn:        { padding: 2 },
  title:          { color: Colors.text, fontSize: 20, fontWeight: '800' },
  label:          { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },

  // Categoria
  categories:     { gap: 8 },
  catCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 14 },
  catCardActive:  { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.1)' },
  catIcon:        { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catIconActive:  { backgroundColor: Colors.primary },
  catLabel:       { color: Colors.muted, fontWeight: '700', fontSize: 14 },
  catSub:         { color: Colors.muted, fontSize: 11, marginTop: 2 },

  // Chip tipo / gravità
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive:     { backgroundColor: 'rgba(124,58,237,0.15)', borderColor: Colors.primary },
  chipText:       { color: Colors.muted, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: Colors.text, fontWeight: '700' },
  gravDot:        { width: 8, height: 8, borderRadius: 4 },

  // Descrizione
  textarea:       { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, color: Colors.text, fontSize: 15, minHeight: 120, lineHeight: 22 },

  // Allegati
  attachRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  thumbWrapper:   { position: 'relative', width: 80, height: 80 },
  thumb:          { width: 80, height: 80, borderRadius: 12, backgroundColor: Colors.surface },
  thumbRemove:    { position: 'absolute', top: -6, right: -6, backgroundColor: Colors.card, borderRadius: 10 },
  attachAddBtn:   { width: 80, height: 80, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', gap: 4 },
  attachAddText:  { color: Colors.accent, fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Badge corsa
  rideCtxBadge:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' },
  rideCtxText:   { color: Colors.accent, fontSize: 13, fontWeight: '500' },

  // Submit
  submitBtn:      { borderRadius: 16, overflow: 'hidden' },
  submitBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  submitBtnText:  { color: Colors.text, fontWeight: '800', fontSize: 16 },

  // Success
  successContainer: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  successIcon:      { width: 88, height: 88, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  successTitle:     { color: Colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  successSub:       { color: Colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  successActions:   { width: '100%', gap: 12, marginTop: 8 },
  successBtnPrimary:    { borderRadius: 16, overflow: 'hidden' },
  successBtnGradient:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  successBtnPrimaryText:{ color: Colors.text, fontWeight: '700', fontSize: 15 },
  successBtnSecondary:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingVertical: 14 },
  successBtnSecondaryText: { color: Colors.accent, fontWeight: '600', fontSize: 15 },
});
