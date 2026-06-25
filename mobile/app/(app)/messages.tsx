import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { messagesApi } from '@/lib/api/endpoints';
import type { ApiMessage } from '@/lib/api/types';
import { relativeTime } from '@/lib/format';

type MsgType = 'promo' | 'ride' | 'alert' | 'system';

const TYPE_CONFIG: Record<MsgType, { icon: any; color: string; bg: string }> = {
  promo:  { icon: 'gift-outline',          color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  ride:   { icon: 'bicycle-outline',       color: Colors.success, bg: 'rgba(34,197,94,0.1)' },
  alert:  { icon: 'warning-outline',       color: Colors.warning, bg: 'rgba(245,158,11,0.1)' },
  system: { icon: 'information-circle-outline', color: Colors.muted, bg: Colors.surface },
};

export default function MessagesScreen() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await messagesApi.list(token);
      setMessages(list);
    } catch {
      // errore di rete: lascia i valori correnti
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const unreadCount = messages.filter(m => !m.read).length;

  const markAllRead = async () => {
    if (!token) return;
    try {
      const updated = await messagesApi.markAllRead(token);
      setMessages(updated);
    } catch {
      // fallback locale se offline
      setMessages(prev => prev.map(m => ({ ...m, read: true })));
    }
  };

  const markRead = async (id: number) => {
    if (!token) return;
    try {
      const updated = await messagesApi.markRead(token, id);
      setMessages(prev => prev.map(m => m.id === id ? updated : m));
    } catch {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifiche</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} non {unreadCount === 1 ? 'letta' : 'lette'}</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Segna tutte come lette</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
        ) : messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>Nessuna notifica</Text>
          </View>
        ) : (
          messages.map(msg => {
            const cfg = TYPE_CONFIG[msg.type] ?? TYPE_CONFIG.system;
            return (
              <TouchableOpacity
                key={msg.id}
                style={[styles.msgItem, !msg.read && styles.msgItemUnread]}
                onPress={() => markRead(msg.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.msgIcon, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={22} color={cfg.color} />
                </View>
                <View style={styles.msgBody}>
                  <View style={styles.msgTopRow}>
                    <Text style={styles.msgTitle}>{msg.title}</Text>
                    {!msg.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.msgText} numberOfLines={2}>{msg.body}</Text>
                  <Text style={styles.msgTime}>{relativeTime(msg.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  header:         { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  headerTitle:    { color: Colors.text, fontSize: 22, fontWeight: '800' },
  headerSub:      { color: Colors.muted, fontSize: 13, marginTop: 2 },
  markAllBtn:     { paddingBottom: 2 },
  markAllText:    { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  msgItem:        { flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  msgItemUnread:  { backgroundColor: 'rgba(124,58,237,0.04)' },
  msgIcon:        { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  msgBody:        { flex: 1, gap: 4 },
  msgTopRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  msgTitle:       { color: Colors.text, fontWeight: '700', fontSize: 14, flex: 1 },
  unreadDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  msgText:        { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  msgTime:        { color: Colors.muted, fontSize: 11 },
  emptyState:     { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText:      { color: Colors.muted, fontSize: 16 },
});
