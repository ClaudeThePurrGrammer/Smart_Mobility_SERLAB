import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { paymentApi } from '@/lib/api/endpoints';

const METHODS = [
  { id: 'card',   kind: 'card',   label: 'Visa',      icon: <FontAwesome5 name="credit-card" size={24} color={Colors.accent} />, title: 'Carta di credito', sub: 'Visa, Mastercard, American Express' },
  { id: 'apple',  kind: 'apple',  label: 'Apple Pay', icon: <FontAwesome5 name="apple-pay" size={28} color={Colors.text} />,    title: 'Apple Pay',       sub: 'Paga in modo sicuro con Apple Pay' },
  { id: 'paypal', kind: 'paypal', label: 'PayPal',    icon: <FontAwesome5 name="paypal" size={24} color="#009CDE" />,            title: 'PayPal',          sub: 'Paga con il tuo account PayPal' },
] as const;

export default function PaymentScreen() {
  const { token } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);

  const addMethod = async (m: typeof METHODS[number]) => {
    if (!token) return;
    setSaving(m.id);
    try {
      // [DA VERIFICARE] In produzione la tokenizzazione carta avverrebbe via gateway (Stripe/Braintree).
      const last4 = m.kind === 'card' ? String(Math.floor(1000 + Math.random() * 9000)) : undefined;
      await paymentApi.add(token, { kind: m.kind, label: m.label, last4, is_default: true });
      Alert.alert('Metodo aggiunto', `${m.title} collegato con successo.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? 'Impossibile aggiungere il metodo.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>

      <Text style={styles.title}>Aggiungi dati{'\n'}di pagamento</Text>
      <Text style={styles.subtitle}>L'importo ti verrà addebitato solo dopo la corsa</Text>

      <View style={styles.methods}>
        {METHODS.map(m => (
          <TouchableOpacity key={m.id} style={styles.method} onPress={() => addMethod(m)} disabled={saving !== null}>
            <View style={styles.methodIcon}>{m.icon}</View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.methodTitle}>{m.title}</Text>
              <Text style={styles.methodSub}>{m.sub}</Text>
            </View>
            {saving === m.id
              ? <ActivityIndicator color={Colors.accent} />
              : <Ionicons name="chevron-forward" size={20} color={Colors.muted} />}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.securityRow}>
        <Ionicons name="lock-closed" size={16} color={Colors.muted} />
        <Text style={styles.securityText}>I tuoi dati sono protetti con crittografia avanzata</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg, paddingTop: 60, paddingHorizontal: 20 },
  backBtn:      { marginBottom: 28 },
  title:        { color: Colors.text, fontSize: 26, fontWeight: '800', lineHeight: 34, marginBottom: 8 },
  subtitle:     { color: Colors.muted, fontSize: 14, marginBottom: 32, lineHeight: 20 },
  methods:      { gap: 14, marginBottom: 'auto' },
  method:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16 },
  methodIcon:   { width: 48, height: 48, backgroundColor: Colors.surface, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodTitle:  { color: Colors.text, fontWeight: '700', fontSize: 15 },
  methodSub:    { color: Colors.muted, fontSize: 12 },
  securityRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 24 },
  securityText: { color: Colors.muted, fontSize: 13 },
});
