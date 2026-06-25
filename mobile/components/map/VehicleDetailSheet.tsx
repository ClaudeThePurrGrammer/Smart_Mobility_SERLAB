// components/map/VehicleDetailSheet.tsx
// Pannello di dettaglio mezzo espandibile (CU-02 passi 6-7).
// Overlay montato SOPRA la mappa: NON è una route expo-router separata.
// Implementazione con Animated nativo (nessuna dipendenza @gorhom/bottom-sheet,
// incompatibile con react-native-reanimated v4 che ha rimosso useAnimatedGestureHandler).
//
// Stati:
//   closed  → translateY = SHEET_H (fuori schermo)
//   peek    → translateY = SHEET_H - PEEK_H (solo PEEK_H px visibili dal basso)
//   expanded → translateY = 0 (pannello pieno a 55% schermo)

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '@/constants/theme';
import { type MapVehicle, vehicleIcon, vehicleTypeLabel } from '@/lib/vehicles';
import { type Coords, haversineMeters, formatDistance, walkMinutes } from '@/lib/geo';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H  = Math.round(SCREEN_H * 0.58); // altezza totale del pannello
const PEEK_H   = 178;                          // px visibili in stato peek

interface Props {
  vehicle: MapVehicle | null;
  userCoords: Coords | null;
  onClose: () => void;
  onReserve: (vehicle: MapVehicle) => void;
}

function batteryColor(pct: number): string {
  return pct > 50 ? Colors.success : pct > 20 ? Colors.warning : Colors.danger;
}

const SPRING = { tension: 280, friction: 28, useNativeDriver: true } as const;
const TIMING = { duration: 220, useNativeDriver: true } as const;

export default function VehicleDetailSheet({ vehicle, userCoords, onClose, onReserve }: Props) {
  const sheetY   = useRef(new Animated.Value(SHEET_H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted]   = useState(false); // controlla il render

  // Apri/chiudi al cambio di vehicle
  useEffect(() => {
    if (vehicle) {
      setMounted(true);
      setExpanded(true);
      // Apri direttamente espanso: dettaglio completo + CTA "Prenota" subito visibili.
      Animated.spring(sheetY, { toValue: 0, ...SPRING }).start();
      Animated.timing(backdrop, { toValue: 1, ...TIMING }).start();
    } else {
      // Chiudi
      setExpanded(false);
      Animated.timing(sheetY, { toValue: SHEET_H, ...TIMING }).start(() => setMounted(false));
      Animated.timing(backdrop, { toValue: 0, ...TIMING }).start();
    }
  }, [vehicle]);

  const expand = () => {
    setExpanded(true);
    Animated.spring(sheetY, { toValue: 0, ...SPRING }).start();
    Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const collapse = () => {
    setExpanded(false);
    Animated.spring(sheetY, { toValue: SHEET_H - PEEK_H, ...SPRING }).start();
    Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const handleClose = () => {
    onClose();
  };

  if (!mounted || !vehicle) return null;

  const distanceM = userCoords
    ? haversineMeters(userCoords, { latitude: vehicle.lat, longitude: vehicle.lng })
    : null;

  return (
    <>
      {/* Backdrop scuro quando espanso */}
      {expanded && (
        <Animated.View
          pointerEvents="auto"
          style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: backdrop }]}
        >
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={collapse} />
        </Animated.View>
      )}

      {/* Pannello scorrevole */}
      <Animated.View style={[styles.sheet, { height: SHEET_H, transform: [{ translateY: sheetY }] }]}>
        {/* Handle bar + chiudi */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={expanded ? collapse : expand} activeOpacity={0.6} style={styles.handleArea}>
            <View style={styles.handleBar} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
            <Ionicons name="close" size={17} color={Colors.muted} />
          </TouchableOpacity>
        </View>

        {/* ── Riga compatta (sempre visibile in peek) ── */}
        <View style={styles.peekRow}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons
              name={vehicleIcon[vehicle.type] as any}
              size={26}
              color={Colors.accent}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{vehicleTypeLabel[vehicle.type]}</Text>
            <Text style={styles.subtitle}>{vehicle.model}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="battery-half" size={14} color={batteryColor(vehicle.batteryPct)} />
              <Text style={[styles.metaText, { color: batteryColor(vehicle.batteryPct) }]}>
                {vehicle.batteryPct}%
              </Text>
              <Ionicons name="walk" size={14} color={Colors.muted} style={{ marginLeft: 12 }} />
              <Text style={styles.metaText}>
                {distanceM != null ? formatDistance(distanceM) : '—'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={expanded ? collapse : expand}
            activeOpacity={0.7}
          >
            <Text style={styles.detailsBtnText}>{expanded ? 'Chiudi' : 'Dettagli'}</Text>
            <Ionicons
              name={expanded ? 'chevron-down' : 'chevron-up'}
              size={15}
              color={Colors.accent}
            />
          </TouchableOpacity>
        </View>

        {/* ── Sezione dettagli (visibile quando espanso) ── */}
        <View style={styles.divider} />

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="battery-charging-outline" size={18} color={batteryColor(vehicle.batteryPct)} />
            <Text style={styles.statValue}>{vehicle.batteryPct}%</Text>
            <Text style={styles.statLabel}>Carica</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="navigate-outline" size={18} color={Colors.accent} />
            <Text style={styles.statValue}>{distanceM != null ? formatDistance(distanceM) : '—'}</Text>
            <Text style={styles.statLabel}>Distanza</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="walk-outline" size={18} color={Colors.accent} />
            <Text style={styles.statValue}>
              {distanceM != null ? `${walkMinutes(distanceM)} min` : '—'}
            </Text>
            <Text style={styles.statLabel}>A piedi</Text>
          </View>
        </View>

        <View style={styles.infoLine}>
          <Ionicons name="pricetag-outline" size={15} color={Colors.muted} />
          <Text style={styles.infoLineText}>Sblocco € 1,00 + € 0,22/min</Text>
        </View>
        <View style={styles.infoLine}>
          <MaterialCommunityIcons name="identifier" size={15} color={Colors.muted} />
          <Text style={styles.infoLineText}>ID mezzo: {vehicle.name} #{vehicle.id}</Text>
        </View>

        {/* ── CTA Prenota ── */}
        <TouchableOpacity
          style={styles.reserveBtn}
          onPress={() => onReserve(vehicle)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={Gradients.primaryBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.reserveGradient}
          >
            <Ionicons name="flash" size={18} color={Colors.text} />
            <Text style={styles.reserveText}>Seleziona mezzo</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 38,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13,13,26,0.97)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(167,139,250,0.25)',
    paddingHorizontal: 18,
    paddingBottom: 28,
    zIndex: 39,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  handleArea: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 8,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
  },

  peekRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox:        { width: 54, height: 54, borderRadius: 14, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  title:          { color: Colors.text, fontWeight: '800', fontSize: 17 },
  subtitle:       { color: Colors.muted, fontSize: 13, marginTop: 1 },
  metaRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  metaText:       { color: Colors.muted, fontSize: 12, fontWeight: '600', marginLeft: 3 },
  detailsBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: Colors.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  detailsBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },

  divider:        { height: 1, backgroundColor: Colors.border, marginVertical: 16 },

  statsGrid:      { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard:       { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 4 },
  statValue:      { color: Colors.text, fontWeight: '800', fontSize: 15 },
  statLabel:      { color: Colors.muted, fontSize: 11 },

  infoLine:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  infoLineText:   { color: Colors.muted, fontSize: 13 },

  reserveBtn:     { borderRadius: 16, overflow: 'hidden', marginTop: 16 },
  reserveGradient:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  reserveText:    { color: Colors.text, fontSize: 16, fontWeight: '700' },
});
