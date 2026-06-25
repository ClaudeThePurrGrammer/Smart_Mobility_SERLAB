import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import GradientButton from '@/components/ui/GradientButton';
import { useAuth } from '@/lib/auth/AuthContext';
import { reportsApi } from '@/lib/api/endpoints';

type Category = 'veicolo' | 'parcheggio' | 'sicurezza' | 'strada' | 'altro';

const CATEGORIES: { id: Category; icon: string; label: string; sub: string }[] = [
  { id: 'veicolo',    icon: 'bicycle-outline',       label: 'Veicolo',           sub: 'Guasto, batteria, danneggiato' },
  { id: 'parcheggio', icon: 'car-outline',            label: 'Parcheggio',        sub: 'Area piena o non autorizzata' },
  { id: 'sicurezza',  icon: 'warning-outline',        label: 'Sicurezza',         sub: 'Situazione pericolosa' },
  { id: 'strada',     icon: 'map-outline',            label: 'Strada / percorso', sub: 'Ostacolo, lavori, deviazione' },
  { id: 'altro',      icon: 'ellipsis-horizontal-outline', label: 'Altro',        sub: 'Qualsiasi altra segnalazione' },
];

export default function ReportScreen() {
  const { token } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);

  const handleSubmit = async () => {
    if (!category) return;
    setLoading(true);
    try {
      if (token) {
        await reportsApi.create(token, { category, description });
      }
      setSent(true);
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? 'Invio segnalazione non riuscito.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 }]}>
        <LinearGradient colors={Gradients.primary} style={{ width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={42} color={Colors.text} />
        </LinearGradient>
        <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '800' }}>Segnalazione inviata</Text>
        <Text style={{ color: Colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
          Grazie per la tua segnalazione. Il nostro team la esaminerà al più presto.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13, marginTop: 8 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: Colors.text, fontWeight: '600', fontSize: 15 }}>Torna alla home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Segnala un problema</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}>

        <View>
          <Text style={styles.label}>Categoria *</Text>
          <View style={styles.categories}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catCard, category === cat.id && styles.catCardActive]}
                onPress={() => setCategory(cat.id)}
              >
                <View style={[styles.catIcon, category === cat.id && styles.catIconActive]}>
                  <Ionicons name={cat.icon as any} size={22} color={category === cat.id ? Colors.text : Colors.muted} />
                </View>
                <Text style={[styles.catLabel, category === cat.id && { color: Colors.text }]}>{cat.label}</Text>
                <Text style={styles.catSub} numberOfLines={1}>{cat.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

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

        <TouchableOpacity style={styles.photoBtn}>
          <Ionicons name="camera-outline" size={22} color={Colors.accent} />
          <View>
            <Text style={styles.photoBtnTitle}>Aggiungi foto</Text>
            <Text style={styles.photoBtnSub}>Opzionale — max 3 foto</Text>
          </View>
        </TouchableOpacity>

        <GradientButton
          title="Invia segnalazione"
          onPress={handleSubmit}
          loading={loading}
          full
          icon={<Ionicons name="send-outline" size={18} color={Colors.text} />}
        />

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  backBtn:        { padding: 2 },
  title:          { color: Colors.text, fontSize: 20, fontWeight: '800' },
  label:          { color: Colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  categories:     { gap: 8 },
  catCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 14 },
  catCardActive:  { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.1)' },
  catIcon:        { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  catIconActive:  { backgroundColor: Colors.primary },
  catLabel:       { color: Colors.muted, fontWeight: '700', fontSize: 14, flex: 1 },
  catSub:         { color: Colors.muted, fontSize: 11, position: 'absolute', right: 14, top: 20 },
  textarea:       { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, color: Colors.text, fontSize: 15, minHeight: 120, lineHeight: 22 },
  photoBtn:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, borderStyle: 'dashed' },
  photoBtnTitle:  { color: Colors.text, fontWeight: '600', fontSize: 14 },
  photoBtnSub:    { color: Colors.muted, fontSize: 12 },
});
