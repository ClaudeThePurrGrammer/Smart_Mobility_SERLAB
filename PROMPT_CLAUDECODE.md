# Prompt per Claude Code — Smart Mobility SERLAB
## Modifiche puntuali post-review (stato al 22-06-2026)

> **Contesto:** App React Native / Expo (TypeScript) + FastAPI / SQLAlchemy / SQLite.
> La review ha verificato file per file. La lista sotto contiene **solo i problemi reali ancora presenti**; tutto il resto (polling veicoli, drift GPS, preferenze, pause, routing OSRM, geocoding) è già implementato e funzionante.

---

## FIX 1 — `main.py`: sintassi `_ensure_schema()` incompatibile con SQLite

**File:** `backend/app/main.py`

**Problema:**
```python
conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSON DEFAULT '{}'::json"))
```
La sintassi `'{}'::json` è PostgreSQL. Su SQLite lancia un errore e impedisce l'avvio del server se la colonna non esiste già.

**Fix:** sostituire con la sintassi SQLite-compatibile:
```python
conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences TEXT DEFAULT '{}'"))
```
SQLAlchemy serializza già il JSON come testo su SQLite, quindi il tipo `TEXT` funziona correttamente con la colonna `Mapped[dict]` del modello.

---

## FIX 2 — `seed.py`: un solo veicolo, servono 30–40 in area Bari

**File:** `backend/app/seed.py`

**Problema:** attualmente viene aggiunto un solo `Vehicle` con coordinate fisse. Il backend ha già il meccanismo di drift GPS in `routers/vehicles.py` che riposiziona i veicoli vicino all'utente, ma con solo 7 veicoli in DB l'esperienza è povera.

**Fix:** espandere il seed a **40 veicoli** distribuiti nell'area di Bari (41.07–41.15 lat, 16.82–16.93 lng). Usare tipi misti: ~15 scooter, ~15 ebike, ~10 bike. Tutti con `status="available"`, batteria casuale 30–100%, tariffe realistiche.

Esempio di codice da usare nel blocco `if db.query(Vehicle).count() == 0:`:

```python
import random, math

BARI_CENTER = (41.1177, 16.8718)
TYPES = [
    ("scooter", "Smart S1",  "Pro 2024",  1.00, 0.22),
    ("scooter", "Smart S2",  "Lite",      0.80, 0.19),
    ("ebike",   "EcoBike E1","Urban 500", 1.20, 0.18),
    ("ebike",   "EcoBike E2","Compact",   1.00, 0.16),
    ("bike",    "CityBike B1","Classic",  0.50, 0.10),
]

def rand_coord(center, radius_km=2.5):
    r = radius_km / 111.0
    angle = random.uniform(0, 2 * math.pi)
    dist  = random.uniform(0, r)
    return center[0] + dist * math.cos(angle), center[1] + dist * math.sin(angle)

for i in range(40):
    vtype, name, model, fee, ppm = TYPES[i % len(TYPES)]
    lat, lng = rand_coord(BARI_CENTER)
    db.add(Vehicle(
        name=f"{name}-{i+1:02d}",
        model=model,
        type=vtype,
        lat=lat,
        lng=lng,
        battery_pct=random.randint(30, 100),
        status="available",
        unlock_fee=fee,
        price_per_min=ppm,
    ))
```

---

## FIX 3 — `forgot-password.tsx`: setTimeout fake, nessuna chiamata API

**File:** `mobile/app/(auth)/forgot-password.tsx`

**Problema:**
```typescript
const handleSend = () => {
  if (!email) return;
  setLoading(true);
  setTimeout(() => { setLoading(false); setSent(true); }, 1200); // FAKE
};
```
Mostra sempre "Email inviata" dopo 1,2 secondi indipendentemente dall'input.

**Strategia consigliata:** poiché aggiungere un endpoint di password-reset con email reale (SMTP) è fuori scope del progetto, sostituire il fake con un comportamento onesto ma funzionale:

**Opzione A — mostrare un messaggio statico diretto (più semplice):**
Rimuovere il loading/setTimeout e mostrare subito un testo fisso:
```
"Per reimpostare la password contatta il supporto a supporto@smartmobility.it
o usa le credenziali demo: claudio@smartmobility.it / password123"
```

**Opzione B — endpoint backend minimo (più completo):**
1. In `backend/app/routers/auth.py` aggiungere:
```python
@router.post("/forgot-password")
def forgot_password(body: dict = Body(...)):
    email = body.get("email", "").strip()
    if not email:
        raise HTTPException(400, "email required")
    # In produzione qui si invierebbe una mail; per demo si risponde sempre OK
    return {"message": "Se l'indirizzo esiste, riceverai le istruzioni."}
```
2. In `mobile/lib/api/endpoints.ts` aggiungere sotto `authApi`:
```typescript
forgotPassword: (email: string) =>
  request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
```
3. In `forgot-password.tsx` sostituire `handleSend`:
```typescript
const handleSend = async () => {
  if (!email.trim()) return;
  setLoading(true);
  try {
    await authApi.forgotPassword(email.trim());
  } catch { /* ignora: risposta sempre OK */ }
  setLoading(false);
  setSent(true);
};
```

---

## FIX 4 — `profile.tsx`: dead-end su Termini e Privacy

**File:** `mobile/app/(app)/profile.tsx`

**Problema:**
```typescript
{ icon: 'document-text-outline', label: 'Termini di servizio', onPress: () => {} },
{ icon: 'shield-outline',        label: 'Informativa privacy',  onPress: () => {} },
```

**Fix:** aprire URL reali (o placeholder) con `Linking`:
```typescript
import { Linking } from 'react-native';

{ icon: 'document-text-outline', label: 'Termini di servizio',
  onPress: () => Linking.openURL('https://smartmobility.it/termini') },
{ icon: 'shield-outline', label: 'Informativa privacy',
  onPress: () => Linking.openURL('https://smartmobility.it/privacy') },
```
In alternativa, se si vuole restare in-app, creare una schermata `/(app)/legal.tsx` con WebView che carica l'URL, e navigarci con `router.push`.

---

## FIX 5 — `VehicleDetailSheet`: tap sul marker non apre il pannello

**File:** `mobile/components/map/VehicleDetailSheet.tsx`

**Problema diagnosticato:**
Il tap sul marker è correttamente cablato (`onPress={() => setSelectedVehicle(v)}` in `index.tsx` riga ~286), e `VehicleDetailSheet` riceve il veicolo selezionato. **Ma il pannello non si apre** perché `@gorhom/bottom-sheet` v5 usa internamente `useAnimatedGestureHandler`, API rimossa in `react-native-reanimated` v4 (installata nel progetto come `~4.1.1`). Il componente fallisce silenziosamente a runtime senza errori visibili.

**Evidenza:**
- `package.json` → `"@gorhom/bottom-sheet": "^5.2.14"` + `"react-native-reanimated": "~4.1.1"` (incompatibili)
- `babel.config.js` → usa `react-native-worklets/plugin` (Reanimated 4), non `react-native-reanimated/plugin` (Reanimated 3)

**Fix — riscrivere VehicleDetailSheet senza la libreria esterna:**
Sostituire l'intero componente con un pannello custom basato su `Animated.Value` di React Native (nessuna dipendenza esterna). Il pannello deve:
- Avere due stati: `peek` (~160px dal basso, mappa visibile) e `expanded` (~55% schermo)
- Aprirsi con `Animated.spring` quando `vehicle` diventa non-null
- Chiudersi con `Animated.timing` quando `vehicle` diventa null o l'utente tocca la X
- Mostrare le stesse informazioni del vecchio componente: tipo, nome, modello, batteria, distanza utente, tariffa, CTA "Prenota"

Struttura di base del nuovo componente:

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '@/constants/theme';
import { type MapVehicle, vehicleIcon, vehicleTypeLabel } from '@/lib/vehicles';
import { type Coords, haversineMeters, formatDistance } from '@/lib/geo';

const SCREEN_H = Dimensions.get('window').height;
const PEEK_H   = 180;  // altezza pannello in stato peek
const EXPANDED_H = Math.round(SCREEN_H * 0.52); // stato espanso

interface Props {
  vehicle: MapVehicle | null;
  userCoords: Coords | null;
  onClose: () => void;
  onReserve: (vehicle: MapVehicle) => void;
}

export default function VehicleDetailSheet({ vehicle, userCoords, onClose, onReserve }: Props) {
  const translateY = useRef(new Animated.Value(PEEK_H)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (vehicle) {
      setVisible(true);
      Animated.spring(translateY, { toValue: 0, tension: 280, friction: 28, useNativeDriver: true }).start();
    } else {
      Animated.timing(translateY, { toValue: PEEK_H, duration: 220, useNativeDriver: true })
        .start(() => setVisible(false));
    }
  }, [vehicle]);

  if (!visible || !vehicle) return null;

  const distM = userCoords
    ? haversineMeters(userCoords, { latitude: vehicle.lat, longitude: vehicle.lng })
    : null;

  return (
    <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
      {/* Handle bar */}
      <View style={styles.handle} />

      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
        <Ionicons name="close" size={18} color={Colors.muted} />
      </TouchableOpacity>

      {/* Vehicle info */}
      <View style={styles.row}>
        <Ionicons name={vehicleIcon(vehicle.type) as any} size={32} color={Colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{vehicle.name}</Text>
          <Text style={styles.sub}>{vehicleTypeLabel(vehicle.type)} · {vehicle.model}</Text>
        </View>
        <Text style={[styles.battery, { color: vehicle.battery_pct > 50 ? Colors.success : Colors.warning }]}>
          {vehicle.battery_pct}%
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Distanza</Text>
          <Text style={styles.statValue}>{distM != null ? formatDistance(distM) : '—'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Sblocco</Text>
          <Text style={styles.statValue}>€ {vehicle.unlock_fee.toFixed(2)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Al minuto</Text>
          <Text style={styles.statValue}>€ {vehicle.price_per_min.toFixed(2)}</Text>
        </View>
      </View>

      {/* CTA */}
      <TouchableOpacity style={styles.cta} onPress={() => onReserve(vehicle)} activeOpacity={0.85}>
        <LinearGradient colors={Gradients.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGradient}>
          <Text style={styles.ctaText}>Prenota</Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.text} />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet:      { position: 'absolute', bottom: 0, left: 0, right: 0, height: PEEK_H, backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.border, padding: 16, zIndex: 40 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 12 },
  closeBtn:   { position: 'absolute', top: 14, right: 14, padding: 4 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  name:       { color: Colors.text, fontWeight: '700', fontSize: 16 },
  sub:        { color: Colors.muted, fontSize: 13, marginTop: 2 },
  battery:    { fontWeight: '700', fontSize: 16 },
  stats:      { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  stat:       { alignItems: 'center', gap: 2 },
  statLabel:  { color: Colors.muted, fontSize: 11 },
  statValue:  { color: Colors.text, fontWeight: '700', fontSize: 14 },
  cta:        { borderRadius: 14, overflow: 'hidden' },
  ctaGradient:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  ctaText:    { color: Colors.text, fontWeight: '700', fontSize: 15 },
});
```

Dopo questo fix, **eliminare `@gorhom/bottom-sheet` dal `package.json`** (non viene più usata altrove).

---

## FIX 6 — `index.tsx` + `routers/vehicles.py`: spawn veicoli alla posizione reale non funziona

**Problema — doppia causa:**

### Causa A — frontend: GPS asincrono, prima fetch senza coordinate
In `mobile/app/(app)/index.tsx`, il `useEffect([coords])` che fa il polling si avvia subito con `coords = null` (il GPS non è ancora pronto). Quindi la prima chiamata è `vehiclesApi.list(true, undefined, undefined)` → il backend non riceve lat/lng → nessun riposizionamento → i veicoli appaiono nelle coordinate del seed (Bari).

Quando il GPS carica (1–5 secondi dopo), `coords` diventa non-null → l'effect si re-esegue → la seconda chiamata include lat/lng → il backend riposiziona. Ma l'utente ha già visto i veicoli a Bari e potrebbe non aspettare.

**Fix — aggiungere una fetch immediata separata appena il GPS diventa disponibile:**
```typescript
// In index.tsx, DOPO il useEffect([coords]) esistente, aggiungere:
const prevCoords = useRef<typeof coords>(null);
useEffect(() => {
  // Trigger immediato solo quando coords passa da null a un valore reale
  if (coords && !prevCoords.current) {
    vehiclesApi.list(true, coords.latitude, coords.longitude)
      .then((list) => setVehicles(list.map(toMapVehicle)))
      .catch(() => {});
  }
  prevCoords.current = coords;
}, [coords]);
```
Questo garantisce una fetch "urgente" con le coordinate reali appena il GPS risponde, senza aspettare il prossimo ciclo dell'interval da 8s.

### Causa B — backend: soglia di riposizionamento troppo restrittiva
In `backend/app/routers/vehicles.py`, il riposizionamento avviene **solo se nessun veicolo è entro ~1.7km dall'utente**:
```python
nearby = [v for v in available_vehicles if ((v.lat - lat)**2 + (v.lng - lng)**2)**0.5 < 0.015]
if not nearby and available_vehicles:
    # riposiziona
```
Il problema è che:
1. La distanza Euclidea su gradi lat/lng è imprecisa (1° di longitudine ≈ 0.7° di latitudine in km a Bari)
2. Con solo 1 veicolo in DB (prima del FIX 2), anche se il riposizionamento scatta, un solo veicolo viene spostato
3. Dopo FIX 2 (40 veicoli), questo funzionerà — ma la soglia va alzata a `0.05` (~5km) per demo più convincente:

```python
# In backend/app/routers/vehicles.py, riga ~33:
# Prima:
nearby = [v for v in available_vehicles if ((v.lat - lat)**2 + (v.lng - lng)**2)**0.5 < 0.015]
# Dopo (soglia 5km, più robusta):
nearby = [v for v in available_vehicles if ((v.lat - lat)**2 + (v.lng - lng)**2)**0.5 < 0.05]
```

**Nota:** il riposizionamento funziona solo con il FIX 2 (40 veicoli). Applicare entrambi insieme.

---

## Riepilogo priorità (aggiornato)

| # | File/i | Gravità | Tipo |
|---|--------|---------|------|
| 1 | `backend/app/main.py` | 🔴 Critico | Crash SQLite alla startup |
| 2 | `backend/app/seed.py` | 🔴 Critico | 1 solo veicolo → app inutilizzabile |
| 5 | `mobile/components/map/VehicleDetailSheet.tsx` | 🔴 Critico | Tap marker → nulla (incompatibilità Reanimated v4) |
| 6 | `mobile/app/(app)/index.tsx` + `routers/vehicles.py` | 🟠 Alta | Spawn veicoli sempre a Bari, non alla posizione reale |
| 3 | `mobile/app/(auth)/forgot-password.tsx` | 🟠 Alta | UX disonesta (fake success) |
| 4 | `mobile/app/(app)/profile.tsx` | 🟡 Media | Dead-end Termini/Privacy |

---

## NON modificare (già implementato e funzionante)

- `routers/vehicles.py` → drift GPS + riposizionamento vicino utente (logica già presente, solo soglia da correggere) ✅
- `routers/rides.py` → endpoint pause (`PATCH /rides/{id}/pause`) ✅
- `routers/geo.py` → geocoding Nominatim + routing OSRM ✅
- `routers/users.py` → `GET/PATCH /users/me/preferences` ✅
- `mobile/app/(app)/index.tsx` → polling 8s + lat/lng passati all'API (solo soglia GPS da migliorare) ✅
- `mobile/app/(app)/active-ride.tsx` → geoApi.route + ridesApi.pause ✅
- `mobile/app/(app)/settings.tsx` → `usersApi.getPreferences/updatePreferences` ✅
- `mobile/app/(app)/scan.tsx` → `ridesApi.start` + navigazione a active-ride ✅
- `mobile/app/(app)/support.tsx` → chat → `router.push('/(app)/messages')` ✅
- `mobile/lib/api/endpoints.ts` → tutti gli endpoint già definiti ✅
