import React, { useCallback, useRef, useState } from 'react';
import {
  Animated, Easing, Image, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';

const DRAWER_WIDTH = 260;
const SPRING_CFG = { tension: 280, friction: 28, useNativeDriver: true } as const;

const FEATURES: { icon: any; label: string; path: string }[] = [
  { icon: 'map-outline',              label: 'Disponibilità Aree',    path: '/(operatore)/disponibilita-aree' },
  { icon: 'flag-outline',             label: 'Mezzi a Fine Corsa',    path: '/(operatore)/mezzi-fine-corsa' },
  { icon: 'gift-outline',             label: 'Assegna Bonus',         path: '/(operatore)/assegna-bonus' },
  { icon: 'checkmark-done-outline',   label: 'Chiudi Segnalazioni',   path: '/(operatore)/chiudi-segnalazioni' },
  { icon: 'build-outline',            label: 'Malfunzionamenti Mezzi', path: '/(operatore)/malfunzionamenti-mezzi' },
  { icon: 'navigate-outline',         label: 'Tracciamento Mezzi',    path: '/(operatore)/tracciamento-mezzi' },
  { icon: 'lock-closed-outline',      label: 'Blocco Remoto',         path: '/(operatore)/blocco-remoto' },
  { icon: 'person-remove-outline',    label: 'Blocco Utenti',         path: '/(operatore)/blocco-utenti' },
];

export default function OperatoreHomeScreen() {
  const { user, logout } = useAuth();
  const [drawerVisible, setDrawerVisible] = useState(false);

  const drawerX        = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const isOpen         = useRef(false);

  const openDrawer = useCallback(() => {
    isOpen.current = true;
    setDrawerVisible(true);
    drawerX.setValue(-DRAWER_WIDTH);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(drawerX,        { toValue: 0, ...SPRING_CFG }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  const closeDrawer = useCallback(() => {
    isOpen.current = false;
    Animated.parallel([
      Animated.timing(drawerX,        { toValue: -DRAWER_WIDTH, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setDrawerVisible(false));
  }, []);

  const handleMenuPress = useCallback(() => {
    isOpen.current ? closeDrawer() : openDrawer();
  }, [openDrawer, closeDrawer]);

  const drawerNav = (path: any) => {
    closeDrawer();
    setTimeout(() => router.push(path), 220);
  };

  const handleLogout = () => {
    closeDrawer();
    setTimeout(async () => {
      await logout();
      router.replace('/(auth)/login');
    }, 220);
  };

  const fullName = user ? `${user.name} ${user.surname}`.trim() : 'Operatore';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D0D1A', '#1A0A2E', '#0D0D1A']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Hamburger */}
      <TouchableOpacity style={styles.menuBtn} onPress={handleMenuPress} activeOpacity={0.75}>
        <View style={styles.menuBtnInner}>
          <Ionicons name={drawerVisible ? 'close' : 'menu'} size={22} color={Colors.text} />
        </View>
      </TouchableOpacity>

      {/* Main content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Bentornato,</Text>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.roleLabel}>Operatore</Text>
        </View>

        {/* Griglia 8 funzionalità — tutte alla pari */}
        <Text style={styles.sectionTitle}>FUNZIONALITÀ</Text>
        <View style={styles.grid}>
          {FEATURES.map(f => (
            <TouchableOpacity
              key={f.label}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => router.push(f.path as any)}
            >
              <View style={styles.cardIcon}>
                <Ionicons name={f.icon} size={26} color={Colors.accent} />
              </View>
              <Text style={styles.cardLabel}>{f.label}</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.muted} style={{ marginTop: 'auto' }} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Drawer */}
      {drawerVisible && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 20 }]} pointerEvents="box-none">
          <Animated.View style={[styles.drawerOverlay, { opacity: overlayOpacity }]} pointerEvents="auto">
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeDrawer} />
          </Animated.View>

          <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerX }] }]}>
            <LinearGradient colors={['#13132A', '#0D0D1A']} style={styles.drawerGradient}>
              <View style={styles.drawerTopRow}>
                <View style={styles.drawerLogoWrapper}>
                  <Image
                    source={require('@/assets/logo.png')}
                    style={{ width: 56, height: 56, borderRadius: 16 }}
                    resizeMode="cover"
                  />
                </View>
                <TouchableOpacity onPress={closeDrawer} style={styles.drawerCloseBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={22} color={Colors.muted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.drawerAppName}>Smart Mobility</Text>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => drawerNav('/(operatore)/profilo')}
                activeOpacity={0.65}
              >
                <Ionicons name="person-outline" size={22} color={Colors.accent} />
                <Text style={styles.drawerItemText}>Profilo</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(167,139,250,0.3)" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.drawerItem, { borderBottomWidth: 0 }]}
                onPress={handleLogout}
                activeOpacity={0.65}
              >
                <Ionicons name="log-out-outline" size={22} color={Colors.danger} />
                <Text style={[styles.drawerItemText, { color: Colors.danger }]}>Esci dall'account</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: Colors.bg },
  menuBtn:           { position: 'absolute', top: 52, left: 16, zIndex: 10 },
  menuBtnInner:      { backgroundColor: 'rgba(13,13,26,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', borderRadius: 12, padding: 10 },

  scrollContent:     { paddingTop: 112, paddingHorizontal: 20, paddingBottom: 48 },

  header:            { marginBottom: 28 },
  greeting:          { color: Colors.muted, fontSize: 15 },
  name:              { color: Colors.text, fontSize: 26, fontWeight: '900', marginTop: 2 },
  roleLabel:         { color: Colors.accent, fontSize: 13, fontWeight: '600', marginTop: 4 },

  sectionTitle:      { color: Colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12, paddingLeft: 2 },
  grid:              { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card:              { width: '47.5%', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 18, minHeight: 124, gap: 10 },
  cardIcon:          { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  cardLabel:         { color: Colors.text, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  drawerOverlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  drawer:            { width: DRAWER_WIDTH, height: '100%', position: 'absolute', top: 0, left: 0 },
  drawerGradient:    { flex: 1, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40, borderRightWidth: 1, borderRightColor: Colors.border },
  drawerTopRow:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  drawerLogoWrapper: { shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12 },
  drawerCloseBtn:    { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  drawerAppName:     { color: Colors.text, fontWeight: '800', fontSize: 18, marginBottom: 28 },
  drawerItem:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  drawerItemText:    { color: Colors.text, fontSize: 16, fontWeight: '500', flex: 1 },
});
