import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { authApi, ridesApi } from '@/lib/api/endpoints';

function initialsOf(name: string, surname: string): string {
  return `${name.charAt(0)}${surname.charAt(0)}`.toUpperCase() || 'U';
}

function memberSince(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

const SECTIONS = [
  {
    title: 'Account',
    items: [
      { icon: 'card-outline',       label: 'Metodi di pagamento',  onPress: () => router.push('/(app)/payment') },
      { icon: 'time-outline',       label: 'Storico corse',        onPress: () => router.push('/(app)/ride-history') },
      { icon: 'gift-outline',       label: 'Promozioni e bonus',   onPress: () => router.push('/(app)/promotions') },
      { icon: 'star-outline',       label: 'Programma fedeltà',    onPress: () => router.push('/(app)/loyalty') },
    ],
  },
  {
    title: 'Preferenze',
    items: [
      { icon: 'notifications-outline', label: 'Notifiche',         onPress: () => router.push('/(app)/settings') },
      { icon: 'lock-closed-outline',   label: 'Privacy e sicurezza', onPress: () => router.push('/(app)/settings') },
      { icon: 'language-outline',      label: 'Lingua',             onPress: () => router.push('/(app)/settings') },
    ],
  },
  {
    title: 'Supporto',
    items: [
      { icon: 'headset-outline',    label: 'Servizio clienti',     onPress: () => router.push('/(app)/support' as any) },
      { icon: 'document-text-outline', label: 'Termini di servizio', onPress: () => Linking.openURL('https://smartmobility.it/termini') },
      { icon: 'shield-outline',     label: 'Informativa privacy',  onPress: () => Linking.openURL('https://smartmobility.it/privacy') },
      { icon: 'information-circle-outline', label: 'Versione app 1.0.0', onPress: () => {} },
    ],
  },
];

export default function ProfileScreen() {
  const { user, token, logout, setUser } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notifications_enabled ?? true);
  const [stats, setStats] = useState({ rides: 0, km: 0 });

  // Statistiche reali: rifetch ad ogni focus del tab (il tab resta montato in memoria
  // tra navigazioni, quindi useEffect([token]) non si riattiva dopo una nuova corsa).
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      ridesApi.history(token)
        .then((rides) => setStats({
          rides: rides.length,
          km: Math.round(rides.reduce((s, r) => s + r.km, 0) * 10) / 10,
        }))
        .catch(() => {});
    }, [token]),
  );

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    if (!token) return;
    try {
      const updated = await authApi.updateMe(token, { notifications_enabled: value });
      setUser(updated);
    } catch {
      setNotificationsEnabled(!value); // rollback su errore
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const fullName = user ? `${user.name} ${user.surname}`.trim() : '';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Header */}
      <LinearGradient colors={['#1A0A2E', '#0D0D1A']} style={styles.header}>
        <LinearGradient colors={Gradients.primary} style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{user ? initialsOf(user.name, user.surname) : '–'}</Text>
        </LinearGradient>
        <Text style={styles.name}>{fullName || 'Utente'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>
        <Text style={styles.since}>{user ? `Membro da ${memberSince(user.created_at)}` : ''}</Text>

        <TouchableOpacity style={styles.editBtn}>
          <Ionicons name="pencil-outline" size={14} color={Colors.accent} />
          <Text style={styles.editBtnText}>Modifica profilo</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.rides}</Text>
          <Text style={styles.statLabel}>Corse</Text>
        </View>
        <View style={[styles.stat, styles.statBorder]}>
          <Text style={styles.statValue}>{stats.km}</Text>
          <Text style={styles.statLabel}>Km totali</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: Colors.accent }]}>{user?.points ?? 0}</Text>
          <Text style={styles.statLabel}>Punti</Text>
        </View>
      </View>

      {/* Notifications toggle */}
      <View style={styles.toggleCard}>
        <Ionicons name="notifications-outline" size={22} color={Colors.accent} />
        <Text style={styles.toggleLabel}>Notifiche push</Text>
        <Switch
          value={notificationsEnabled}
          onValueChange={toggleNotifications}
          trackColor={{ false: Colors.border, true: Colors.primary }}
          thumbColor={Colors.text}
        />
      </View>

      {/* Sections */}
      {SECTIONS.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionCard}>
            {section.items.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.item, idx < section.items.length - 1 && styles.itemBorder]}
                onPress={item.onPress}
              >
                <View style={styles.itemIcon}>
                  <Ionicons name={item.icon as any} size={20} color={Colors.accent} />
                </View>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={styles.logoutText}>Esci dall'account</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg },
  header:       { alignItems: 'center', paddingTop: 60, paddingBottom: 28, paddingHorizontal: 24, gap: 6 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText:   { color: Colors.text, fontSize: 28, fontWeight: '900' },
  name:         { color: Colors.text, fontSize: 20, fontWeight: '800' },
  email:        { color: Colors.muted, fontSize: 14 },
  since:        { color: Colors.muted, fontSize: 12 },
  editBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 1, borderColor: Colors.accent, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  editBtnText:  { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  statsRow:     { flexDirection: 'row', backgroundColor: Colors.card, borderBottomWidth: 1, borderTopWidth: 1, borderColor: Colors.border },
  stat:         { flex: 1, alignItems: 'center', paddingVertical: 18, gap: 4 },
  statBorder:   { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  statValue:    { color: Colors.text, fontSize: 22, fontWeight: '900' },
  statLabel:    { color: Colors.muted, fontSize: 12 },
  toggleCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, marginHorizontal: 16, marginTop: 20, padding: 16 },
  toggleLabel:  { color: Colors.text, fontSize: 15, fontWeight: '500', flex: 1 },
  section:      { marginTop: 24, paddingHorizontal: 16, gap: 10 },
  sectionTitle: { color: Colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 4 },
  sectionCard:  { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden' },
  item:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  itemBorder:   { borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemIcon:     { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  itemLabel:    { color: Colors.text, fontSize: 15, fontWeight: '500', flex: 1 },
  logoutBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: 16, marginTop: 24, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: Colors.danger, borderRadius: 16, paddingVertical: 15 },
  logoutText:   { color: Colors.danger, fontSize: 15, fontWeight: '700' },
});
