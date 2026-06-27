import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import GlassCard from '@/components/ui/GlassCard';

export default function AssegnaBonusScreen() {
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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="gift-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Assegna Bonus</Text>
        </View>
        <GlassCard>
          <View style={styles.placeholder}>
            <Ionicons name="construct-outline" size={40} color={Colors.muted} />
            <Text style={styles.placeholderTitle}>Sezione in costruzione</Text>
            <Text style={styles.placeholderBody}>Questa funzionalità sarà disponibile a breve.</Text>
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.bg },
  backBtn:          { position: 'absolute', top: 52, left: 16, zIndex: 10, backgroundColor: 'rgba(13,13,26,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },
  scroll:           { paddingTop: 112, paddingHorizontal: 20, paddingBottom: 40 },
  header:           { alignItems: 'center', gap: 8, marginBottom: 32 },
  headerIcon:       { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  title:            { color: Colors.text, fontSize: 22, fontWeight: '800' },
  placeholder:      { alignItems: 'center', gap: 12, paddingVertical: 16 },
  placeholderTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  placeholderBody:  { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
