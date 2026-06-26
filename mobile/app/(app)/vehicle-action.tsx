/**
 * VehicleActionScreen — schermata di scelta avvio corsa.
 *
 * L'utente arriva qui dopo aver selezionato un mezzo sulla mappa.
 * Può scegliere come avviare fisicamente la corsa:
 *   1. Prenota (sblocco remoto via app)
 *   2. Scansiona QR (codice fisico sul mezzo)
 *   3. Inserisci codice manualmente
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { vehiclesApi, ridesApi } from '@/lib/api/endpoints';
import { vehicleTypeLabel, vehicleIcon } from '@/lib/vehicles';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRideSession } from '@/lib/ride/RideSessionContext';
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

  const { token } = useAuth();
  const { startSession } = useRideSession();

  const [vehicle, setVehicle] = useState<ApiVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeVisible, setCodeVisible] = useState(false);
  const [code, setCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleId) { setLoading(false); return; }
    vehiclesApi.get(Number(vehicleId))
      .then(setVehicle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vehicleId]);

  const batteryColor = (pct: number) =>
    pct > 50 ? Colors.success : pct > 20 ? Colors.warning : Colors.danger;

  /** Avvia la corsa con un codice testuale (es. "SM-42" o "42"). */
  const handleActivateCode = async () => {
    const match = code.match(/\d+/);
    if (!match) { setError('Codice non valido. Usa il formato SM-42 o inserisci solo il numero.'); return; }
    const vid = Number(match[0]);
    if (!token) return;
    setActivating(true);
    setError(null);
    try {
      const v = await vehiclesApi.get(vid);
      if (v.status !== 'available') {
        setError('Questo mezzo non è disponibile al momento.');
        return;
      }
      const ride = await ridesApi.start(token, {
        vehicle_id: v.id,
        vehicle_type: v.type,
        from_addr: 'Posizione attuale',
      });
      startSession(ride);
      router.replace({
        pathname: '/(app)/active-ride',
        params: {
          rideId: String(ride.id),
          vehicleId: String(v.id),
          ...(fromLat && fromLng ? { fromLat, fromLng } : {}),
        },
      });
    } catch (e: any) {
      setError(e?.message ?? 'Impossibile attivare la corsa. Verifica il codice e riprova.');
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  const vtype = (vehicle?.type ?? 'scooter') as VehicleType;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
                // Ripassa invariata la destinazione ricevuta dalla Home (se presente).
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

        {/* Opzione 2 — Scansiona QR */}
        <TouchableOpacity
          style={styles.optionCard}
          activeOpacity={0.82}
          onPress={() => router.push('/(app)/scan')}
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

        {/* Opzione 3 — Codice manuale (espandibile) */}
        <TouchableOpacity
          style={styles.optionCard}
          activeOpacity={0.82}
          onPress={() => setCodeVisible(v => !v)}
        >
          <View style={styles.optionGradient}>
            <View style={[styles.optionIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <Ionicons name="keypad-outline" size={26} color={Colors.warning} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.optionTitle}>Inserisci codice</Text>
              <Text style={styles.optionSub}>
                Digita il codice alfanumerico presente sul mezzo (es. SM-42).
              </Text>
            </View>
            <Ionicons
              name={codeVisible ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.warning}
            />
          </View>
        </TouchableOpacity>

        {/* Input codice espandibile */}
        {codeVisible && (
          <View style={styles.codePanel}>
            <TextInput
              style={styles.codeInput}
              placeholder="SM-42 oppure solo 42"
              placeholderTextColor={Colors.muted}
              value={code}
              onChangeText={(t) => { setCode(t); setError(null); }}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType="default"
              returnKeyType="done"
              onSubmitEditing={handleActivateCode}
            />
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            <TouchableOpacity
              style={[styles.activateBtn, (!code.trim() || activating) && { opacity: 0.5 }]}
              onPress={handleActivateCode}
              disabled={!code.trim() || activating}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.activateBtnInner}
              >
                {activating
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Ionicons name="flash" size={18} color="#000" />}
                <Text style={styles.activateBtnText}>
                  {activating ? 'Attivazione...' : 'Attiva corsa'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Link ai codici di test */}
            <TouchableOpacity
              style={styles.testCodesLink}
              onPress={() => router.push('/(app)/activate')}
              activeOpacity={0.7}
            >
              <Ionicons name="qr-code-outline" size={14} color={Colors.accent} />
              <Text style={styles.testCodesLinkText}>Vedi codici QR di test disponibili</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
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

  codePanel:       { marginHorizontal: 16, marginBottom: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 16, gap: 12 },
  codeInput:       { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: Colors.text, fontSize: 18, fontWeight: '700', letterSpacing: 2, textAlign: 'center' },
  errorText:       { color: Colors.danger, fontSize: 13, textAlign: 'center' },
  activateBtn:     { borderRadius: 14, overflow: 'hidden' },
  activateBtnInner:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  activateBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  testCodesLink:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  testCodesLinkText:{ color: Colors.accent, fontSize: 13, fontWeight: '500' },
});
