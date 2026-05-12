import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

type MsgType = 'promo' | 'ride' | 'alert' | 'system';

interface Message {
  id: string;
  type: MsgType;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const MOCK_MESSAGES: Message[] = [
  { id: '1', type: 'promo',  title: '🎁 Offerta speciale',          body: 'Hai guadagnato 50 punti bonus! Usali entro il 31 maggio.',            time: 'Adesso',    read: false },
  { id: '2', type: 'ride',   title: 'Corsa terminata',              body: 'La tua corsa di 2,4 km è stata completata. Costo: €3,60.',             time: '2 ore fa',  read: false },
  { id: '3', type: 'alert',  title: '⚠️ Area ristretta vicina',     body: 'Sei a 200m da una zona a velocità limitata. Rallenta a 6 km/h.',      time: 'Ieri',      read: true  },
  { id: '4', type: 'system', title: 'Aggiornamento termini',        body: 'Abbiamo aggiornato i termini di servizio. Clicca per leggere.',        time: 'Ieri',      read: true  },
  { id: '5', type: 'promo',  title: '⚡ Weekend gratis',            body: 'Questo weekend sblocco gratuito per tutti i mezzi. Approfitta!',       time: '2 gg fa',   read: true  },
  { id: '6', type: 'ride',   title: 'Corsa terminata',              body: 'La tua corsa di 1,8 km è stata completata. Costo: €2,80.',             time: '3 gg fa',   read: true  },
  { id: '7', type: 'system', title: 'Nuovo mezzo disponibile',      body: 'Un monopattino è ora disponibile a 80m da te in Via Roma.',            time: '4 gg fa',   read: true  },
  { id: '8', type: 'alert',  title: 'Segnalazione parcheggio',      body: 'Il tuo ultimo parcheggio non era in un\'area autorizzata. Attenzione.',time: '5 gg fa',   read: true  },
];

const TYPE_CONFIG: Record<MsgType, { icon: any; color: string; bg: string }> = {
  promo:  { icon: 'gift-outline',          color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  ride:   { icon: 'bicycle-outline',       color: Colors.success, bg: 'rgba(34,197,94,0.1)' },
  alert:  { icon: 'warning-outline',       color: Colors.warning, bg: 'rgba(245,158,11,0.1)' },
  system: { icon: 'information-circle-outline', color: Colors.muted, bg: Colors.surface },
};

export default function MessagesScreen() {
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const unreadCount = messages.filter(m => !m.read).length;

  const markAllRead = () => setMessages(prev => prev.map(m => ({ ...m, read: true })));
  const markRead = (id: string) => setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));

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
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>Nessuna notifica</Text>
          </View>
        ) : (
          messages.map(msg => {
            const cfg = TYPE_CONFIG[msg.type];
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
                  <Text style={styles.msgTime}>{msg.time}</Text>
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
