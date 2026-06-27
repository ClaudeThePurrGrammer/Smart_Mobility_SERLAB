import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';

function initialsOf(name: string, surname: string): string {
  return `${name.charAt(0)}${surname.charAt(0)}`.toUpperCase() || 'OP';
}

export default function OperatoreProfiloScreen() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const fullName = user ? `${user.name} ${user.surname}`.trim() : '';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Header */}
      <LinearGradient colors={['#1A0A2E', '#0D0D1A']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        <LinearGradient colors={Gradients.primary} style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{user ? initialsOf(user.name, user.surname) : 'OP'}</Text>
        </LinearGradient>
        <Text style={styles.name}>{fullName || 'Operatore'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="construct-outline" size={14} color={Colors.accent} />
          <Text style={styles.roleText}>Operatore</Text>
        </View>
      </LinearGradient>

      {/* Info card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>INFORMAZIONI ACCOUNT</Text>
        <View style={styles.card}>
          {[
            { icon: 'person-outline',   label: 'Nome',  value: fullName || '—' },
            { icon: 'mail-outline',     label: 'Email', value: user?.email ?? '—' },
            { icon: 'construct-outline', label: 'Ruolo', value: 'Operatore' },
          ].map((row, idx, arr) => (
            <View key={row.label} style={[styles.infoRow, idx < arr.length - 1 && styles.infoRowBorder]}>
              <View style={styles.infoIcon}>
                <Ionicons name={row.icon as any} size={18} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={styles.logoutText}>Esci dall'account</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  header:         { alignItems: 'center', paddingTop: 56, paddingBottom: 32, paddingHorizontal: 24, gap: 8 },
  backBtn:        { position: 'absolute', top: 52, left: 16, backgroundColor: 'rgba(13,13,26,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },
  avatarCircle:   { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText:     { color: Colors.text, fontSize: 28, fontWeight: '900' },
  name:           { color: Colors.text, fontSize: 20, fontWeight: '800' },
  email:          { color: Colors.muted, fontSize: 14 },
  roleBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 1, borderColor: Colors.accent, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  roleText:       { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  section:        { marginTop: 24, paddingHorizontal: 16, gap: 10 },
  sectionTitle:   { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingLeft: 4 },
  card:           { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden' },
  infoRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  infoRowBorder:  { borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoIcon:       { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  infoLabel:      { color: Colors.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  infoValue:      { color: Colors.text, fontSize: 15, fontWeight: '500', marginTop: 1 },
  logoutBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: 16, marginTop: 28, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: Colors.danger, borderRadius: 16, paddingVertical: 15 },
  logoutText:     { color: Colors.danger, fontSize: 15, fontWeight: '700' },
});
