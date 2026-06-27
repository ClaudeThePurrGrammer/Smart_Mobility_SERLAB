// app/(app)/active-reservation.tsx
// Schermata di attesa durante una prenotazione attiva (10 min di countdown).
// Consente di sbloccare subito il mezzo o annullare la prenotazione.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { useReservationSession } from '@/lib/reservation/ReservationSessionContext';
import { reservationsApi } from '@/lib/api/endpoints';
import { vehicleIcon, vehicleTypeLabel } from '@/lib/vehicles';

const RESERVATION_MAX_SEC = 600; // 10 minuti

export default function ActiveReservationScreen() {
  const {
    reservationId, vehicleId, vehicleType, vehicleName, vehicleModel, batteryPct,
    oraScadenza, fromLat, fromLng, toAddr, toLat, toLng,
  } = useLocalSearchParams<{
    reservationId?: string; vehicleId?: string; vehicleType?: string;
    vehicleName?: string; vehicleModel?: string; batteryPct?: string;
    oraScadenza?: string; fromLat?: string; fromLng?: string;
    toAddr?: string; toLat?: string; toLng?: string;
  }>();

  const { token } = useAuth();
  const { clearReservation } = useReservationSession();

  // Lazy init: calcola il residuo reale già al primo render (evita il flash "10:00").
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    oraScadenza
      ? Math.max(0, Math.floor((new Date(oraScadenza).getTime() - Date.now()) / 1000))
      : RESERVATION_MAX_SEC
  );
  const secondsRef = useRef(secondsRemaining);
  const [cancelling, setCancelling] = useState(false);
  const [starting, setStarting] = useState(false);

  // Reset stati UI ogni volta che cambia la prenotazione (es. seconda prenotazione
  // dopo una corsa terminata — lo screen rimane montato in memoria dai Tabs).
  useEffect(() => {
    setStarting(false);
    setCancelling(false);
  }, [reservationId]);

  // Blocca il tasto hardware back su Android.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // Ref stabile per handleExpired: il setInterval cattura il ref e chiama
  // sempre la versione più recente, evitando stale closures su token/clearReservation.
  const handleExpiredRef = useRef<() => void>(() => {});

  const handleExpired = useCallback(async () => {
    if (token && reservationId) {
      try { await reservationsApi.cancel(token, Number(reservationId)); } catch {}
    }
    clearReservation();
    router.replace('/(app)/');
  }, [token, reservationId, clearReservation]);

  useEffect(() => {
    handleExpiredRef.current = handleExpired;
  }, [handleExpired]);

  // Countdown: ricalcola da ora_scadenza reale a ogni tick per resistere a
  // background throttling e re-mount da navigazione banner → schermata.
  useEffect(() => {
    if (!oraScadenza) return;

    const calcRemaining = () =>
      Math.max(0, Math.floor((new Date(oraScadenza).getTime() - Date.now()) / 1000));

    const initial = calcRemaining();
    setSecondsRemaining(initial);
    secondsRef.current = initial;

    if (initial <= 0) {
      handleExpiredRef.current();
      return;
    }

    const t = setInterval(() => {
      const remaining = calcRemaining();
      secondsRef.current = remaining;
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(t);
        handleExpiredRef.current();
      }
    }, 1000);

    return () => clearInterval(t);
  }, [oraScadenza]);

  const handleCancel = async () => {
    if (cancelling || starting) return;
    setCancelling(true);
    if (token && reservationId) {
      try { await reservationsApi.cancel(token, Number(reservationId)); } catch {}
    }
    clearReservation();
    router.replace('/(app)/');
  };

  // Sblocca ora → porta l'utente alla scansione QR / inserimento codice.
  // La corsa NON parte direttamente: richiede conferma fisica tramite QR o codice.
  const handleUnlock = () => {
    if (cancelling) return;
    router.push({
      pathname: '/(app)/activate',
      params: {
        prefill: vehicleId ? `SM-${vehicleId}` : '',
        reservationId: reservationId ?? '',
        ...(fromLat && fromLng ? { fromLat, fromLng } : {}),
        ...(toAddr ? { toAddr } : {}),
        ...(toLat && toLng ? { toLat, toLng } : {}),
      },
    });
  };

  const mm = String(Math.floor(secondsRemaining / 60)).padStart(2, '0');
  const ss = String(secondsRemaining % 60).padStart(2, '0');
  const isUrgent = secondsRemaining <= 60;
  const isCritical = secondsRemaining <= 30;
  const countdownColor = isCritical ? Colors.danger : isUrgent ? Colors.warning : Colors.accent;
  const batteryNum = Number(batteryPct ?? 100);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Prenotazione attiva</Text>
        <TouchableOpacity onPress={handleCancel} style={styles.closeBtn} disabled={cancelling || starting} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={Colors.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Card veicolo */}
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIconBox}>
            <MaterialCommunityIcons
              name={vehicleIcon[(vehicleType ?? 'scooter') as keyof typeof vehicleIcon] as any}
              size={32}
              color={Colors.accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleName}>{vehicleName ?? vehicleTypeLabel[(vehicleType ?? 'scooter') as keyof typeof vehicleTypeLabel]}</Text>
            {vehicleModel ? <Text style={styles.vehicleModel}>{vehicleModel}</Text> : null}
          </View>
          {batteryPct ? (
            <View style={styles.batteryPill}>
              <Ionicons
                name="battery-half"
                size={14}
                color={batteryNum > 50 ? Colors.success : Colors.warning}
              />
              <Text style={[styles.batteryText, { color: batteryNum > 50 ? Colors.success : Colors.warning }]}>
                {batteryPct}%
              </Text>
            </View>
          ) : null}
        </View>

        {/* Countdown */}
        <View style={styles.countdownCard}>
          <Text style={styles.countdownLabel}>Tempo rimanente per sbloccare</Text>
          <Text style={[styles.countdownValue, { color: countdownColor }]}>{mm}:{ss}</Text>
          {isUrgent && (
            <Text style={[styles.countdownWarning, isCritical && { color: Colors.danger }]}>
              {isCritical ? '⚠ Prenotazione in scadenza!' : 'Meno di un minuto rimasto'}
            </Text>
          )}
          <View style={styles.countdownBar}>
            <View style={[styles.countdownBarFill, {
              width: `${Math.min(100, (secondsRemaining / RESERVATION_MAX_SEC) * 100)}%` as any,
              backgroundColor: countdownColor,
            }]} />
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.muted} />
          <Text style={styles.infoText}>
            Il mezzo sarà rilasciato allo scadere del timer. Premi «Sblocca ora» per avviare subito la corsa.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={handleUnlock}
          disabled={cancelling}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#10b981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startBtnGradient}
          >
            <Ionicons name="qr-code-outline" size={20} color={Colors.text} />
            <Text style={styles.startBtnText}>Scansiona / Inserisci codice</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleCancel}
          disabled={cancelling || starting}
          activeOpacity={0.85}
        >
          {cancelling
            ? <ActivityIndicator color={Colors.danger} />
            : <Text style={styles.cancelBtnText}>Annulla prenotazione</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.bg },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle:      { color: Colors.text, fontSize: 17, fontWeight: '800' },
  closeBtn:         { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },

  content:          { padding: 16, gap: 14, paddingBottom: 24 },

  vehicleCard:      { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIconBox:   { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  vehicleName:      { color: Colors.text, fontWeight: '700', fontSize: 15 },
  vehicleModel:     { color: Colors.muted, fontSize: 12, marginTop: 2 },
  batteryPill:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  batteryText:      { fontSize: 13, fontWeight: '700' },

  countdownCard:    { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 24, alignItems: 'center', gap: 10 },
  countdownLabel:   { color: Colors.muted, fontSize: 13 },
  countdownValue:   { fontSize: 56, fontWeight: '900', letterSpacing: 2 },
  countdownWarning: { color: Colors.warning, fontSize: 13, fontWeight: '600' },
  countdownBar:     { width: '100%', height: 6, backgroundColor: Colors.surface, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  countdownBarFill: { height: '100%', borderRadius: 3 },

  infoCard:         { backgroundColor: Colors.surface, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoText:         { color: Colors.muted, fontSize: 13, flex: 1, lineHeight: 18 },

  footer:           { padding: 16, paddingBottom: 36, gap: 10, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.card },
  startBtn:         { borderRadius: 16, overflow: 'hidden' },
  startBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  startBtnText:     { color: Colors.text, fontSize: 16, fontWeight: '700' },
  cancelBtn:        { alignItems: 'center', paddingVertical: 12, borderWidth: 1, borderColor: Colors.danger, borderRadius: 16 },
  cancelBtnText:    { color: Colors.danger, fontSize: 15, fontWeight: '600' },
});
