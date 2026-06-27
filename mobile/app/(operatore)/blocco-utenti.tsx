import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/theme';
import GlassCard from '@/components/ui/GlassCard';
import { useAuth } from '@/lib/auth/AuthContext';
import { operatoreApi } from '@/lib/api/endpoints';
import type { ApiUserAdmin } from '@/lib/api/types';

// ── Costanti UI ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  ATTIVO:   { label: 'Attivo',   color: '#22C55E', icon: 'checkmark-circle-outline' },
  SOSPESO:  { label: 'Sospeso',  color: '#F59E0B', icon: 'pause-circle-outline'     },
  BLOCCATO: { label: 'Bloccato', color: '#EF4444', icon: 'ban-outline'               },
};

const NUOVI_STATI: { value: string; label: string; color: string }[] = [
  { value: 'ATTIVO',   label: 'Riattiva',  color: '#22C55E' },
  { value: 'SOSPESO',  label: 'Sospendi',  color: '#F59E0B' },
  { value: 'BLOCCATO', label: 'Blocca',    color: '#EF4444' },
];

// ── Componenti locali ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ATTIVO;
  return (
    <View style={[styles.badge, { borderColor: cfg.color, backgroundColor: `${cfg.color}18` }]}>
      <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function UserCard({ user, onPress }: { user: ApiUserAdmin; onPress: () => void }) {
  const initials = `${user.name[0] ?? ''}${user.surname[0] ?? ''}`.toUpperCase();
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
      <GlassCard style={styles.userCard} padding={0}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || '?'}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name} {user.surname}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
          </View>
          <StatusBadge status={user.account_status} />
          <Ionicons name="chevron-forward" size={16} color={Colors.muted} style={{ marginLeft: 6 }} />
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

// ── Schermata principale ────────────────────────────────────────────────────

export default function BloccoUtentiScreen() {
  const { token } = useAuth();

  const [items,      setItems]      = useState<ApiUserAdmin[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [query,      setQuery]      = useState('');

  // Modale cambio stato
  const [selected,   setSelected]   = useState<ApiUserAdmin | null>(null);
  const [nuovoStato, setNuovoStato] = useState('');
  const [motivo,     setMotivo]     = useState('');
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await operatoreApi.listUtenti(token!);
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? 'Errore di rete');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const filtered = query.trim()
    ? items.filter(u =>
        `${u.name} ${u.surname} ${u.email}`.toLowerCase().includes(query.trim().toLowerCase())
      )
    : items;

  function openModal(user: ApiUserAdmin) {
    setSelected(user);
    setNuovoStato(user.account_status);
    setMotivo('');
    setSaveError(null);
  }

  function closeModal() {
    if (saving) return;
    setSelected(null);
  }

  async function handleSalva() {
    if (!selected || !token) return;
    if (!motivo.trim()) {
      setSaveError('Il motivo è obbligatorio.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await operatoreApi.cambiaStatoUtente(token, selected.id, nuovoStato, motivo.trim());
      setItems(prev => prev.map(u => u.id === updated.id ? updated : u));
      setSelected(null);
    } catch (e: any) {
      setSaveError(e?.message ?? 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D0D1A', '#1A0A2E', '#0D0D1A']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
        <Ionicons name="arrow-back" size={22} color={Colors.text} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="person-remove-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Blocco Utenti</Text>
          <Text style={styles.subtitle}>Gestione stato account</Text>
        </View>

        {/* Barra di ricerca */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca per nome o email…"
            placeholderTextColor={Colors.muted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={Colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Caricamento utenti…</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <GlassCard style={{ marginBottom: 16 }}>
            <View style={styles.centered}>
              <Ionicons name="cloud-offline-outline" size={36} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchData} activeOpacity={0.8}>
                <Text style={styles.retryText}>Riprova</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <GlassCard>
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={44} color={Colors.muted} />
              <Text style={styles.emptyTitle}>
                {query ? 'Nessun risultato' : 'Nessun utente'}
              </Text>
            </View>
          </GlassCard>
        )}

        {/* Contatore risultati */}
        {!loading && !error && items.length > 0 && (
          <Text style={styles.countLabel}>
            {filtered.length} {filtered.length === 1 ? 'utente' : 'utenti'}
            {query ? ` trovati` : ' totali'}
          </Text>
        )}

        {/* Lista utenti */}
        {!loading && !error && filtered.map(u => (
          <UserCard key={u.id} user={u} onPress={() => openModal(u)} />
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modale cambio stato */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => { Keyboard.dismiss(); closeModal(); }}
      >
        {/* Livello 1: overlay scuro, centra il contenuto, nessun KAV qui */}
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => { Keyboard.dismiss(); closeModal(); }}
        >
          {/* Livello 2: KAV scoped alla larghezza del box, sposta in su quando appare la tastiera */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.kavWrapper}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              {/* Livello 3: box visivo — dimensioni definite da padding e contenuto, nessun flex:1 */}
              <View style={styles.modalBox}>
                <LinearGradient
                  colors={['#1A1A35', '#0D0D1A']}
                  style={StyleSheet.absoluteFillObject}
                  borderRadius={20}
                />

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  contentContainerStyle={{ padding: 24 }}
                  style={styles.modalScroll}
                >
                  {/* Intestazione modale */}
                  <View style={styles.modalHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {selected ? `${selected.name[0] ?? ''}${selected.surname[0] ?? ''}`.toUpperCase() : ''}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalName}>{selected?.name} {selected?.surname}</Text>
                      <Text style={styles.modalEmail}>{selected?.email}</Text>
                    </View>
                    <TouchableOpacity onPress={() => { Keyboard.dismiss(); closeModal(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={22} color={Colors.muted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalDivider} />

                  {/* Stato corrente */}
                  <Text style={styles.modalSectionLabel}>STATO ATTUALE</Text>
                  <View style={styles.modalCurrentRow}>
                    <StatusBadge status={selected?.account_status ?? 'ATTIVO'} />
                  </View>

                  {/* Selettore nuovo stato */}
                  <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>NUOVO STATO</Text>
                  <View style={styles.statoRow}>
                    {NUOVI_STATI.map(s => (
                      <TouchableOpacity
                        key={s.value}
                        style={[
                          styles.statoBtn,
                          { borderColor: s.color },
                          nuovoStato === s.value && { backgroundColor: `${s.color}22` },
                        ]}
                        onPress={() => setNuovoStato(s.value)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.statoBtnText, { color: s.color }]}>{s.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Campo motivo */}
                  <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>MOTIVO *</Text>
                  <TextInput
                    style={styles.motivoInput}
                    placeholder="Inserisci il motivo dell'azione…"
                    placeholderTextColor={Colors.muted}
                    value={motivo}
                    onChangeText={text => { setMotivo(text); setSaveError(null); }}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  {saveError && (
                    <Text style={styles.saveErrorText}>{saveError}</Text>
                  )}

                  {/* Pulsante conferma */}
                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      { backgroundColor: STATUS_CONFIG[nuovoStato]?.color ?? Colors.accent },
                      saving && { opacity: 0.5 },
                    ]}
                    onPress={handleSalva}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-outline" size={18} color="#fff" />
                        <Text style={styles.confirmText}>Conferma</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Stili ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg },
  backBtn:     { position: 'absolute', top: 52, left: 16, zIndex: 10, backgroundColor: 'rgba(13,13,26,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },
  scroll:      { paddingTop: 112, paddingHorizontal: 16, paddingBottom: 40 },

  header:      { alignItems: 'center', gap: 8, marginBottom: 20 },
  headerIcon:  { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  title:       { color: Colors.text, fontSize: 22, fontWeight: '800' },
  subtitle:    { color: Colors.muted, fontSize: 13 },

  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, padding: 0 },

  countLabel:  { color: Colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 10, paddingLeft: 2 },

  centered:    { alignItems: 'center', gap: 12, paddingVertical: 24 },
  loadingText: { color: Colors.muted, fontSize: 14 },
  errorText:   { color: Colors.danger, fontSize: 13, textAlign: 'center' },
  retryBtn:    { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: Colors.danger, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  retryText:   { color: Colors.danger, fontSize: 13, fontWeight: '600' },
  emptyTitle:  { color: Colors.text, fontSize: 16, fontWeight: '700' },

  userCard:    { marginBottom: 10 },
  userRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar:      { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)', alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: Colors.accent, fontSize: 15, fontWeight: '700' },
  userInfo:    { flex: 1, gap: 2 },
  userName:    { color: Colors.text, fontSize: 14, fontWeight: '700' },
  userEmail:   { color: Colors.muted, fontSize: 12 },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:   { fontSize: 11, fontWeight: '700' },

  // Modale — struttura a 3 livelli netti (overlay → KAV → box visivo)
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  kavWrapper:  { width: '90%', maxWidth: 420 },
  modalBox:    { borderRadius: 20, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  modalScroll: { maxHeight: 520 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  modalName:   { color: Colors.text, fontSize: 15, fontWeight: '700' },
  modalEmail:  { color: Colors.muted, fontSize: 12 },
  modalDivider:{ height: 1, backgroundColor: Colors.border, marginBottom: 16 },
  modalSectionLabel: { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  modalCurrentRow:   { flexDirection: 'row', marginBottom: 4 },

  statoRow:    { flexDirection: 'row', gap: 8 },
  statoBtn:    { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  statoBtnText:{ fontSize: 13, fontWeight: '700' },

  motivoInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, color: Colors.text, fontSize: 14, minHeight: 80, marginBottom: 4 },
  saveErrorText:{ color: Colors.danger, fontSize: 12, marginBottom: 8 },

  confirmBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 8 },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
