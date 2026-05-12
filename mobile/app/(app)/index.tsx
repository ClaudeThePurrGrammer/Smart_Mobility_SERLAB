import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');

const SNAP_COLLAPSED = SCREEN_H * 0.22;
const SNAP_EXPANDED  = SCREEN_H * 0.45;
const DRAWER_WIDTH   = 260;

const MOCK_VEHICLES = [
  { id: '1', lat: 41.1177, lng: 16.8718, type: 'scooter' },
  { id: '2', lat: 41.1200, lng: 16.8690, type: 'bike' },
  { id: '3', lat: 41.1155, lng: 16.8750, type: 'bike' },
  { id: '4', lat: 41.1190, lng: 16.8760, type: 'scooter' },
  { id: '5', lat: 41.1210, lng: 16.8720, type: 'ebike' },
];

export default function HomeScreen() {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const drawerX       = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const isOpen        = useRef(false);

  const sheetHeight = useRef(new Animated.Value(SNAP_COLLAPSED)).current;
  const lastHeight  = useRef(SNAP_COLLAPSED);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        const next = lastHeight.current - g.dy;
        sheetHeight.setValue(Math.max(SNAP_COLLAPSED, Math.min(SNAP_EXPANDED + 40, next)));
      },
      onPanResponderRelease: (_, g) => {
        const next = lastHeight.current - g.dy;
        const snap = next > (SNAP_COLLAPSED + SNAP_EXPANDED) / 2 ? SNAP_EXPANDED : SNAP_COLLAPSED;
        lastHeight.current = snap;
        Animated.spring(sheetHeight, { toValue: snap, useNativeDriver: false, tension: 70, friction: 12 }).start();
      },
    })
  ).current;

  const openDrawer = useCallback(() => {
    isOpen.current = true;
    setDrawerVisible(true);
    drawerX.setValue(-DRAWER_WIDTH);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(drawerX,        { toValue: 0,   duration: 280, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1,   duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  const closeDrawer = useCallback(() => {
    isOpen.current = false;
    Animated.parallel([
      Animated.timing(drawerX,        { toValue: -DRAWER_WIDTH, duration: 240, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0,             duration: 240, useNativeDriver: true }),
    ]).start(() => setDrawerVisible(false));
  }, []);

  const handleMenuPress = useCallback(() => {
    isOpen.current ? closeDrawer() : openDrawer();
  }, [openDrawer, closeDrawer]);

  const drawerNav = (path: any) => { closeDrawer(); setTimeout(() => router.push(path), 250); };

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{ latitude: 41.1177, longitude: 16.8718, latitudeDelta: 0.025, longitudeDelta: 0.025 }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        <Circle
          center={{ latitude: 41.1177, longitude: 16.8718 }}
          radius={400}
          strokeColor="rgba(124,58,237,0.6)"
          strokeWidth={2}
          fillColor="rgba(124,58,237,0.08)"
        />
        {MOCK_VEHICLES.map(v => (
          <Marker
            key={v.id}
            coordinate={{ latitude: v.lat, longitude: v.lng }}
            onPress={() => router.push('/(app)/search')}
          >
            <View style={styles.marker}>
              <MaterialCommunityIcons
                name={v.type === 'scooter' ? 'scooter' : v.type === 'ebike' ? 'bicycle-electric' : 'bicycle'}
                size={18}
                color={Colors.accent}
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Hamburger button */}
      <TouchableOpacity style={styles.menuBtn} onPress={handleMenuPress}>
        <View style={styles.menuBtnInner}>
          <Ionicons name={drawerVisible ? 'close' : 'menu'} size={22} color={Colors.text} />
        </View>
      </TouchableOpacity>

      {/* Animated drawer */}
      {drawerVisible && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 20 }]} pointerEvents="box-none">
          {/* Overlay */}
          <Animated.View
            style={[styles.drawerOverlayBase, { opacity: overlayOpacity }]}
            pointerEvents={drawerVisible ? 'auto' : 'none'}
          >
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeDrawer} />
          </Animated.View>

          {/* Drawer panel */}
          <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerX }] }]}>
            <LinearGradient colors={['#13132A', '#0D0D1A']} style={styles.drawerGradient}>
              <LinearGradient colors={Gradients.primary} style={styles.drawerLogo}>
                <Ionicons name="bicycle" size={28} color={Colors.text} />
              </LinearGradient>
              <Text style={styles.drawerAppName}>Smart Mobility</Text>
              {[
                { icon: 'person-outline',   label: 'Profilo',          path: '/(app)/profile' },
                { icon: 'wallet-outline',   label: 'Portafoglio',      path: '/(app)/wallet' },
                { icon: 'gift-outline',     label: 'Promozioni',       path: '/(app)/promotions' },
                { icon: 'headset-outline',  label: 'Servizio clienti', path: '/(app)/report' },
                { icon: 'warning-outline',  label: 'Segnalazioni',     path: '/(app)/report' },
                { icon: 'settings-outline', label: 'Impostazioni',     path: '/(app)/settings' },
              ].map(item => (
                <TouchableOpacity key={item.label} style={styles.drawerItem} onPress={() => drawerNav(item.path)}>
                  <Ionicons name={item.icon as any} size={22} color={Colors.accent} />
                  <Text style={styles.drawerItemText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </LinearGradient>
          </Animated.View>
        </View>
      )}

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        <View style={styles.sheetContent}>
          <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/(app)/search')}>
            <Ionicons name="search-outline" size={20} color={Colors.muted} />
            <Text style={{ color: Colors.muted, fontSize: 16, flex: 1 }}>Dove si va?</Text>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn}>
              <MaterialCommunityIcons name="gift" size={18} color={Colors.accent} />
              <Text style={styles.actionBtnText}>Bonus</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1.5 }]}
              onPress={() => router.push('/(app)/search')}
            >
              <Ionicons name="bicycle" size={18} color={Colors.accent} />
              <Text style={styles.actionBtnText}>Prenota un mezzo</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.qrBtn} onPress={() => router.push('/(app)/scan')}>
            <LinearGradient
              colors={Gradients.primaryBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.qrBtnGradient}
            >
              <MaterialCommunityIcons name="qrcode-scan" size={20} color={Colors.text} />
              <Text style={styles.qrBtnText}>Scansiona per iniziare</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: Colors.bg },
  menuBtn:           { position: 'absolute', top: 52, left: 16, zIndex: 10 },
  menuBtnInner:      { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 10 },
  drawerOverlayBase: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  drawer:            { width: DRAWER_WIDTH, height: '100%', position: 'absolute', top: 0, left: 0 },
  drawerGradient:    { flex: 1, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40, borderRightWidth: 1, borderRightColor: Colors.border },
  drawerLogo:        { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  drawerAppName:     { color: Colors.text, fontWeight: '800', fontSize: 18, marginBottom: 32 },
  drawerItem:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  drawerItemText:    { color: Colors.text, fontSize: 16, fontWeight: '500' },
  sheet:             { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Colors.border, zIndex: 10 },
  handleArea:        { alignItems: 'center', paddingVertical: 12 },
  handle:            { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  sheetContent:      { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  searchBar:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, height: 50 },
  actionRow:         { flexDirection: 'row', gap: 10 },
  actionBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 13 },
  actionBtnText:     { color: Colors.text, fontSize: 14, fontWeight: '600' },
  qrBtn:             { borderRadius: 14, overflow: 'hidden' },
  qrBtnGradient:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  qrBtnText:         { color: Colors.text, fontSize: 16, fontWeight: '700' },
  marker:            { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, padding: 6 },
});
