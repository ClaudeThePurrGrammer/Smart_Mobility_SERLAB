import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';

const POINTS_ACTIONS = [
  { icon: 'bicycle-outline',    label: 'Per ogni corsa',       pts: '+10 pt' },
  { icon: 'leaf-outline',       label: 'Corsa eco (>2km)',     pts: '+5 pt'  },
  { icon: 'person-add-outline', label: 'Referral amico',       pts: '+50 pt' },
  { icon: 'star-outline',       label: 'Valutazione 5 stelle', pts: '+3 pt'  },
];

const TIERS = [
  { key: 'bronze', label: 'Bronze', min: 0,   max: 99,       color: '#CD7F32', icon: 'medal-outline' },
  { key: 'silver', label: 'Silver', min: 100, max: 499,      color: '#C0C0C0', icon: 'medal-outline' },
  { key: 'gold',   label: 'Gold',   min: 500, max: Infinity, color: '#FFD700', icon: 'trophy-outline' },
] as const;

function currentTier(points: number) {
  return TIERS.find((t) => points >= t.min && points <= t.max) ?? TIERS[0];
}

export default function LoyaltyScreen() {
  const { user } = useAuth();
  const points = user?.points ?? 0;
  const tier = currentTier(points);

  // Progresso verso il livello successivo (Gold è l'ultimo: barra piena).
  const nextTier = TIERS.find((t) => t.min > points) ?? null;
  const tierStart = tier.min;
  const tierEnd = nextTier ? nextTier.min : tier.min;
  const progress = nextTier ? Math.min(1, (points - tierStart) / (tierEnd - tierStart)) : 1;
  const pointsToNext = nextTier ? nextTier.min - points : 0;

  const handleRedeem = () => {
    Alert.alert('Riscatta punti', 'Funzione in arrivo');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Programma Fedeltà</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Saldo punti */}
        <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={styles.balanceLabel}>Il tuo saldo</Text>
              <Text style={styles.balanceValue}>{points} punti</Text>
              <Text style={styles.balanceSub}>Equivalgono a € {(points / 100).toFixed(2)} di sconto</Text>
            </View>
            <View style={[styles.tierBadge, { borderColor: tier.color }]}>
              <Ionicons name={tier.icon as any} size={18} color={tier.color} />
              <Text style={[styles.tierBadgeText, { color: tier.color }]}>{tier.label}</Text>
            </View>
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {nextTier
                ? `Ancora ${pointsToNext} pt per il livello ${nextTier.label}`
                : 'Hai raggiunto il livello massimo 🎉'}
            </Text>
          </View>
        </LinearGradient>

        {/* Livelli */}
        <Text style={styles.sectionTitle}>Livelli fedeltà</Text>
        <View style={styles.sectionCard}>
          {TIERS.map((t, idx) => {
            const reached = points >= t.min;
            const isCurrent = t.key === tier.key;
            return (
              <View key={t.key} style={[styles.tierRow, idx < TIERS.length - 1 && styles.tierRowBorder]}>
                <View style={[styles.tierIcon, { backgroundColor: `${t.color}1A` }]}>
                  <Ionicons name={t.icon as any} size={20} color={t.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tierName}>{t.label}</Text>
                  <Text style={styles.tierRange}>
                    {t.max === Infinity ? `${t.min}+ pt` : `${t.min}–${t.max} pt`}
                  </Text>
                </View>
                {isCurrent ? (
                  <View style={styles.currentPill}><Text style={styles.currentPillText}>Attuale</Text></View>
                ) : reached ? (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                ) : (
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.muted} />
                )}
              </View>
            );
          })}
        </View>

        {/* Come guadagnare punti */}
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

        {/* Riscatta */}
        <TouchableOpacity style={styles.redeemBtn} onPress={handleRedeem} activeOpacity={0.85}>
          <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.redeemGradient}>
            <MaterialCommunityIcons name="star-circle" size={20} color={Colors.text} />
            <Text style={styles.redeemText}>Riscatta punti</Text>
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

  balanceCard:    { margin: 16, borderRadius: 20, padding: 20, gap: 18 },
  balanceTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  balanceLabel:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 },
  balanceValue:   { color: Colors.text, fontSize: 28, fontWeight: '900' },
  balanceSub:     { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
  tierBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  tierBadgeText:  { fontWeight: '800', fontSize: 13 },
  progressWrap:   { gap: 8 },
  progressBar:    { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 },
  progressFill:   { height: 6, backgroundColor: Colors.text, borderRadius: 3 },
  progressText:   { color: 'rgba(255,255,255,0.85)', fontSize: 12 },

  sectionTitle:   { color: Colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginHorizontal: 20, marginTop: 20, marginBottom: 10 },
  sectionCard:    { marginHorizontal: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden' },

  tierRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  tierRowBorder:  { borderBottomWidth: 1, borderBottomColor: Colors.border },
  tierIcon:       { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tierName:       { color: Colors.text, fontSize: 15, fontWeight: '700' },
  tierRange:      { color: Colors.muted, fontSize: 12, marginTop: 2 },
  currentPill:    { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  currentPillText:{ color: Colors.text, fontSize: 12, fontWeight: '700' },

  earnRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  earnRowBorder:  { borderBottomWidth: 1, borderBottomColor: Colors.border },
  earnIcon:       { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  earnLabel:      { color: Colors.text, fontSize: 14, fontWeight: '500', flex: 1 },
  earnPts:        { color: Colors.warning, fontWeight: '700', fontSize: 14 },

  redeemBtn:      { marginHorizontal: 16, marginTop: 20, borderRadius: 16, overflow: 'hidden' },
  redeemGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  redeemText:     { color: Colors.text, fontSize: 16, fontWeight: '700' },
});
