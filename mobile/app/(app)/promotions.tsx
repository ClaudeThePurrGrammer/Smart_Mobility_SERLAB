import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { promotionsApi, usersApi } from '@/lib/api/endpoints';
import type { ApiPromotion } from '@/lib/api/types';

const MIN_REDEEM = 100;

const POINTS_ACTIONS = [
  { icon: 'bicycle-outline',   label: 'Per ogni corsa',         pts: '+10 pt' },
  { icon: 'leaf-outline',      label: 'Corsa eco (>2km)',        pts: '+5 pt'  },
  { icon: 'person-add-outline',label: 'Referral amico',          pts: '+50 pt' },
  { icon: 'star-outline',      label: 'Valutazione 5 stelle',    pts: '+3 pt'  },
];

export default function PromotionsScreen() {
  const { user, token, refreshUser } = useAuth();
  const [promotions, setPromotions] = useState<ApiPromotion[]>([]);
  const [loading, setLoading] = useState(true);

  // Modale "Usa punti"
  const [redeemVisible, setRedeemVisible] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemBusy, setRedeemBusy] = useState(false);

  // Modale "Codice promozionale"
  const [codeVisible, setCodeVisible] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);

  const loadPromotions = () =>
    promotionsApi.list()
      .then(setPromotions)
      .catch(() => {});

  useEffect(() => {
    loadPromotions().finally(() => setLoading(false));
  }, []);

  const activePromo = promotions.find((p) => p.kind === 'active');
  const offers = promotions.filter((p) => p.kind === 'offer');
  const points = user?.points ?? 0;

  // ── Riscatto punti ─────────────────────────────────────────────────────────
  const handleRedeemPoints = async () => {
    const amount = parseInt(redeemAmount, 10);
    if (!token) { Alert.alert('Sessione scaduta', 'Effettua di nuovo l\'accesso.'); return; }
    if (isNaN(amount) || amount < MIN_REDEEM) {
      Alert.alert('Importo non valido', `Inserisci almeno ${MIN_REDEEM} punti.`);
      return;
    }
    if (amount > points) {
      Alert.alert('Punti insufficienti', `Hai solo ${points} punti disponibili.`);
      return;
    }
    setRedeemBusy(true);
    try {
      await usersApi.updateMe(token, { points: points - amount });
      await refreshUser();
      setRedeemVisible(false);
      setRedeemAmount('');
      Alert.alert('Punti riscattati!', `Hai riscattato ${amount} punti (€ ${(amount / 100).toFixed(2)} di sconto).`);
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? 'Riscatto non riuscito. Riprova.');
    } finally {
      setRedeemBusy(false);
    }
  };

  // ── Applicazione codice promo ──────────────────────────────────────────────
  const handleApplyCode = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!token) { Alert.alert('Sessione scaduta', 'Effettua di nuovo l\'accesso.'); return; }
    if (!code) { Alert.alert('Codice mancante', 'Inserisci un codice promozionale.'); return; }
    setCodeBusy(true);
    try {
      const promo = await promotionsApi.redeem(token, code);
      setCodeVisible(false);
      setPromoCode('');
      await loadPromotions();
      await refreshUser();
      Alert.alert('Codice applicato!', `"${promo.code}" · ${promo.reward}`);
    } catch (e: any) {
      Alert.alert('Codice non valido', e?.message ?? 'Impossibile applicare il codice.');
    } finally {
      setCodeBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Promozioni & Bonus</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Active promo card */}
        {activePromo && (
          <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activeCard}>
            <View style={styles.activeTop}>
              <View>
                <Text style={styles.activeLabel}>Codice attivo</Text>
                <Text style={styles.activeCode}>{activePromo.code ?? '—'}</Text>
              </View>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>{activePromo.reward}</Text>
              </View>
            </View>
            <View style={styles.activeProgress}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: activePromo.total > 0 ? `${(activePromo.used / activePromo.total) * 100}%` : '0%' }]} />
              </View>
              <Text style={styles.progressText}>
                {activePromo.used}/{activePromo.total} usate{activePromo.expiry ? ` · Scade il ${activePromo.expiry}` : ''}
              </Text>
            </View>
          </LinearGradient>
        )}

        {/* Points balance */}
        <View style={styles.pointsCard}>
          <MaterialCommunityIcons name="star-circle" size={32} color={Colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pointsValue}>{points} punti</Text>
            <Text style={styles.pointsLabel}>Equivalgono a € {(points / 100).toFixed(2)} di sconto</Text>
          </View>
          <TouchableOpacity style={styles.useBtn} onPress={() => { setRedeemAmount(''); setRedeemVisible(true); }}>
            <Text style={styles.useBtnText}>Usa punti</Text>
          </TouchableOpacity>
        </View>

        {/* How to earn */}
        <Text style={styles.sectionTitle}>Come guadagnare punti</Text>
        <View style={styles.sectionCard}>
          {POINTS_ACTIONS.map((a, idx) => (
            <View key={a.label} style={[styles.earnRow, idx < POINTS_ACTIONS.length - 1 && styles.earnRowBorder]}>
              <View style={styles.earnIcon}>
                <Ionicons name={a.icon as any} size={18} color={Colors.accent} />
              </View>
              <Text style={styles.earnLabel}>{a.label}</Text>
              <Text style={styles.earnPts}>{a.pts}</Text>
            </View>
          ))}
        </View>

        {/* Promo list */}
        {offers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Offerte disponibili</Text>
            {offers.map(p => (
              <TouchableOpacity key={p.id} style={styles.promoCard}>
                <View style={[styles.promoIcon, { backgroundColor: `${p.color}18` }]}>
                  <Ionicons name={p.icon as any} size={24} color={p.color} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.promoTitle}>{p.title}</Text>
                  <Text style={styles.promoBody} numberOfLines={2}>{p.body}</Text>
                </View>
                <View style={[styles.rewardBadge, { backgroundColor: `${p.color}20`, borderColor: p.color }]}>
                  <Text style={[styles.rewardText, { color: p.color }]}>{p.reward}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Enter code */}
        <TouchableOpacity style={styles.codeBtn} onPress={() => { setPromoCode(''); setCodeVisible(true); }}>
          <Ionicons name="pricetag-outline" size={20} color={Colors.accent} />
          <Text style={styles.codeBtnText}>Hai un codice promozionale?</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        </TouchableOpacity>

      </ScrollView>

      {/* ── Modale: Usa punti ── */}
      <Modal visible={redeemVisible} transparent animationType="fade" onRequestClose={() => setRedeemVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <MaterialCommunityIcons name="star-circle" size={36} color={Colors.warning} style={{ alignSelf: 'center' }} />
            <Text style={styles.modalTitle}>Usa i tuoi punti</Text>
            <Text style={styles.modalSub}>Saldo attuale: {points} punti (€ {(points / 100).toFixed(2)})</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={`Quanti punti (min ${MIN_REDEEM})`}
              placeholderTextColor={Colors.muted}
              keyboardType="number-pad"
              value={redeemAmount}
              onChangeText={setRedeemAmount}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setRedeemVisible(false)} disabled={redeemBusy}>
                <Text style={styles.modalBtnGhostText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleRedeemPoints} disabled={redeemBusy}>
                <Text style={styles.modalBtnPrimaryText}>{redeemBusy ? 'Riscatto…' : 'Riscatta'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modale: Codice promozionale ── */}
      <Modal visible={codeVisible} transparent animationType="fade" onRequestClose={() => setCodeVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Ionicons name="pricetag" size={34} color={Colors.accent} style={{ alignSelf: 'center' }} />
            <Text style={styles.modalTitle}>Codice promozionale</Text>
            <Text style={styles.modalSub}>Inserisci il codice per applicare la promozione</Text>
            <TextInput
              style={[styles.modalInput, { textAlign: 'center', letterSpacing: 3, fontWeight: '700' }]}
              placeholder="ES. SMART10"
              placeholderTextColor={Colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              value={promoCode}
              onChangeText={(t) => setPromoCode(t.toUpperCase())}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setCodeVisible(false)} disabled={codeBusy}>
                <Text style={styles.modalBtnGhostText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleApplyCode} disabled={codeBusy}>
                <Text style={styles.modalBtnPrimaryText}>{codeBusy ? 'Applico…' : 'Applica'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  backBtn:        { padding: 2 },
  title:          { color: Colors.text, fontSize: 20, fontWeight: '800' },
  activeCard:     { margin: 16, borderRadius: 20, padding: 20, gap: 16 },
  activeTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  activeLabel:    { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 },
  activeCode:     { color: Colors.text, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  activeBadge:    { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  activeBadgeText:{ color: Colors.text, fontWeight: '700', fontSize: 13 },
  activeProgress: { gap: 8 },
  progressBar:    { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 },
  progressFill:   { height: 6, backgroundColor: Colors.text, borderRadius: 3 },
  progressText:   { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  pointsCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16 },
  pointsValue:    { color: Colors.text, fontWeight: '800', fontSize: 18 },
  pointsLabel:    { color: Colors.muted, fontSize: 12 },
  useBtn:         { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  useBtnText:     { color: Colors.text, fontWeight: '700', fontSize: 13 },
  sectionTitle:   { color: Colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginHorizontal: 20, marginTop: 20, marginBottom: 10 },
  sectionCard:    { marginHorizontal: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  earnRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  earnRowBorder:  { borderBottomWidth: 1, borderBottomColor: Colors.border },
  earnIcon:       { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  earnLabel:      { color: Colors.text, fontSize: 14, fontWeight: '500', flex: 1 },
  earnPts:        { color: Colors.warning, fontWeight: '700', fontSize: 14 },
  promoCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 14 },
  promoIcon:      { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  promoTitle:     { color: Colors.text, fontWeight: '700', fontSize: 14 },
  promoBody:      { color: Colors.muted, fontSize: 12, lineHeight: 18 },
  rewardBadge:    { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  rewardText:     { fontSize: 12, fontWeight: '700' },
  codeBtn:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16 },
  codeBtnText:    { color: Colors.text, fontSize: 15, fontWeight: '500', flex: 1 },

  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard:      { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: Colors.border, padding: 20, paddingBottom: 34, gap: 12 },
  modalHandle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 4 },
  modalTitle:     { color: Colors.text, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  modalSub:       { color: Colors.muted, fontSize: 13, textAlign: 'center' },
  modalInput:     { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, height: 54, color: Colors.text, fontSize: 17, marginTop: 4 },
  modalActions:   { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtn:       { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalBtnGhost:  { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  modalBtnGhostText: { color: Colors.text, fontWeight: '600', fontSize: 15 },
  modalBtnPrimary: { backgroundColor: Colors.primary },
  modalBtnPrimaryText: { color: Colors.text, fontWeight: '700', fontSize: 15 },
});
