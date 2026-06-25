import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

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

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
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
            <TabIcon name="bicycle" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
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
      <Tabs.Screen name="chat-support" options={{ href: null }} />
      <Tabs.Screen name="ticket"       options={{ href: null }} />
    </Tabs>
  );
}
