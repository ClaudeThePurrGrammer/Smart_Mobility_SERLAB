import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { messagesApi } from '@/lib/api/endpoints';
import type { ApiMessage } from '@/lib/api/types';

export default function ChatSupportScreen() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = async () => {
    if (!token) { setLoading(false); return; }
    try {
      const all = await messagesApi.list(token);
      setMessages(all.filter((m) => m.type === 'system' || m.type === 'alert'));
    } catch { /* mantiene lista corrente */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const send = async () => {
    const value = text.trim();
    if (!value || sending || !token) return;
    setSending(true);
    setText('');
    try {
      await messagesApi.create(token, { title: 'Utente', body: value, type: 'system' });
      await load();
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setText(value); // ripristina il testo se l'invio fallisce
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Chat Supporto</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.statusText}>In linea</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={40} color={Colors.muted} />
              <Text style={styles.emptyText}>Nessun messaggio — scrivi qui sotto per iniziare</Text>
            </View>
          ) : (
            messages.map((m) => {
              const isUser = m.title === 'Utente';
              return (
                <View key={m.id} style={[styles.bubbleRow, isUser ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAgent]}>
                    {!isUser && <Text style={styles.bubbleAuthor}>{m.title || 'Supporto'}</Text>}
                    <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{m.body}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Scrivi un messaggio…"
          placeholderTextColor={Colors.muted}
          value={text}
          onChangeText={setText}
          multiline
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!text.trim() || sending}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator color={Colors.text} size="small" />
            : <Ionicons name="send" size={18} color={Colors.text} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  backBtn:        { padding: 2 },
  title:          { color: Colors.text, fontSize: 20, fontWeight: '800' },
  statusRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onlineDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  statusText:     { color: Colors.success, fontSize: 12, fontWeight: '600' },

  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messagesContent:{ padding: 16, gap: 10, flexGrow: 1 },
  empty:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60 },
  emptyText:      { color: Colors.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },

  bubbleRow:      { flexDirection: 'row' },
  bubbleRowLeft:  { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubble:         { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleAgent:    { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderTopLeftRadius: 4 },
  bubbleUser:     { backgroundColor: Colors.primary, borderTopRightRadius: 4 },
  bubbleAuthor:   { color: Colors.accent, fontSize: 11, fontWeight: '700' },
  bubbleText:     { color: Colors.text, fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: Colors.text },

  inputBar:       { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.card },
  input:          { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, color: Colors.text, fontSize: 15 },
  sendBtn:        { width: 44, height: 44, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:{ opacity: 0.4 },
});
