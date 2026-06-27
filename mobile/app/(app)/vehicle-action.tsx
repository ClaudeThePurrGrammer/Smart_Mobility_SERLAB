/**
 * VehicleActionScreen — schermata di scelta avvio corsa.
 *
 * L'utente arriva qui dopo aver selezionato un mezzo sulla mappa.
 * Può scegliere come avviare fisicamente la corsa:
 *   1. Prenota (sblocco remoto via app)
 *   2. Scansiona QR → activate.tsx (scanner + preview)
 *   3. Inserisci codice → activate.tsx in modalità manuale + preview
 *
 * Tutte le opzioni che richiedono il codice passano per activate.tsx
 * che gestisce validazione, verifica mezzo e schermata di riepilogo
 * prima di avviare effettivamente la corsa.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { vehiclesApi } from '@/lib/api/endpoints';
import { vehicleTypeLabel, vehicleIcon } from '@/lib/vehicles';
import type { ApiVehicle } from '@/lib/api/types';
import type { VehicleType } from '@/components/ui/VehicleCard';

export default function VehicleActionScreen() {
  const params = useLocalSearchParams<{
    vehicleId?: string;
    fromLat?: string;
    fromLng?: string;
    toAddr?: string;
    toLat?: string;
    toLng?: string;
  }>();
  const { vehicleId, fromLat, fromLng, toAddr, toLat, toLng } = params;

  const [vehicle, setVehicle] = useState<ApiVehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId) { setLoading(false); return; }
    vehiclesApi.get(Number(vehicleId))
      .then(setVehicle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vehicleId]);

  const batteryColor = (pct: number) =>
    pct > 50 ? Colors.success : pct > 20 ? Colors.warning : Colors.danger;

  /** Params comuni da passare ad activate.tsx */
  const activateParams = () => ({
    prefill: `SM-${vehicleId}`,
    ...(fromLat && fromLng ? { fromLat, fromLng } : {}),
    ...(toAddr && toLat && toLng ? { toAddr, toLat, toLng } : {}),
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  const vtype = (vehicle?.type ?? 'scooter') as VehicleType;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={['#1A0A2E', '#0D0D1A']} style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Avvia corsa</Text>
          <View style={{ width: 38 }} />
        </LinearGradient>

        {/* Scheda veicolo */}
        {vehicle ? (
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleIconBox}>
              <MaterialCommunityIcons
                name={vehicleIcon[vtype] as any}
                size={36}
                color={Colors.accent}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.vehicleName}>{vehicle.name}</Text>
              <Text style={styles.vehicleModel}>{vehicleTypeLabel[vtype]} · {vehicle.model}</Text>
              <View style={styles.vehicleMeta}>
                <Ionicons name="battery-half" size={14} color={batteryColor(vehicle.battery_pct)} />
                <Text style={[styles.metaText, { color: batteryColor(vehicle.battery_pct) }]}>
                  {vehicle.battery_pct}%
                </Text>
                <Text style={styles.metaDot}>·</Text>
                <MaterialCommunityIcons name="currency-eur" size={13} color={Colors.muted} />
                <Text style={styles.metaText}>
                  {vehicle.unlock_fee.toFixed(2)} sblocco + {vehicle.price_per_min.toFixed(2)}/min
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.vehicleCard}>
            <Ionicons name="help-circle-outline" size={36} color={Colors.muted} />
            <Text style={[styles.vehicleName, { color: Colors.muted }]}>Mezzo non trovato</Text>
          </View>
        )}

        {/* Sezione scelta */}
        <Text style={styles.sectionLabel}>COME VUOI AVVIARE LA CORSA?</Text>

        {/* Opzione 1 — Prenota (sblocco remoto) */}
        <TouchableOpacity
          style={styles.optionCard}
          activeOpacity={0.82}
          onPress={() =>
            router.push({
              pathname: '/(app)/reserve',
              params: {
                vehicleId: vehicleId ?? '',
                ...(fromLat && fromLng ? { fromLat, fromLng } : {}),
                ...(toAddr && toLat && toLng ? { toAddr, toLat, toLng } : {}),
              },
            })
          }
        >
          <LinearGradient
            colors={['rgba(124,58,237,0.18)', 'rgba(124,58,237,0.08)']}
            style={styles.optionGradient}
          >
            <View style={[styles.optionIcon, { backgroundColor: 'rgba(124,58,237,0.25)' }]}>
              <Ionicons name="lock-open-outline" size={26} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.optionTitle}>Prenota</Text>
              <Text style={styles.optionSub}>
                Sblocca il mezzo da remoto direttamente dall'app. Nessun codice necessario.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Opzione 2 — Scansiona QR → activate.tsx scanner step */}
        <TouchableOpacity
          style={styles.optionCard}
          activeOpacity={0.82}
          onPress={() =>
            router.push({
              pathname: '/(app)/activate',
              params: activateParams(),
            })
          }
        >
          <LinearGradient
            colors={['rgba(34,197,94,0.15)', 'rgba(34,197,94,0.06)']}
            style={styles.optionGradient}
          >
            <View style={[styles.optionIcon, { backgroundColor: 'rgba(34,197,94,0.2)' }]}>
              <MaterialCommunityIcons name="qrcode-scan" size={26} color={Colors.success} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.optionTitle}>Scansiona QR</Text>
              <Text style={styles.optionSub}>
                Inquadra il codice QR fisico presente sul mezzo per avviare la corsa.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.success} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Opzione 3 — Codice manuale → activate.tsx manual step */}
        <TouchableOpacity
          style={styles.optionCard}
          activeOpacity={0.82}
          onPress={() =>
            router.push({
              pathname: '/(app)/activate',
              params: { ...activateParams(), startMode: 'manual' },
            })
          }
        >
          <LinearGradient
            colors={['rgba(245,158,11,0.15)', 'rgba(245,158,11,0.06)']}
            style={styles.optionGradient}
          >
            <View style={[styles.optionIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <Ionicons name="keypad-outline" size={26} color={Colors.warning} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.optionTitle}>Inserisci codice</Text>
              <Text style={styles.optionSub}>
                Digita il codice alfanumerico presente sul mezzo (es. SM-{vehicleId ?? '42'}).
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.warning} />
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.bg },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:         { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:     { color: Colors.text, fontSize: 18, fontWeight: '800' },

  vehicleCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, margin: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 16 },
  vehicleIconBox:  { width: 60, height: 60, borderRadius: 16, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  vehicleName:     { color: Colors.text, fontWeight: '800', fontSize: 16 },
  vehicleModel:    { color: Colors.muted, fontSize: 13 },
  vehicleMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText:        { color: Colors.muted, fontSize: 12 },
  metaDot:         { color: Colors.border, fontSize: 12 },

  sectionLabel:    { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: 20, marginBottom: 8 },

  optionCard:      { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  optionGradient:  { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  optionIcon:      { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionTitle:     { color: Colors.text, fontWeight: '700', fontSize: 15 },
  optionSub:       { color: Colors.muted, fontSize: 12, lineHeight: 17 },
});
