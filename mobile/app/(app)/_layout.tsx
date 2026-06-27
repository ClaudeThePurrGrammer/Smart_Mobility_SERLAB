import { useEffect, useRef } from 'react';
import { Tabs, router, usePathname, useRootNavigationState } from 'expo-router';
import { View, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { authApi } from '@/lib/api/endpoints';
import { registerAccountBlockedCallback } from '@/lib/api/client';
import { RideSessionProvider, useRideSession } from '@/lib/ride/RideSessionContext';
import { ReservationSessionProvider, useReservationSession } from '@/lib/reservation/ReservationSessionContext';
import { SearchProvider } from '@/lib/search/SearchContext';

// Logout forzato quando l'account viene sospeso/bloccato dall'operatore:
// (1) reattivo via interceptor 403 dell'API client, (2) polling di sicurezza
// ogni 30s su /auth/me mentre l'app è aperta. Mostra un Alert e torna al login.
function AccountStatusGuard() {
  const { token, logout } = useAuth();
  const firingRef = useRef(false);

  useEffect(() => {
    const handleBlocked = () => {
      if (firingRef.current) return;
      firingRef.current = true;
      Alert.alert(
        'Account non disponibile',
        'Il tuo account è stato sospeso o bloccato dall\'operatore. Contatta il supporto per maggiori informazioni.',
        [{
          text: 'OK',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        }],
        { cancelable: false },
      );
    };
    registerAccountBlockedCallback(handleBlocked);
    return () => registerAccountBlockedCallback(null);
  }, [logout]);

  // Polling di sicurezza: se l'utente è inattivo, forziamo una chiamata che,
  // in caso di account bloccato, restituisce 403 → scatta l'interceptor.
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => { authApi.me(token).catch(() => {}); }, 30_000);
    return () => clearInterval(id);
  }, [token]);

  return null;
}

// Schermate raggiungibili durante una corsa attiva: il flusso di uscita
// consentito è solo active-ride → end-ride. Tutto il resto è bloccato.
// NOTA: '/active-reservation' è incluso per evitare la race condition in cui
// startSession(ride) viene committato da React prima che router.replace verso
// active-ride completi la navigazione: senza questo, il guard ridirigerebbe a
// active-ride senza i params (rideId = undefined) → handleEndRide non chiude
// la corsa → corsa "stuck" sul backend → loop al prossimo caricamento.
// '/report' è incluso: durante la corsa l'utente può aprire la schermata
// di segnalazione senza essere rediretto ad active-ride dal guard.
const RIDE_LOCKED_ALLOWED = ['/active-ride', '/end-ride', '/active-reservation', '/report', '/reports-history', '/ride-payment', '/payment'];

function TabIcon({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  return (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: focused ? 'rgba(79,142,247,0.12)' : 'transparent',
      shadowColor: '#7C3AED',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: focused ? 0.85 : 0,
      shadowRadius: focused ? 10 : 0,
    }}>
      <Ionicons name={name} size={24} color={color} />
    </View>
  );
}

function ActiveRideTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const { session, loading } = useRideSession();
  const isActive = !loading && session !== null;
  return (
    <View style={{
      alignItems: 'center', justifyContent: 'center',
      width: 36, height: 36, borderRadius: 12,
      backgroundColor: isActive
        ? 'rgba(124,58,237,0.2)'
        : focused ? 'rgba(79,142,247,0.12)' : 'transparent',
    }}>
      <Ionicons name="bicycle" size={24} color={isActive ? Colors.primary : color} />
      {isActive && (
        <View style={{
          position: 'absolute', top: 4, right: 4,
          width: 7, height: 7, borderRadius: 3.5,
          backgroundColor: Colors.success,
        }} />
      )}
    </View>
  );
}

export default function AppLayout() {
  // I provider devono stare SOPRA <AppTabs> così da poter leggere session.
  return (
    <RideSessionProvider>
      <ReservationSessionProvider>
        <SearchProvider>
          <AccountStatusGuard />
          <AppTabs />
        </SearchProvider>
      </ReservationSessionProvider>
    </RideSessionProvider>
  );
}

function AppTabs() {
  const { session } = useRideSession();
  const { reservation } = useReservationSession();
  // Tab bloccate sia con corsa attiva sia con prenotazione attiva.
  const isLocked = session !== null || reservation !== null;
  const pathname = usePathname();
  const navState = useRootNavigationState();
  // navState?.key è truthy già al primo mount (root container pronto), ma il
  // Tabs non ha ancora eseguito i propri effect interni per registrare i suoi
  // screen. Verifichiamo che 'active-ride' compaia nei routeNames del child
  // state annidato prima di emettere qualsiasi azione imperativa.
  const tabsReady = navState?.routes?.some(
    (r: any) => r.state?.routeNames?.includes('active-ride')
  ) ?? false;

  useEffect(() => {
    if (!tabsReady) return;
    if (isLocked && !RIDE_LOCKED_ALLOWED.includes(pathname)) {
      // PROBLEMA B: passare i params dalla sessione evita la race con il
      // router.replace del chiamante (active-ride senza rideId → loop).
      if (session !== null) {
        router.replace({
          pathname: '/(app)/active-ride',
          params: {
            rideId: String(session.rideId),
            vehicleId: String(session.vehicleId),
          },
        });
      } else if (reservation !== null) {
        // active-reservation legge i propri dati da params/context: nessun param qui.
        router.replace('/(app)/active-reservation');
      }
    }
  }, [session, reservation, isLocked, pathname, tabsReady]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Durante corsa o prenotazione attiva la tab bar è completamente nascosta.
        tabBarStyle: isLocked
          ? { display: 'none' }
          : {
              backgroundColor: Colors.card,
              borderTopColor: Colors.border,
              borderTopWidth: 1,
              height: 70,
              paddingBottom: 10,
              paddingTop: 8,
            },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Corsa',
          tabBarIcon: ({ color, focused }) => (
            <ActiveRideTabIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="activate"
        options={{
          title: 'Scansiona',
          tabBarIcon: ({ focused }) => (
            <View style={{
              backgroundColor: Colors.primary,
              borderRadius: 16,
              width: 48,
              height: 48,
              marginBottom: -8,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: focused ? 0.9 : 0.5,
              shadowRadius: focused ? 12 : 6,
              elevation: focused ? 8 : 4,
            }}>
              <MaterialCommunityIcons name="qrcode" size={26} color={Colors.text} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Notifiche',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="notifications-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profilo',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-outline" color={color} focused={focused} />
          ),
        }}
      />
      {/* Schermate fuori dal tab bar */}
      <Tabs.Screen name="scan"         options={{ href: null }} />
      <Tabs.Screen name="reserve"      options={{ href: null }} />
      <Tabs.Screen name="active-ride"  options={{ href: null }} />
      <Tabs.Screen name="end-ride"     options={{ href: null }} />
      <Tabs.Screen name="payment"      options={{ href: null }} />
      <Tabs.Screen name="ride-history" options={{ href: null }} />
      <Tabs.Screen name="promotions"   options={{ href: null }} />
      <Tabs.Screen name="loyalty"      options={{ href: null }} />
      <Tabs.Screen name="wallet"       options={{ href: null }} />
      <Tabs.Screen name="settings"     options={{ href: null }} />
      <Tabs.Screen name="report"       options={{ href: null }} />
      <Tabs.Screen name="support"      options={{ href: null }} />
      <Tabs.Screen name="chat-support"    options={{ href: null }} />
      <Tabs.Screen name="ticket"          options={{ href: null }} />
      <Tabs.Screen name="vehicle-action"      options={{ href: null }} />
      <Tabs.Screen name="active-reservation"  options={{ href: null }} />
      <Tabs.Screen name="reports-history"     options={{ href: null }} />
      <Tabs.Screen name="ride-payment"        options={{ href: null }} />
      <Tabs.Screen name="payment-receipt"    options={{ href: null }} />
    </Tabs>
  );
}
