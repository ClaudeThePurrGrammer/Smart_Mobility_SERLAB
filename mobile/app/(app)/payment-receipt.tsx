/**
 * PaymentReceiptScreen — ricevuta di pagamento post-corsa.
 *
 * Schermata full screen mostrata dopo il pagamento riuscito.
 * L'utente non può tornare indietro: l'unica azione è "Torna alla home".
 */
import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';

const METHOD_KIND_LABEL: Record<string, string> = {
  card:   'Carta di credito',
  apple:  'Apple Pay',
  paypal: 'PayPal',
};
const METHOD_ICON: Record<string, React.ReactNode> = {
  card:   <FontAwesome5 name="credit-card" size={18} color={Colors.accent} />,
  apple:  <FontAwesome5 name="apple-pay"   size={22} color={Colors.text}   />,
  paypal: <FontAwesome5 name="paypal"      size={18} color="#009CDE"       />,
};
const VEHICLE_LABEL: Record<string, string> = {
  scooter: 'Monopattino',
  ebike:   'Bici elettrica',
  car:     'Auto elettrica',
};
const VEHICLE_ICON: Record<string, string> = {
  scooter: 'scooter',
  ebike:   'bicycle-electric',
  car:     'car-electric',
};

export default function PaymentReceiptScreen() {
  const params = useLocalSearchParams<{
    cost?:        string;
    baseCost?:    string;
    discount?:    string;
    km?:          string;
    minutes?:     string;
    points?:      string;
    vehicleType?: string;
    areaName?:    string;
    promoTitle?:  string;
    methodKind?:  string;
    methodLast4?: string;
  }>();

  const cost       = Number(params.cost     ?? 0);
  const baseCost   = Number(params.baseCost ?? 0);
  const discount   = Number(params.discount ?? 0);
  const km         = Number(params.km       ?? 0);
  const minutes    = Number(params.minutes  ?? 0);
  const points     = Number(params.points   ?? 0);
  const hasDiscount = discount > 0;

  // Blocca il tasto back hardware: unica via d'uscita è il pulsante home
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // Numero ricevuta simulato (data + costo)
  const receiptNumber = `SM-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(cost * 100)}`;

  const dateLabel = new Date().toLocaleDateString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header successo ── */}
        <LinearGradient colors={['#0a1628', '#0d1f3c']} style={styles.heroSection}>
          <View style={styles.successCircle}>
            <LinearGradient
              colors={['rgba(34,197,94,0.25)', 'rgba(34,197,94,0.1)']}
              style={styles.successCircleInner}
            >
              <Ionicons name="checkmark" size={52} color={Colors.success} />
            </LinearGradient>
          </View>
          <Text style={styles.heroTitle}>Pagamento completato</Text>
          <Text style={styles.heroSub}>La tua corsa è stata conclusa con successo</Text>
          <Text style={styles.heroAmount}>€ {cost.toFixed(2).replace('.', ',')}</Text>
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Ionicons name="pricetag" size={13} color={Colors.success} />
              <Text style={styles.discountBadgeText}>
                Sconto applicato: -{discount.toFixed(2).replace('.', ',')} €
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* ── Corpo ricevuta ── */}
        <View style={styles.receiptBody}>

          {/* Numero ricevuta e data */}
          <View style={styles.receiptMeta}>
            <View>
              <Text style={styles.receiptMetaLabel}>N° ricevuta</Text>
              <Text style={styles.receiptMetaValue}>{receiptNumber}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.receiptMetaLabel}>Data e ora</Text>
              <Text style={styles.receiptMetaValue}>{dateLabel}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Dettagli viaggio */}
          <Text style={styles.sectionTitle}>Dettagli viaggio</Text>

          <View style={styles.card}>
            {params.vehicleType ? (
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <MaterialCommunityIcons
                    name={(VEHICLE_ICON[params.vehicleType] ?? 'car') as any}
                    size={20}
                    color={Colors.accent}
                  />
                </View>
                <Text style={styles.rowLabel}>Veicolo</Text>
                <Text style={styles.rowValue}>
                  {VEHICLE_LABEL[params.vehicleType] ?? params.vehicleType}
                </Text>
              </View>
            ) : null}

            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name="map-outline" size={18} color={Colors.accent} />
              </View>
              <Text style={styles.rowLabel}>Distanza</Text>
              <Text style={styles.rowValue}>{km.toFixed(1).replace('.', ',')} km</Text>
            </View>

            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name="time-outline" size={18} color={Colors.accent} />
              </View>
              <Text style={styles.rowLabel}>Durata</Text>
              <Text style={styles.rowValue}>{minutes} min</Text>
            </View>

            {params.areaName ? (
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="location-outline" size={18} color={Colors.accent} />
                </View>
                <Text style={styles.rowLabel}>Parcheggio</Text>
                <Text style={styles.rowValue} numberOfLines={1}>{params.areaName}</Text>
              </View>
            ) : null}
          </View>

          {/* Dettagli costo */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Dettagli pagamento</Text>

          <View style={styles.card}>
            {hasDiscount && (
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="cash-outline" size={18} color={Colors.muted} />
                </View>
                <Text style={styles.rowLabel}>Importo originale</Text>
                <Text style={[styles.rowValue, { textDecorationLine: 'line-through', color: Colors.muted }]}>
                  € {baseCost.toFixed(2).replace('.', ',')}
                </Text>
              </View>
            )}

            {hasDiscount && params.promoTitle ? (
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="pricetag-outline" size={18} color={Colors.success} />
                </View>
                <Text style={[styles.rowLabel, { color: Colors.success }]}>{params.promoTitle}</Text>
                <Text style={[styles.rowValue, { color: Colors.success }]}>
                  -{discount.toFixed(2).replace('.', ',')} €
                </Text>
              </View>
            ) : null}

            {params.methodKind ? (
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  {METHOD_ICON[params.methodKind] ?? <Ionicons name="card-outline" size={18} color={Colors.accent} />}
                </View>
                <Text style={styles.rowLabel}>Pagato con</Text>
                <Text style={styles.rowValue}>
                  {METHOD_KIND_LABEL[params.methodKind] ?? params.methodKind}
                  {params.methodLast4 ? `  ●●●● ${params.methodLast4}` : ''}
                </Text>
              </View>
            ) : null}

            <View style={[styles.row, styles.totalRow]}>
              <View style={styles.rowIcon}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              </View>
              <Text style={styles.totalLabel}>Totale pagato</Text>
              <Text style={styles.totalValue}>€ {cost.toFixed(2).replace('.', ',')}</Text>
            </View>
          </View>

          {/* Punti guadagnati */}
          {points > 0 && (
            <View style={styles.pointsBanner}>
              <LinearGradient
                colors={['rgba(234,179,8,0.15)', 'rgba(234,179,8,0.05)']}
                style={styles.pointsBannerInner}
              >
                <Ionicons name="star" size={22} color={Colors.warning} />
                <View>
                  <Text style={styles.pointsTitle}>+{points} punti guadagnati!</Text>
                  <Text style={styles.pointsSub}>Continua a viaggiare per sbloccare premi</Text>
                </View>
              </LinearGradient>
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── CTA fisso in basso ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/(app)')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#7C3AED', '#4F8EF7']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.homeBtnGradient}
          >
            <Ionicons name="home" size={20} color={Colors.text} />
            <Text style={styles.homeBtnText}>Torna alla home</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: Colors.bg },

  // Hero
  heroSection:          { paddingTop: 72, paddingBottom: 32, alignItems: 'center', gap: 10, paddingHorizontal: 24 },
  successCircle:        { marginBottom: 8 },
  successCircleInner:   { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(34,197,94,0.4)' },
  heroTitle:            { color: Colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  heroSub:              { color: Colors.muted, fontSize: 14, textAlign: 'center' },
  heroAmount:           { color: Colors.text, fontSize: 42, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  discountBadge:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  discountBadgeText:    { color: Colors.success, fontSize: 13, fontWeight: '600' },

  // Body
  receiptBody:          { padding: 20, gap: 0 },
  receiptMeta:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  receiptMetaLabel:     { color: Colors.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  receiptMetaValue:     { color: Colors.text, fontSize: 13, fontWeight: '700' },
  divider:              { height: 1, backgroundColor: Colors.border, marginBottom: 20 },
  sectionTitle:         { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },

  // Card rows
  card:                 { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, overflow: 'hidden', marginBottom: 4 },
  row:                  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon:              { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  rowLabel:             { color: Colors.muted, fontSize: 14, flex: 1 },
  rowValue:             { color: Colors.text, fontSize: 14, fontWeight: '600', maxWidth: '50%', textAlign: 'right' },
  totalRow:             { borderBottomWidth: 0, backgroundColor: 'rgba(34,197,94,0.05)' },
  totalLabel:           { color: Colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  totalValue:           { color: Colors.success, fontSize: 18, fontWeight: '900' },

  // Punti
  pointsBanner:         { marginTop: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(234,179,8,0.3)' },
  pointsBannerInner:    { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  pointsTitle:          { color: Colors.warning, fontSize: 15, fontWeight: '800' },
  pointsSub:            { color: Colors.muted, fontSize: 12, marginTop: 2 },

  // Footer
  footer:               { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 36, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border },
  homeBtn:              { borderRadius: 16, overflow: 'hidden' },
  homeBtnGradient:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  homeBtnText:          { color: Colors.text, fontWeight: '800', fontSize: 16 },
});
