import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { paymentApi } from '@/lib/api/endpoints';

const METHODS = [
  { id: 'card',   kind: 'card',   label: 'Carta',    icon: <FontAwesome5 name="credit-card" size={24} color={Colors.accent} />, title: 'Carta di credito', sub: 'Visa, Mastercard, American Express' },
  { id: 'apple',  kind: 'apple',  label: 'Apple Pay', icon: <FontAwesome5 name="apple-pay" size={28} color={Colors.text} />,    title: 'Apple Pay',       sub: 'Paga in modo sicuro con Apple Pay' },
  { id: 'paypal', kind: 'paypal', label: 'PayPal',    icon: <FontAwesome5 name="paypal" size={24} color="#009CDE" />,            title: 'PayPal',          sub: 'Paga con il tuo account PayPal' },
] as const;

type Method = typeof METHODS[number];

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function formatCardNumber(value: string) {
  return onlyDigits(value).slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string) {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function cardBrand(number: string) {
  const digits = onlyDigits(number);
  if (digits.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'American Express';
  return 'Carta';
}

function expiryIsValid(expiry: string) {
  const [monthRaw, yearRaw] = expiry.split('/');
  if (!monthRaw || !yearRaw || yearRaw.length !== 2) return false;
  const month = Number(monthRaw);
  const year = Number(`20${yearRaw}`);
  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

export default function PaymentScreen() {
  const { token } = useAuth();
  const params = useLocalSearchParams<{
    returnTo?: string; cost?: string; km?: string; minutes?: string; points?: string;
    vehicleType?: string; areaId?: string; areaName?: string; selectedTag?: string; rating?: string;
  }>();

  const [saving, setSaving] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<Method | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cvc, setCvc] = useState('');
  const [expiry, setExpiry] = useState('');
  const [holderName, setHolderName] = useState('');

  const selectedBrand = useMemo(() => cardBrand(cardNumber), [cardNumber]);

  useFocusEffect(useCallback(() => {
    setSaving(null);
    setSelectedMethod(null);
    setCardNumber('');
    setCvc('');
    setExpiry('');
    setHolderName('');
  }, []));

  const returnAfterSave = () => {
    if (params.returnTo === 'ride-payment') {
      router.replace({
        pathname: '/(app)/ride-payment',
        params: {
          cost:        params.cost ?? '',
          km:          params.km ?? '',
          minutes:     params.minutes ?? '',
          points:      params.points ?? '',
          vehicleType: params.vehicleType ?? '',
          areaId:      params.areaId ?? '',
          areaName:    params.areaName ?? '',
          selectedTag: params.selectedTag ?? '',
          rating:      params.rating ?? '',
        },
      });
      return;
    }
    router.back();
  };

  const validateCard = () => {
    const digits = onlyDigits(cardNumber);
    const cvcDigits = onlyDigits(cvc);

    if (digits.length < 13 || digits.length > 19) {
      Alert.alert('Carta non valida', 'Inserisci un numero carta valido.');
      return false;
    }
    if (!expiryIsValid(expiry)) {
      Alert.alert('Scadenza non valida', 'Inserisci una scadenza valida nel formato MM/AA.');
      return false;
    }
    if (cvcDigits.length < 3 || cvcDigits.length > 4) {
      Alert.alert('CVC non valido', 'Inserisci il codice di sicurezza della carta.');
      return false;
    }
    if (holderName.trim().length < 3) {
      Alert.alert('Nome mancante', 'Inserisci il nome del beneficiario della carta.');
      return false;
    }
    return true;
  };

  const addMethod = async (m: Method) => {
    if (!token || saving) return;
    if (m.kind === 'card' && !validateCard()) return;

    setSaving(m.id);
    try {
      const digits = onlyDigits(cardNumber);
      const label = m.kind === 'card'
        ? `${selectedBrand} - ${holderName.trim()}`
        : m.label;
      const last4 = m.kind === 'card' ? digits.slice(-4) : undefined;

      await paymentApi.add(token, { kind: m.kind, label, last4, is_default: true });
      Alert.alert('Metodo aggiunto', `${m.title} collegato con successo.`, [
        { text: 'OK', onPress: returnAfterSave },
      ]);
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? 'Impossibile aggiungere il metodo.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity style={styles.backBtn} onPress={returnAfterSave}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Aggiungi dati{'\n'}di pagamento</Text>
        <Text style={styles.subtitle}>L'importo ti verra addebitato solo dopo la corsa</Text>

        <View style={styles.methods}>
          {METHODS.map(m => {
            const active = selectedMethod?.id === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.method, active && styles.methodActive]}
                onPress={() => setSelectedMethod(active ? null : m)}
                disabled={saving !== null}
                activeOpacity={0.75}
              >
                <View style={styles.methodIcon}>{m.icon}</View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.methodTitle}>{m.title}</Text>
                  <Text style={styles.methodSub}>{m.sub}</Text>
                </View>
                <Ionicons
                  name={active ? 'checkmark-circle' : 'chevron-forward'}
                  size={22}
                  color={active ? Colors.primary : Colors.muted}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedMethod?.kind === 'card' && (
          <View style={styles.cardForm}>
            <Text style={styles.sectionLabel}>Dati carta</Text>
            <TextInput
              style={styles.input}
              value={cardNumber}
              onChangeText={t => setCardNumber(formatCardNumber(t))}
              placeholder="Numero carta"
              placeholderTextColor={Colors.muted}
              keyboardType="number-pad"
              autoComplete="cc-number"
              maxLength={23}
            />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputHalf]}
                value={expiry}
                onChangeText={t => setExpiry(formatExpiry(t))}
                placeholder="MM/AA"
                placeholderTextColor={Colors.muted}
                keyboardType="number-pad"
                autoComplete="cc-exp"
                maxLength={5}
              />
              <TextInput
                style={[styles.input, styles.inputHalf]}
                value={cvc}
                onChangeText={t => setCvc(onlyDigits(t).slice(0, 4))}
                placeholder="CVC"
                placeholderTextColor={Colors.muted}
                keyboardType="number-pad"
                autoComplete="cc-csc"
                secureTextEntry
                maxLength={4}
              />
            </View>
            <TextInput
              style={styles.input}
              value={holderName}
              onChangeText={setHolderName}
              placeholder="Nome beneficiario"
              placeholderTextColor={Colors.muted}
              autoCapitalize="words"
              autoComplete="cc-name"
            />
          </View>
        )}

        {selectedMethod && (
          <TouchableOpacity
            style={[styles.saveBtn, saving !== null && { opacity: 0.65 }]}
            onPress={() => addMethod(selectedMethod)}
            disabled={saving !== null}
            activeOpacity={0.8}
          >
            {saving === selectedMethod.id ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={Colors.text} />
                <Text style={styles.saveBtnText}>Conferma metodo</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.securityRow}>
          <Ionicons name="lock-closed" size={16} color={Colors.muted} />
          <Text style={styles.securityText}>I dati sensibili della carta non vengono salvati nell'app</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg },
  content:      { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 32 },
  backBtn:      { marginBottom: 28, alignSelf: 'flex-start' },
  title:        { color: Colors.text, fontSize: 26, fontWeight: '800', lineHeight: 34, marginBottom: 8 },
  subtitle:     { color: Colors.muted, fontSize: 14, marginBottom: 32, lineHeight: 20 },
  methods:      { gap: 14, marginBottom: 18 },
  method:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16 },
  methodActive: { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.1)' },
  methodIcon:   { width: 48, height: 48, backgroundColor: Colors.surface, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodTitle:  { color: Colors.text, fontWeight: '700', fontSize: 15 },
  methodSub:    { color: Colors.muted, fontSize: 12 },
  sectionLabel: { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  cardForm:     { gap: 12, marginBottom: 18 },
  input:        { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: Colors.text, fontSize: 15, fontWeight: '600' },
  inputRow:     { flexDirection: 'row', gap: 10 },
  inputHalf:    { flex: 1 },
  saveBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, marginBottom: 18 },
  saveBtnText:  { color: Colors.text, fontWeight: '800', fontSize: 16 },
  securityRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 8 },
  securityText: { color: Colors.muted, fontSize: 13, flexShrink: 1, textAlign: 'center' },
});
