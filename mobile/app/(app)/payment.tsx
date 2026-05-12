import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';

const METHODS = [
  { id: 'card',   icon: <FontAwesome5 name="credit-card" size={24} color={Colors.accent} />, title: 'Carta di credito', sub: 'Visa, Mastercard, American Express' },
  { id: 'apple',  icon: <FontAwesome5 name="apple-pay" size={28} color={Colors.text} />,    title: 'Apple Pay',       sub: 'Paga in modo sicuro con Apple Pay' },
  { id: 'paypal', icon: <FontAwesome5 name="paypal" size={24} color="#009CDE" />,            title: 'PayPal',          sub: 'Paga con il tuo account PayPal' },
] as const;

export default function PaymentScreen() {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>

      <Text style={styles.title}>Aggiungi dati{'\n'}di pagamento</Text>
      <Text style={styles.subtitle}>L'importo ti verrà addebitato solo dopo la corsa</Text>

      <View style={styles.methods}>
        {METHODS.map(m => (
          <TouchableOpacity key={m.id} style={styles.method}>
            <View style={styles.methodIcon}>{m.icon}</View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.methodTitle}>{m.title}</Text>
              <Text style={styles.methodSub}>{m.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
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
