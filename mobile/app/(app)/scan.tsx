/**
 * ScanScreen — scanner QR generico (accesso dalla home, senza mezzo pre-selezionato).
 *
 * Dopo la scansione o l'inserimento manuale del codice NON avvia la corsa
 * direttamente: naviga su activate.tsx passando il codice come prefill.
 * activate.tsx gestisce validazione, verifica mezzo e schermata di riepilogo
 * prima di avviare effettivamente la corsa.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, TextInput } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';

const { width } = Dimensions.get('window');
const FRAME = width * 0.68;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [code, setCode] = useState('');

  // Reset completo ogni volta che la schermata viene messa a fuoco
  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setManualMode(false);
      setCode('');
    }, []),
  );

  /** Naviga su activate.tsx con il codice scansionato/inserito come prefill. */
  const goToActivate = (raw: string) => {
    router.push({
      pathname: '/(app)/activate',
      params: { prefill: raw },
    });
  };

  const handleScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    goToActivate(data);
  };

  const handleManualSubmit = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    goToActivate(trimmed);
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionBox}>
          <LinearGradient colors={Gradients.primary} style={styles.permIcon}>
            <Ionicons name="camera-outline" size={32} color={Colors.text} />
          </LinearGradient>
          <Text style={styles.permTitle}>Accesso fotocamera</Text>
          <Text style={styles.permSub}>
            Per scansionare il QR code del veicolo è necessario il permesso alla fotocamera.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.permBtnGradient}>
              <Text style={styles.permBtnText}>Concedi permesso</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setManualMode(true)}>
            <Text style={styles.manualLink}>Inserisci codice manualmente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (manualMode) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { setManualMode(false); setCode(''); }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.manualBox}>
          <MaterialCommunityIcons name="qrcode" size={48} color={Colors.accent} />
          <Text style={styles.manualTitle}>Inserisci codice</Text>
          <Text style={styles.manualSub}>Trovi il codice sul veicolo vicino al QR code</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="es. SM-12345"
            placeholderTextColor={Colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleManualSubmit}
            style={styles.manualInput}
          />
          <TouchableOpacity
            style={[styles.permBtn, !code.trim() && { opacity: 0.45 }]}
            onPress={handleManualSubmit}
            disabled={!code.trim()}
          >
            <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.permBtnGradient}>
              <Text style={styles.permBtnText}>Continua</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Dark overlay with frame cutout */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.frame}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <Text style={styles.scanHint}>Punta la fotocamera sul QR code del veicolo</Text>
          <TouchableOpacity style={styles.manualBtn} onPress={() => setManualMode(true)}>
            <Ionicons name="keypad-outline" size={18} color={Colors.accent} />
            <Text style={styles.manualBtnText}>Inserisci codice manuale</Text>
          </TouchableOpacity>
          {scanned && (
            <TouchableOpacity style={styles.resetBtn} onPress={() => setScanned(false)}>
              <Text style={{ color: Colors.text, fontWeight: '600' }}>Scansiona di nuovo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.bg },
  backBtn:         { position: 'absolute', top: 52, left: 16, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 8 },
  overlay:         { flex: 1 },
  overlayTop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  overlayMiddle:   { flexDirection: 'row', height: FRAME },
  overlaySide:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  frame:           { width: FRAME, height: FRAME },
  corner:          { position: 'absolute', width: 28, height: 28, borderColor: Colors.accent, borderWidth: 3 },
  cornerTL:        { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 8 },
  cornerTR:        { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 8 },
  cornerBL:        { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR:        { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 8 },
  overlayBottom:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  scanHint:        { color: Colors.text, fontSize: 15, textAlign: 'center', fontWeight: '500' },
  manualBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: Colors.accent, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10 },
  manualBtnText:   { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  resetBtn:        { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10 },
  permissionBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  permIcon:        { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  permTitle:       { color: Colors.text, fontSize: 22, fontWeight: '800' },
  permSub:         { color: Colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  permBtn:         { borderRadius: 14, overflow: 'hidden', alignSelf: 'stretch' },
  permBtnGradient: { paddingVertical: 15, alignItems: 'center' },
  permBtnText:     { color: Colors.text, fontWeight: '700', fontSize: 16 },
  manualLink:      { color: Colors.accent, fontSize: 14, fontWeight: '500' },
  manualBox:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14, marginTop: 80 },
  manualTitle:     { color: Colors.text, fontSize: 22, fontWeight: '800' },
  manualSub:       { color: Colors.muted, fontSize: 14, textAlign: 'center' },
  manualInput:     { alignSelf: 'stretch', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, height: 54, color: Colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 3 },
});
