import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';

const FAQS = [
  { q: 'Come sblocco un mezzo?',             a: 'Scansiona il QR code sul mezzo con la fotocamera dell\'app oppure inserisci manualmente il codice a 6 cifre riportato sul veicolo.' },
  { q: 'Come termino una corsa?',             a: 'Premi "Termina corsa" nell\'app, parchegia il mezzo in un\'area autorizzata (verde sulla mappa) e conferma la fine.' },
  { q: 'Cosa faccio se il mezzo non si sblocca?', a: 'Verifica la connessione internet, aggiorna la pagina e riprova. Se il problema persiste, segnala il mezzo tramite "Segnalazioni".' },
  { q: 'Come richiedo un rimborso?',          a: 'Vai su Portafoglio → Transazioni, seleziona la corsa e premi "Richiedi rimborso". Il rimborso arriva entro 5 giorni lavorativi.' },
  { q: 'Posso usare l\'app all\'estero?',     a: 'Il servizio è attivo nelle città convenzionate. Controlla la mappa per vedere le zone operative disponibili.' },
];

const CONTACTS = [
  { icon: 'chatbubble-ellipses-outline', label: 'Chat dal vivo',  sub: 'Risposta in ~2 min',  color: Colors.accent,   action: () => router.push('/(app)/chat-support') },
  { icon: 'call-outline',               label: 'Telefono',        sub: '+39 080 123 4567',     color: Colors.success,  action: () => Linking.openURL('tel:+390801234567') },
  { icon: 'mail-outline',               label: 'Email',           sub: 'supporto@smartmobility.it', color: Colors.warning, action: () => Linking.openURL('mailto:supporto@smartmobility.it') },
];

export default function SupportScreen() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Servizio clienti</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Hero */}
        <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <LinearGradient colors={['rgba(255,255,255,0.15)', 'transparent']} style={styles.heroGlow} />
          <View style={styles.heroIcon}>
            <Ionicons name="headset-outline" size={32} color={Colors.text} />
          </View>
          <Text style={styles.heroTitle}>Come possiamo aiutarti?</Text>
          <Text style={styles.heroSub}>Il nostro team è disponibile tutti i giorni dalle 8:00 alle 22:00</Text>
        </LinearGradient>

        {/* Contatti */}
        <Text style={styles.sectionTitle}>Contattaci</Text>
        <View style={styles.contactRow}>
          {CONTACTS.map(c => (
            <TouchableOpacity key={c.label} style={styles.contactCard} onPress={c.action} activeOpacity={0.8}>
              <View style={[styles.contactIcon, { backgroundColor: `${c.color}18` }]}>
                <Ionicons name={c.icon as any} size={24} color={c.color} />
              </View>
              <Text style={styles.contactLabel}>{c.label}</Text>
              <Text style={styles.contactSub} numberOfLines={1}>{c.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.contactNote}>
          I messaggi con il supporto appaiono nella tua casella messaggi.
        </Text>

        {/* Ticket aperto */}
        <TouchableOpacity style={styles.ticketBtn} activeOpacity={0.85} onPress={() => router.push('/(app)/ticket')}>
          <LinearGradient
            colors={['rgba(124,58,237,0.15)', 'rgba(79,142,247,0.15)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.ticketBtnInner}
          >
            <Ionicons name="document-text-outline" size={22} color={Colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ticketTitle}>Apri un ticket di supporto</Text>
              <Text style={styles.ticketSub}>Risposta garantita entro 24 ore</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Tickets attivi */}
        <Text style={styles.sectionTitle}>I tuoi ticket</Text>
        <View style={styles.emptyTickets}>
          <Ionicons name="checkmark-circle-outline" size={36} color={Colors.muted} />
          <Text style={styles.emptyText}>Nessun ticket aperto</Text>
          <Text style={styles.emptySub}>Tutti i tuoi problemi sono stati risolti</Text>
        </View>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>Domande frequenti</Text>
        <View style={styles.faqCard}>
          {FAQS.map((faq, idx) => (
            <View key={idx} style={[styles.faqItem, idx < FAQS.length - 1 && styles.faqBorder]}>
              <TouchableOpacity
                style={styles.faqQuestion}
                onPress={() => setOpenFaq(openFaq === idx ? null : idx)}
                activeOpacity={0.7}
              >
                <Text style={styles.faqQ}>{faq.q}</Text>
                <Ionicons
                  name={openFaq === idx ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={Colors.muted}
                />
              </TouchableOpacity>
              {openFaq === idx && (
                <Text style={styles.faqA}>{faq.a}</Text>
              )}
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  backBtn:        { padding: 2 },
  title:          { color: Colors.text, fontSize: 20, fontWeight: '800' },

  hero:           { margin: 16, borderRadius: 20, padding: 24, gap: 10, overflow: 'hidden' },
  heroGlow:       { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  heroIcon:       { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle:      { color: Colors.text, fontSize: 20, fontWeight: '800' },
  heroSub:        { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 20 },

  sectionTitle:   { color: Colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginHorizontal: 20, marginTop: 24, marginBottom: 12 },

  contactRow:     { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  contactCard:    { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8 },
  contactIcon:    { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  contactLabel:   { color: Colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  contactSub:     { color: Colors.muted, fontSize: 11, textAlign: 'center' },
  contactNote:    { color: Colors.muted, fontSize: 12, marginHorizontal: 20, marginTop: 10, lineHeight: 18 },

  ticketBtn:      { marginHorizontal: 16, marginTop: 4, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  ticketBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  ticketTitle:    { color: Colors.text, fontWeight: '700', fontSize: 15 },
  ticketSub:      { color: Colors.muted, fontSize: 12, marginTop: 2 },

  emptyTickets:   { alignItems: 'center', gap: 6, paddingVertical: 24, marginHorizontal: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16 },
  emptyText:      { color: Colors.text, fontWeight: '600', fontSize: 15 },
  emptySub:       { color: Colors.muted, fontSize: 13 },

  faqCard:        { marginHorizontal: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden' },
  faqItem:        { paddingHorizontal: 16, paddingVertical: 14 },
  faqBorder:      { borderBottomWidth: 1, borderBottomColor: Colors.border },
  faqQuestion:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faqQ:           { color: Colors.text, fontWeight: '600', fontSize: 14, flex: 1, lineHeight: 20 },
  faqA:           { color: Colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10 },
});
