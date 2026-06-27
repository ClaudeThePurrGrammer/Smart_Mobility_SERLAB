// app/(app)/ride-payment.tsx
// Pagamento della corsa: metodi salvati, aggiunta/rimozione, codice promo, conferma.
// endSession() viene chiamato QUI → la sessione corsa si chiude e la navigazione si sblocca.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, BackHandler, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRideSession } from '@/lib/ride/RideSessionContext';
import { paymentApi, promotionsApi, reportsApi } from '@/lib/api/endpoints';
import type { ApiPaymentMethod, ApiPromotion } from '@/lib/api/types';

// ── Icone ────────────────────────────────────────────────────────────────────
const METHOD_ICON: Record<string, React.ReactNode> = {
  card:   <FontAwesome5 name="credit-card" size={20} color={Colors.accent} />,
  apple:  <FontAwesome5 name="apple-pay"   size={24} color={Colors.text}   />,
  paypal: <FontAwesome5 name="paypal"      size={20} color="#009CDE"       />,
};
const METHOD_KIND_LABEL: Record<string, string> = {
  card:   'Carta di credito',
  apple:  'Apple Pay',
  paypal: 'PayPal',
};

// ── Tags fine corsa ───────────────────────────────────────────────────────────
const END_TAGS: Record<string, string> = {
  ostacolo: 'Ostacolo',
  danno:    'Veicolo danneggiato',
  parking:  'Parcheggio pieno',
  altro:    'Altro',
};

// ── Helper promo discount ─────────────────────────────────────────────────────
function extractDiscount(reward: string, base: number): number {
  // Tenta di estrarre "X%" → sconto percentuale
  const pct = reward.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pct) return Math.round(base * Number(pct[1].replace(',', '.')) / 100 * 100) / 100;
  // Tenta di estrarre "€X" → sconto fisso
  const eur = reward.match(/[€]\s*(\d+(?:[.,]\d+)?)/);
  if (eur) return Math.min(Number(eur[1].replace(',', '.')), base);
  // Fallback: sconto fisso di 1 €
  return Math.min(1.0, base);
}

export default function RidePaymentScreen() {
  const { token }      = useAuth();
  const { endSession } = useRideSession();
  const params = useLocalSearchParams<{
    cost?: string; km?: string; minutes?: string; points?: string;
    vehicleType?: string; areaId?: string; areaName?: string;
    selectedTag?: string; rating?: string;
  }>();

  const baseCost = Number(params.cost    ?? 0);
  const km       = Number(params.km      ?? 0);
  const minutes  = Number(params.minutes ?? 0);
  const points   = Number(params.points  ?? 0);

  // ── Metodi di pagamento ───────────────────────────────────────────────────
  const [methods, setMethods]           = useState<ApiPaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [selected, setSelected]         = useState<ApiPaymentMethod | null>(null);
  const [removing, setRemoving]         = useState<number | null>(null);

  const loadMethods = useCallback(async () => {
    if (!token) return;
    try {
      const list = await paymentApi.list(token);
      setMethods(list);
      // Mantieni la selezione corrente se esiste ancora; altrimenti pre-seleziona il default.
      setSelected(prev => {
        if (prev && list.find(m => m.id === prev.id)) return prev;
        return list.find(m => m.is_default) ?? list[0] ?? null;
      });
    } catch {}
    finally { setLoadingMethods(false); }
  }, [token]);

  // Ricarica ogni volta che la schermata ottiene il focus (es. dopo aver aggiunto un metodo).
  useFocusEffect(useCallback(() => { loadMethods(); }, [loadMethods]));

  // Blocca back hardware: il pagamento è obbligatorio per chiudere la sessione.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handleRemove = (m: ApiPaymentMethod) => {
    Alert.alert(
      'Rimuovi metodo',
      `Vuoi rimuovere "${METHOD_KIND_LABEL[m.kind] ?? m.kind}${m.last4 ? ` ●●●● ${m.last4}` : ''}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimuovi', style: 'destructive',
          onPress: async () => {
            if (!token) return;
            setRemoving(m.id);
            try {
              await paymentApi.remove(token, m.id);
              await loadMethods();
            } catch (e: any) {
              Alert.alert('Errore', e?.message ?? 'Impossibile rimuovere il metodo.');
            } finally { setRemoving(null); }
          },
        },
      ],
    );
  };

  // ── Codice promozionale ───────────────────────────────────────────────────
  const [promoCode, setPromoCode]     = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<ApiPromotion | null>(null);
  const [discount, setDiscount]       = useState(0);

  const finalCost = Math.max(0, baseCost - discount);

  const applyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    if (!token) return;
    setPromoLoading(true);
    try {
      // Cerca il codice nella lista delle promozioni disponibili.
      const all = await promotionsApi.list();
      const found = all.find(p => p.code?.toUpperCase() === code);
      if (!found) {
        Alert.alert('Codice non valido', 'Il codice promozionale inserito non esiste o è scaduto.');
        return;
      }
      if (found.total > 0 && found.used >= found.total) {
        Alert.alert('Promozione esaurita', 'Questo codice promozionale ha raggiunto il limite di utilizzo.');
        return;
      }
      const disc = extractDiscount(found.reward, baseCost);
      if (disc <= 0) {
        Alert.alert('Promozione applicata', `"${found.title}" applicata con successo!`);
      }
      setAppliedPromo(found);
      setDiscount(disc);
    } catch {
      Alert.alert('Errore', 'Impossibile verificare il codice promozionale.');
    } finally { setPromoLoading(false); }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setDiscount(0);
    setPromoCode('');
  };

  // ── Pagamento ─────────────────────────────────────────────────────────────
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    // Blocca sempre se non c'è almeno un metodo di pagamento salvato
    if (methods.length === 0) {
      Alert.alert(
        'Metodo di pagamento richiesto',
        'Devi aggiungere almeno un metodo di pagamento prima di poter completare il pagamento.',
        [{ text: 'OK' }],
      );
      return;
    }
    if (!selected) {
      Alert.alert('Seleziona metodo', 'Scegli un metodo di pagamento per procedere.');
      return;
    }
    setPaying(true);
    try {
      // Segna promo come usata (se presente).
      if (appliedPromo?.code && token) {
        await promotionsApi.redeem(token, appliedPromo.code).catch(() => {});
      }
      // Segnalazione fine corsa (tag opzionale da end-ride).
      if (params.selectedTag && token) {
        const label = END_TAGS[params.selectedTag] ?? 'Altro';
        await reportsApi.create(token, {
          category: label,
          description: `Segnalazione a fine corsa (valutazione: ${params.rating || '—'}/5)`,
        }).catch(() => {});
      }
      // [Simulazione] In produzione qui avverrebbe la chiamata al gateway di pagamento.
      await new Promise(r => setTimeout(r, 1200));

      // Chiude la sessione corsa → sblocca navigazione.
      endSession();

      // Naviga alla ricevuta di pagamento (full screen, back bloccato).
      router.replace({
        pathname: '/(app)/payment-receipt',
        params: {
          cost:        finalCost.toFixed(2),
          baseCost:    baseCost.toFixed(2),
          discount:    discount.toFixed(2),
          km:          String(km),
          minutes:     String(minutes),
          points:      String(points),
          vehicleType: params.vehicleType ?? '',
          areaName:    params.areaName ?? '',
          promoTitle:  appliedPromo?.title ?? '',
          methodKind:  selected?.kind ?? '',
          methodLast4: selected?.last4 ?? '',
        },
      });
    } catch (e: any) {
      Alert.alert('Errore pagamento', e?.message ?? 'Impossibile completare il pagamento.');
    } finally { setPaying(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header — nessun back button: il pagamento è obbligatorio */}
      <View style={styles.header}>
        <Text style={styles.title}>Pagamento corsa</Text>
        <Text style={styles.subtitle}>Completa il pagamento per terminare</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}
      >
        {/* ── Riepilogo costi ── */}
        <View style={styles.summaryCard}>
          <LinearGradient colors={['#1a0a38', '#120a2a']} style={styles.summaryGradient}>
            <Text style={styles.summaryLabel}>Totale da pagare</Text>

            <View style={styles.summaryAmountRow}>
              {discount > 0 && (
                <Text style={styles.summaryAmountStrike}>
                  € {baseCost.toFixed(2).replace('.', ',')}
                </Text>
              )}
              <Text style={styles.summaryAmount}>
                € {finalCost.toFixed(2).replace('.', ',')}
              </Text>
              {discount > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>
                    -{discount.toFixed(2).replace('.', ',')} €
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Ionicons name="map-outline" size={13} color={Colors.muted} />
                <Text style={styles.summaryStatText}>{km.toFixed(1).replace('.', ',')} km</Text>
              </View>
              <View style={[styles.summaryStat, styles.summaryStatMid]}>
                <Ionicons name="time-outline" size={13} color={Colors.muted} />
                <Text style={styles.summaryStatText}>{minutes} min</Text>
              </View>
              <View style={styles.summaryStat}>
                <Ionicons name="star-outline" size={13} color={Colors.warning} />
                <Text style={[styles.summaryStatText, { color: Colors.warning }]}>+{points} pt</Text>
              </View>
            </View>

            {params.areaName ? (
              <View style={styles.areaRow}>
                <Ionicons name="location-outline" size={13} color={Colors.accent} />
                <Text style={styles.areaText} numberOfLines={1}>{params.areaName}</Text>
              </View>
            ) : null}
          </LinearGradient>
        </View>

        {/* ── Codice promozionale ── */}
        <View>
          <Text style={styles.sectionLabel}>Codice promozionale</Text>
          {appliedPromo ? (
            <View style={styles.promoApplied}>
              <View style={styles.promoAppliedIcon}>
                <Ionicons name="pricetag" size={18} color={Colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.promoAppliedTitle}>{appliedPromo.title}</Text>
                <Text style={styles.promoAppliedReward}>{appliedPromo.reward}</Text>
              </View>
              <TouchableOpacity onPress={removePromo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={22} color={Colors.muted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.promoInputRow}>
              <TextInput
                style={styles.promoInput}
                value={promoCode}
                onChangeText={t => setPromoCode(t.toUpperCase())}
                placeholder="Inserisci codice sconto"
                placeholderTextColor={Colors.muted}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={applyPromo}
              />
              <TouchableOpacity
                style={[styles.promoApplyBtn, (!promoCode.trim() || promoLoading) && { opacity: 0.5 }]}
                onPress={applyPromo}
                disabled={!promoCode.trim() || promoLoading}
                activeOpacity={0.75}
              >
                {promoLoading
                  ? <ActivityIndicator size="small" color={Colors.text} />
                  : <Text style={styles.promoApplyText}>Applica</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Metodi di pagamento ── */}
        <View>
          <Text style={styles.sectionLabel}>Metodo di pagamento</Text>

          {loadingMethods ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : methods.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="card-outline" size={36} color={Colors.muted} />
              <Text style={styles.emptyText}>Nessun metodo salvato</Text>
              <Text style={styles.emptySubText}>Aggiungi un metodo per procedere con il pagamento</Text>
            </View>
          ) : (
            <View style={styles.methodsList}>
              {methods.map(m => {
                const isSel   = selected?.id === m.id;
                const isRemov = removing === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.methodRow, isSel && styles.methodRowActive]}
                    onPress={() => setSelected(m)}
                    activeOpacity={0.75}
                  >
                    {/* Selezione */}
                    <Ionicons
                      name={isSel ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={isSel ? Colors.primary : Colors.muted}
                    />
                    {/* Icona tipo */}
                    <View style={styles.methodIcon}>
                      {METHOD_ICON[m.kind] ?? <Ionicons name="card-outline" size={20} color={Colors.accent} />}
                    </View>
                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.methodTitle}>
                          {METHOD_KIND_LABEL[m.kind] ?? m.kind}
                          {m.last4 ? `  ●●●● ${m.last4}` : ''}
                        </Text>
                        {m.is_default && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.methodSub}>{m.label}</Text>
                    </View>
                    {/* Rimuovi */}
                    <TouchableOpacity
                      onPress={() => handleRemove(m)}
                      disabled={isRemov}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {isRemov
                        ? <ActivityIndicator size="small" color={Colors.muted} />
                        : <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                      }
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Aggiungi metodo */}
          <TouchableOpacity
            style={styles.addMethodBtn}
            onPress={() => router.push({
              pathname: '/(app)/payment',
              params: {
                returnTo: 'ride-payment',
                cost:        String(baseCost),
                km:          String(km),
                minutes:     String(minutes),
                points:      String(points),
                vehicleType: params.vehicleType ?? '',
                areaId:      params.areaId ?? '',
                areaName:    params.areaName ?? '',
                selectedTag: params.selectedTag ?? '',
                rating:      params.rating ?? '',
              },
            })}
            activeOpacity={0.75}
          >
            <View style={styles.addMethodIcon}>
              <Ionicons name="add" size={20} color={Colors.accent} />
            </View>
            <Text style={styles.addMethodText}>Aggiungi metodo di pagamento</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Sicurezza */}
        <View style={styles.securityRow}>
          <Ionicons name="lock-closed" size={13} color={Colors.muted} />
          <Text style={styles.securityText}>Pagamento sicuro con crittografia end-to-end</Text>
        </View>
      </ScrollView>

      {/* ── CTA pagamento ── */}
      <View style={styles.footer}>
        {discount > 0 && (
          <View style={styles.footerPromoRow}>
            <Ionicons name="pricetag-outline" size={14} color={Colors.success} />
            <Text style={styles.footerPromoText}>
              Sconto applicato: -{discount.toFixed(2).replace('.', ',')} €
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.payBtn, paying && { opacity: 0.6 }]}
          onPress={handlePay}
          disabled={paying}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={Gradients.primaryBtn}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.payBtnGradient}
          >
            {paying ? (
              <>
                <ActivityIndicator color={Colors.text} size="small" />
                <Text style={styles.payBtnText}>Pagamento in corso...</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={Colors.text} />
                <Text style={styles.payBtnText}>
                  Conferma e paga € {finalCost.toFixed(2).replace('.', ',')}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },

  header:         { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  title:          { color: Colors.text, fontSize: 22, fontWeight: '800' },
  subtitle:       { color: Colors.muted, fontSize: 13, marginTop: 2 },

  // Riepilogo
  summaryCard:      { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  summaryGradient:  { padding: 20, gap: 8 },
  summaryLabel:     { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  summaryAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  summaryAmountStrike: { color: Colors.muted, fontSize: 18, fontWeight: '500', textDecorationLine: 'line-through' },
  summaryAmount:    { color: Colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  discountBadge:    { backgroundColor: 'rgba(34,197,94,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.success },
  discountBadgeText:{ color: Colors.success, fontWeight: '700', fontSize: 13 },
  summaryStats:     { flexDirection: 'row', marginTop: 4 },
  summaryStat:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 14 },
  summaryStatMid:   { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14 },
  summaryStatText:  { color: Colors.muted, fontSize: 13 },
  areaRow:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  areaText:         { color: Colors.accent, fontSize: 13, flex: 1 },

  sectionLabel:  { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },

  // Promo
  promoInputRow:    { flexDirection: 'row', gap: 10 },
  promoInput:       { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text, fontSize: 15, fontWeight: '600', letterSpacing: 1 },
  promoApplyBtn:    { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center', minWidth: 82 },
  promoApplyText:   { color: Colors.text, fontWeight: '700', fontSize: 14 },
  promoApplied:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: Colors.success, borderRadius: 16, padding: 14 },
  promoAppliedIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center' },
  promoAppliedTitle:{ color: Colors.text, fontWeight: '700', fontSize: 14 },
  promoAppliedReward:{ color: Colors.success, fontSize: 12, marginTop: 2 },

  // Metodi
  loadingBox:       { alignItems: 'center', paddingVertical: 32 },
  emptyBox:         { alignItems: 'center', gap: 8, paddingVertical: 24, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16 },
  emptyText:        { color: Colors.text, fontWeight: '700', fontSize: 15 },
  emptySubText:     { color: Colors.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  methodsList:      { gap: 10, marginBottom: 12 },
  methodRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 14 },
  methodRowActive:  { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.1)' },
  methodIcon:       { width: 40, height: 40, backgroundColor: Colors.surface, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  methodTitle:      { color: Colors.text, fontWeight: '700', fontSize: 14 },
  methodSub:        { color: Colors.muted, fontSize: 12, marginTop: 2 },
  defaultBadge:     { backgroundColor: 'rgba(234,179,8,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(234,179,8,0.4)' },
  defaultBadgeText: { color: Colors.warning, fontSize: 10, fontWeight: '700' },
  addMethodBtn:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: 16, padding: 14 },
  addMethodIcon:    { width: 40, height: 40, backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.accent },
  addMethodText:    { color: Colors.accent, fontWeight: '600', fontSize: 14, flex: 1 },

  securityRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  securityText:     { color: Colors.muted, fontSize: 12 },

  // Footer
  footer:           { padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.card, gap: 10 },
  footerPromoRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  footerPromoText:  { color: Colors.success, fontSize: 13, fontWeight: '600' },
  payBtn:           { borderRadius: 16, overflow: 'hidden' },
  payBtnGradient:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  payBtnText:       { color: Colors.text, fontWeight: '800', fontSize: 16 },
});
