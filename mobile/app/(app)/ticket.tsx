import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { messagesApi } from '@/lib/api/endpoints';

const CATEGORIES = ['Pagamento', 'Mezzo', 'App', 'Altro'] as const;
type Category = typeof CATEGORIES[number];

export default function TicketScreen() {
  const { token } = useAuth();
  const [category, setCategory] = useState<Category>('Pagamento');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = subject.trim().length > 0 && description.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit || !token) return;
    setSubmitting(true);
    try {
      await messagesApi.create(token, {
        title: subject.trim(),
        body: `${description.trim()}\nCategoria: ${category}`,
        type: 'alert',
      });
      Alert.alert(
        'Ticket inviato',
        'Abbiamo ricevuto la tua richiesta. Ti risponderemo entro 24 ore.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch {
      Alert.alert('Errore', 'Impossibile inviare il ticket. Riprova più tardi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Apri Ticket</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 20 }}>

        <View style={{ gap: 10 }}>
          <Text style={styles.label}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => setCategory(c)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={styles.label}>Oggetto</Text>
          <TextInput
            style={styles.input}
            placeholder="Riassumi il problema"
            placeholderTextColor={Colors.muted}
            value={subject}
            onChangeText={setSubject}
            maxLength={80}
          />
          <Text style={styles.counter}>{subject.length}/80</Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={styles.label}>Descrizione</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Descrivi il problema nel dettaglio…"
            placeholderTextColor={Colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{description.length}/500</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGradient}>
            {submitting
              ? <ActivityIndicator color={Colors.text} />
              : <>
                  <Ionicons name="send-outline" size={18} color={Colors.text} />
                  <Text style={styles.submitText}>Invia ticket</Text>
                </>}
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.bg },
  header:           { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  backBtn:          { padding: 2 },
  title:            { color: Colors.text, fontSize: 20, fontWeight: '800' },

  label:            { color: Colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  chip:             { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  chipActive:       { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: Colors.primary },
  chipText:         { color: Colors.muted, fontSize: 14, fontWeight: '600' },
  chipTextActive:   { color: Colors.text, fontWeight: '700' },

  input:            { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text, fontSize: 15 },
  textarea:         { minHeight: 120 },
  counter:          { color: Colors.muted, fontSize: 11, alignSelf: 'flex-end' },

  submitBtn:        { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  submitBtnDisabled:{ opacity: 0.5 },
  submitGradient:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  submitText:       { color: Colors.text, fontSize: 16, fontWeight: '700' },
});
