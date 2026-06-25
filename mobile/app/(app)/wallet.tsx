import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { walletApi, paymentApi } from '@/lib/api/endpoints';
import type { ApiTransaction, ApiPaymentMethod } from '@/lib/api/types';
import { shortDateTime } from '@/lib/format';

const TYPE_CONFIG = {
  charge: { icon: 'bicycle-outline',      color: Colors.danger  },
  refund: { icon: 'return-down-back-outline', color: Colors.success },
  topup:  { icon: 'add-circle-outline',   color: Colors.accent  },
};

export default function WalletScreen() {
  const { token, refreshUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [methods, setMethods] = useState<ApiPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    try {
      const [wallet, pm] = await Promise.all([walletApi.get(token), paymentApi.list(token)]);
      setBalance(wallet.balance);
      setTransactions(wallet.transactions);
      setMethods(pm);
    } catch {
      // errore di rete: lascia i valori correnti
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const handleTopUp = async () => {
    if (!token) return;
    try {
      const updated = await walletApi.topup(token, 10);
      setBalance(updated.balance);
      setTransactions(updated.transactions);
      await refreshUser();
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? 'Ricarica non riuscita.');
    }
  };

  const defaultMethod = methods.find((m) => m.is_default) ?? methods[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Portafoglio</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Balance card */}
        <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo disponibile</Text>
          <Text style={styles.balanceValue}>€ {balance.toFixed(2)}</Text>
          <TouchableOpacity style={styles.topupBtn} onPress={handleTopUp}>
            <Ionicons name="add" size={18} color={Colors.primary} />
            <Text style={styles.topupBtnText}>Ricarica € 10</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Payment methods */}
        <Text style={styles.sectionTitle}>Metodi di pagamento</Text>
        {defaultMethod ? (
          <TouchableOpacity style={styles.methodsBtn} onPress={() => router.push('/(app)/payment')}>
            <View style={styles.methodsLeft}>
              <FontAwesome5 name="credit-card" size={20} color={Colors.accent} />
              <View>
                <Text style={styles.methodsText}>
                  {defaultMethod.label}{defaultMethod.last4 ? ` •••• ${defaultMethod.last4}` : ''}
                </Text>
                <Text style={styles.methodsSub}>{defaultMethod.is_default ? 'Metodo principale' : 'Metodo collegato'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.methodsBtn, { marginTop: 2 }]} onPress={() => router.push('/(app)/payment')}>
          <View style={styles.methodsLeft}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.muted} />
            <Text style={[styles.methodsText, { color: Colors.muted }]}>Aggiungi metodo</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        </TouchableOpacity>

        {/* Transactions */}
        <Text style={styles.sectionTitle}>Ultime transazioni</Text>
        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.txCard}>
            {transactions.length === 0 ? (
              <Text style={{ color: Colors.muted, fontSize: 13, padding: 16, textAlign: 'center' }}>
                Nessuna transazione
              </Text>
            ) : transactions.map((tx, idx) => {
              const cfg = TYPE_CONFIG[tx.type];
              return (
                <View key={tx.id} style={[styles.txRow, idx < transactions.length - 1 && styles.txBorder]}>
                  <View style={[styles.txIcon, { backgroundColor: `${cfg.color}15` }]}>
                    <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.txLabel} numberOfLines={1}>{tx.label}</Text>
                    <Text style={styles.txDate}>{shortDateTime(tx.created_at)}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.amount > 0 ? Colors.success : Colors.text }]}>
                    {tx.amount > 0 ? '+' : ''}€ {Math.abs(tx.amount).toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.bg },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  backBtn:       { padding: 2 },
  title:         { color: Colors.text, fontSize: 20, fontWeight: '800' },
  balanceCard:   { margin: 16, borderRadius: 20, padding: 24, alignItems: 'center', gap: 8 },
  balanceLabel:  { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  balanceValue:  { color: Colors.text, fontSize: 42, fontWeight: '900' },
  topupBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.text, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 10, marginTop: 4 },
  topupBtnText:  { color: Colors.primary, fontWeight: '800', fontSize: 15 },
  sectionTitle:  { color: Colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginHorizontal: 20, marginTop: 20, marginBottom: 10 },
  methodsBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14 },
  methodsLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodsText:   { color: Colors.text, fontWeight: '600', fontSize: 14 },
  methodsSub:    { color: Colors.muted, fontSize: 11 },
  txCard:        { marginHorizontal: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden' },
  txRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  txBorder:      { borderBottomWidth: 1, borderBottomColor: Colors.border },
  txIcon:        { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txLabel:       { color: Colors.text, fontSize: 13, fontWeight: '500' },
  txDate:        { color: Colors.muted, fontSize: 11 },
  txAmount:      { fontWeight: '700', fontSize: 14 },
});
