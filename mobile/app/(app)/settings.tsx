import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { usersApi } from '@/lib/api/endpoints';
import type { ApiPreferences } from '@/lib/api/types';

const DEFAULT_PREFS: ApiPreferences = {
  notif_ride: true, notif_promo: true, notif_system: false, location_bg: true, biometric: false,
};

export default function SettingsScreen() {
  const { token, logout } = useAuth();
  const [prefs, setPrefs] = useState<ApiPreferences>(DEFAULT_PREFS);

  const pending = useRef<Partial<ApiPreferences>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carica le preferenze salvate.
  useEffect(() => {
    if (!token) return;
    usersApi.getPreferences(token).then(setPrefs).catch(() => {});
  }, [token]);

  // Pulisce il timer al unmount.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Aggiorna un toggle e salva sul backend con debounce di 800ms.
  const setPref = (key: keyof ApiPreferences, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    pending.current[key] = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const changes = pending.current;
      pending.current = {};
      if (token && Object.keys(changes).length) {
        try { setPrefs(await usersApi.updatePreferences(token, changes)); } catch { /* riprova al prossimo toggle */ }
      }
    }, 800);
  };

  const handleLogout = async () => { await logout(); router.replace('/(auth)/login'); };

  const section = (title: string, items: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{items}</View>
    </View>
  );

  const row = (
    icon: string, label: string, sub: string | null,
    right: React.ReactNode, onPress?: () => void, last?: boolean
  ) => (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon as any} size={20} color={Colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {right}
    </TouchableOpacity>
  );

  const toggle = (value: boolean, setter: (v: boolean) => void) => (
    <Switch
      value={value}
      onValueChange={setter}
      trackColor={{ false: Colors.border, true: Colors.primary }}
      thumbColor={Colors.text}
    />
  );

  const chevron = <Ionicons name="chevron-forward" size={18} color={Colors.muted} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Impostazioni</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {section('Notifiche', <>
          {row('bicycle-outline',      'Corse e veicoli',  'Aggiornamenti sulle tue corse', toggle(prefs.notif_ride, (v) => setPref('notif_ride', v)))}
          {row('gift-outline',         'Promozioni',       'Offerte e bonus esclusivi',     toggle(prefs.notif_promo, (v) => setPref('notif_promo', v)))}
          {row('information-circle-outline', 'Comunicazioni di sistema', 'Aggiornamenti e manutenzioni', toggle(prefs.notif_system, (v) => setPref('notif_system', v)), undefined, true)}
        </>)}

        {section('Privacy e sicurezza', <>
          {row('location-outline',  'Posizione in background', 'Necessaria per il tracciamento corse', toggle(prefs.location_bg, (v) => setPref('location_bg', v)))}
          {row('finger-print-outline', 'Accesso biometrico', 'Usa Face ID o impronta digitale', toggle(prefs.biometric, (v) => setPref('biometric', v)))}
          {row('lock-closed-outline', 'Cambia password', null, chevron, () => {})}
          {row('shield-outline',    'Autenticazione a due fattori', 'Aggiungi un livello di sicurezza', chevron, () => {}, true)}
        </>)}

        {section('Preferenze', <>
          {row('language-outline',  'Lingua',    'Italiano', chevron, () => {})}
          {row('phone-portrait-outline', 'Tema', 'Scuro',    chevron, () => {})}
          {row('map-outline',       'Unità di misura', 'Kilometri', chevron, () => {}, true)}
        </>)}

        {section('Informazioni', <>
          {row('document-text-outline', 'Termini di servizio', null, chevron, () => {})}
          {row('shield-checkmark-outline', 'Informativa privacy', null, chevron, () => {})}
          {row('information-circle-outline', 'Versione app', '1.0.0 (build 42)', null, undefined, true)}
        </>)}

        {/* Danger zone */}
        <View style={[styles.section, { marginBottom: 0 }]}>
          <Text style={[styles.sectionTitle, { color: Colors.danger }]}>Zona pericolosa</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.row} onPress={handleLogout}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
              </View>
              <Text style={[styles.rowLabel, { color: Colors.danger }]}>Esci dall'account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={() => {}}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: Colors.danger }]}>Elimina account</Text>
                <Text style={styles.rowSub}>Questa azione è irreversibile</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  backBtn:      { padding: 2 },
  title:        { color: Colors.text, fontSize: 20, fontWeight: '800' },
  section:      { marginTop: 24, paddingHorizontal: 16, gap: 10, marginBottom: 0 },
  sectionTitle: { color: Colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 4 },
  sectionCard:  { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden' },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon:      { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  rowLabel:     { color: Colors.text, fontSize: 15, fontWeight: '500' },
  rowSub:       { color: Colors.muted, fontSize: 12 },
});
