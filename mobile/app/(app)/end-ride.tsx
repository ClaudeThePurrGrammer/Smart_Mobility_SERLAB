import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';

const TAGS = [
  { id: 'ostacolo', icon: 'warning-outline', label: 'Ostacolo' },
  { id: 'danno',    icon: 'bicycle',         label: 'Veicolo danneggiato' },
  { id: 'parking',  icon: 'car-outline',     label: 'Parcheggio pieno' },
  { id: 'altro',    icon: 'ellipsis-horizontal', label: 'Altro' },
] as const;

export default function EndRideScreen() {
  const [rating, setRating] = useState(0);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.successHeader}>
        <View style={styles.checkCircle}>
          <LinearGradient colors={Gradients.primary} style={styles.checkGradient}>
            <Ionicons name="checkmark" size={32} color={Colors.text} />
          </LinearGradient>
        </View>
        <Text style={styles.successTitle}>Corsa terminata!</Text>
        <Text style={styles.successSub}>Grazie per aver scelto Smart Mobility</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <MaterialCommunityIcons name="map-marker-distance" size={16} color={Colors.muted} />
          <Text style={styles.statLabel}>Distanza</Text>
          <Text style={styles.statValue}>2,4 km</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="time-outline" size={16} color={Colors.muted} />
          <Text style={styles.statLabel}>Tempo totale</Text>
          <Text style={styles.statValue}>12 min</Text>
        </View>
        <View style={styles.stat}>
          <MaterialCommunityIcons name="currency-eur" size={16} color={Colors.muted} />
          <Text style={styles.statLabel}>Costo finale</Text>
          <Text style={[styles.statValue, { color: Colors.accent }]}>€ 3,60</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="star-outline" size={16} color={Colors.muted} />
          <Text style={styles.statLabel}>Punti guadagnati</Text>
          <Text style={[styles.statValue, { color: Colors.warning }]}>+18 pt</Text>
        </View>
      </View>

      <View style={styles.mapCard}>
        <LinearGradient colors={['#13132A', '#1A1A35']} style={styles.mapPlaceholder}>
          <View style={styles.parkingMarker}>
            <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 12 }}>P</Text>
          </View>
          <View style={[styles.parkingMarker, { top: 60, right: 50, backgroundColor: Colors.success }]}>
            <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 12 }}>P</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.dotEnd}>
            <Ionicons name="locate" size={16} color={Colors.accent} />
          </View>
        </LinearGradient>

        <View style={styles.legend}>
          {[
            { color: Colors.warning, label: 'No-parking' },
            { color: '#a855f7', label: 'Zona pedonale' },
            { color: Colors.muted, label: 'Area privata' },
            { color: Colors.danger, label: 'Zona vietata' },
          ].map(l => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.warningCard}>
        <Ionicons name="warning" size={20} color={Colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={styles.warningTitle}>Ricorda di parcheggiare</Text>
          <Text style={styles.warningText}>Parcheggia in un'area consentita per evitare penalità.</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="location-outline" size={16} color={Colors.accent} />
          <Text style={{ color: Colors.accent, fontSize: 10 }}>Vedi aree</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Segnala un problema</Text>
          <Text style={styles.sectionSub}>Aiutaci a migliorare il servizio</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 12 }}>
          {TAGS.map(tag => (
            <TouchableOpacity
              key={tag.id}
              onPress={() => setSelectedTag(tag.id === selectedTag ? null : tag.id)}
              style={[styles.tag, selectedTag === tag.id && styles.tagActive]}
            >
              <Ionicons name={tag.icon as any} size={14} color={selectedTag === tag.id ? Colors.text : Colors.muted} />
              <Text style={[styles.tagText, selectedTag === tag.id && { color: Colors.text }]}>{tag.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.paymentCard}>
        <Text style={styles.paymentLabel}>Metodo di pagamento</Text>
        <View style={styles.paymentRow}>
          <View style={styles.visaBox}><Text style={styles.visaText}>VISA</Text></View>
          <Text style={{ color: Colors.text, fontSize: 14, flex: 1 }}>Visa •••• 4242</Text>
          <TouchableOpacity>
            <Text style={{ color: Colors.accent, fontSize: 13 }}>← Cambia metodo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.ratingCard}>
        <View style={styles.vehicleRow}>
          <MaterialCommunityIcons name="scooter" size={26} color={Colors.accent} />
          <View>
            <Text style={{ color: Colors.text, fontWeight: '700' }}>Monopattino</Text>
            <Text style={{ color: Colors.muted, fontSize: 12 }}>Flash F2</Text>
          </View>
        </View>
        <Text style={{ color: Colors.text, fontWeight: '600', marginBottom: 8 }}>Valuta la corsa</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map(s => (
            <TouchableOpacity key={s} onPress={() => setRating(s)}>
              <FontAwesome
                name={s <= rating ? 'star' : 'star-o'}
                size={30}
                color={s <= rating ? Colors.warning : Colors.border}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.homeBtn}
        onPress={() => router.replace('/(app)')}
      >
        <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.homeBtnGradient}>
          <Ionicons name="home-outline" size={18} color={Colors.text} />
          <Text style={styles.homeBtnText}>Torna alla home</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  successHeader:  { alignItems: 'center', paddingTop: 60, paddingBottom: 24, gap: 8 },
  checkCircle:    { marginBottom: 4 },
  checkGradient:  { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  successTitle:   { color: Colors.text, fontSize: 24, fontWeight: '800' },
  successSub:     { color: Colors.muted, fontSize: 14 },
  statsRow:       { flexDirection: 'row', marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  stat:           { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  statLabel:      { color: Colors.muted, fontSize: 10, textAlign: 'center' },
  statValue:      { color: Colors.text, fontWeight: '800', fontSize: 14 },
  mapCard:        { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  mapPlaceholder: { height: 140, justifyContent: 'center', alignItems: 'center' },
  parkingMarker:  { position: 'absolute', top: 30, left: 40, width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  routeLine:      { position: 'absolute', width: 2, height: 70, backgroundColor: Colors.accent, transform: [{ rotate: '25deg' }] },
  dotEnd:         { position: 'absolute', bottom: 20, right: 60 },
  legend:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: Colors.card },
  legendItem:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:      { width: 10, height: 10, borderRadius: 2 },
  legendText:     { color: Colors.muted, fontSize: 11 },
  warningCard:    { marginHorizontal: 16, backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: Colors.warning, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  warningTitle:   { color: Colors.text, fontWeight: '700', fontSize: 14 },
  warningText:    { color: Colors.muted, fontSize: 12, lineHeight: 18 },
  section:        { marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 16 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle:   { color: Colors.text, fontWeight: '700', fontSize: 15 },
  sectionSub:     { color: Colors.muted, fontSize: 12 },
  tag:            { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  tagActive:      { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.2)' },
  tagText:        { color: Colors.muted, fontSize: 13 },
  paymentCard:    { marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 16 },
  paymentLabel:   { color: Colors.muted, fontSize: 13, marginBottom: 10 },
  paymentRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  visaBox:        { backgroundColor: '#1A1F71', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  visaText:       { color: Colors.text, fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  ratingCard:     { marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 10, marginBottom: 16 },
  vehicleRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stars:          { flexDirection: 'row', gap: 8 },
  homeBtn:        { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  homeBtnGradient:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  homeBtnText:    { color: Colors.text, fontWeight: '700', fontSize: 16 },
});
