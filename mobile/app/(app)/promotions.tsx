import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';

const ACTIVE_PROMO = {
  code: 'SMART2025',
  discount: '3 corse gratuite',
  expiry: '31 maggio 2025',
  used: 1,
  total: 3,
};

const PROMOS = [
  { id: '1', icon: 'people-outline',    title: 'Invita un amico',       body: 'Per ogni amico che si registra con il tuo codice ottieni 2 corse gratis.',    reward: '+2 corse',    color: Colors.accent },
  { id: '2', icon: 'sunny-outline',     title: 'Weekend rider',         body: 'Ogni sabato e domenica il primo sblocco è gratuito per tutto maggio.',         reward: 'Gratis',      color: Colors.warning },
  { id: '3', icon: 'flash-outline',     title: 'Prima corsa gratis',    body: 'La tua primissima corsa è completamente gratuita. Nessun limite di distanza.',  reward: '1 corsa free', color: Colors.success },
  { id: '4', icon: 'trophy-outline',    title: 'Fedeltà Gold',          body: 'Raggiungi 50 corse e ottieni lo status Gold con il 10% di sconto permanente.',  reward: '-10%',        color: '#F59E0B' },
];

const POINTS_ACTIONS = [
  { icon: 'bicycle-outline',   label: 'Per ogni corsa',         pts: '+10 pt' },
  { icon: 'leaf-outline',      label: 'Corsa eco (>2km)',        pts: '+5 pt'  },
  { icon: 'person-add-outline',label: 'Referral amico',          pts: '+50 pt' },
  { icon: 'star-outline',      label: 'Valutazione 5 stelle',    pts: '+3 pt'  },
];

export default function PromotionsScreen() {
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
        <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activeCard}>
          <View style={styles.activeTop}>
            <View>
              <Text style={styles.activeLabel}>Codice attivo</Text>
              <Text style={styles.activeCode}>{ACTIVE_PROMO.code}</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>{ACTIVE_PROMO.discount}</Text>
            </View>
          </View>
          <View style={styles.activeProgress}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(ACTIVE_PROMO.used / ACTIVE_PROMO.total) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{ACTIVE_PROMO.used}/{ACTIVE_PROMO.total} usate · Scade il {ACTIVE_PROMO.expiry}</Text>
          </View>
        </LinearGradient>

        {/* Points balance */}
        <View style={styles.pointsCard}>
          <MaterialCommunityIcons name="star-circle" size={32} color={Colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pointsValue}>430 punti</Text>
            <Text style={styles.pointsLabel}>Equivalgono a € 4,30 di sconto</Text>
          </View>
          <TouchableOpacity style={styles.useBtn}>
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
        <Text style={styles.sectionTitle}>Offerte disponibili</Text>
        {PROMOS.map(p => (
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

        {/* Enter code */}
        <TouchableOpacity style={styles.codeBtn}>
          <Ionicons name="pricetag-outline" size={20} color={Colors.accent} />
          <Text style={styles.codeBtnText}>Hai un codice promozionale?</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
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
});
