import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

function TabIcon({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  return (
    <View style={{
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 12,
      padding: focused ? 6 : 0,
      backgroundColor: focused ? 'rgba(79,142,247,0.12)' : 'transparent',
      shadowColor: focused ? '#7C3AED' : 'transparent',
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
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              backgroundColor: Colors.primary,
              borderRadius: 16,
              padding: 8,
              marginBottom: 4,
            }}>
              <MaterialCommunityIcons name="qrcode-scan" size={26} color={Colors.text} />
            </View>
          ),
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700', color: Colors.primary },
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messaggi',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="chatbubble-outline" color={color} focused={focused} />
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
      <Tabs.Screen name="active-ride"  options={{ href: null }} />
      <Tabs.Screen name="end-ride"     options={{ href: null }} />
      <Tabs.Screen name="payment"      options={{ href: null }} />
      <Tabs.Screen name="ride-history" options={{ href: null }} />
      <Tabs.Screen name="promotions"   options={{ href: null }} />
      <Tabs.Screen name="wallet"       options={{ href: null }} />
      <Tabs.Screen name="settings"     options={{ href: null }} />
      <Tabs.Screen name="report"       options={{ href: null }} />
    </Tabs>
  );
}
