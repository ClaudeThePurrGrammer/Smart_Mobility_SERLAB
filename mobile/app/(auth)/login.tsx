import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  ScrollView, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import GradientButton from '@/components/ui/GradientButton';
import SocialButton from '@/components/ui/SocialButton';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.replace('/(app)');
    }, 1000);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#08081A' }}
    >
      {/* Background */}
      <LinearGradient
        colors={['#08081A', '#0E0E26', '#08081A']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />
      <LinearGradient
        colors={['rgba(79,142,247,0.14)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.5 }}
      />
      <LinearGradient
        colors={['transparent', 'rgba(124,58,237,0.10)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.4 }}
      />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: 72, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <View style={{
            shadowColor: '#7C3AED',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.65,
            shadowRadius: 28,
            elevation: 14,
            marginBottom: 20,
          }}>
            <Image
              source={require('@/assets/logo.png')}
              style={{ width: 116, height: 116, borderRadius: 26 }}
              resizeMode="cover"
            />
          </View>
          <Text style={{ color: '#FFFFFF', fontSize: 34, fontWeight: '900', letterSpacing: 7, marginBottom: 3 }}>
            SMART
          </Text>
          <Text style={{ color: Colors.accent, fontSize: 13, fontWeight: '400', letterSpacing: 11 }}>
            MOBILITY
          </Text>
        </View>

        {/* Headline */}
        <Text style={{ color: Colors.text, fontSize: 27, fontWeight: '800', marginBottom: 8, lineHeight: 36 }}>
          Muoviti in modo{' '}
          <Text style={{ color: Colors.accent }}>intelligente</Text>
        </Text>
        <Text style={{ color: Colors.muted, fontSize: 15, marginBottom: 32, lineHeight: 22 }}>
          Tutti i servizi di mobilità, in un'unica app.
        </Text>

        {/* Inputs */}
        <View style={{ gap: 14, marginBottom: 12 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.055)',
            borderWidth: 1, borderColor: 'rgba(167,139,250,0.22)',
            borderRadius: 30, paddingHorizontal: 20, height: 56,
          }}>
            <Ionicons name="person-outline" size={20} color={Colors.muted} style={{ marginRight: 12 }} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email o numero di telefono"
              placeholderTextColor={Colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{ flex: 1, color: Colors.text, fontSize: 16 }}
            />
          </View>

          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.055)',
            borderWidth: 1, borderColor: 'rgba(167,139,250,0.22)',
            borderRadius: 30, paddingHorizontal: 20, height: 56,
          }}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.muted} style={{ marginRight: 12 }} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={Colors.muted}
              secureTextEntry={!showPassword}
              style={{ flex: 1, color: Colors.text, fontSize: 16 }}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={{ alignSelf: 'flex-end', marginBottom: 28 }}
          onPress={() => router.push('/(auth)/forgot-password' as any)}
        >
          <Text style={{ color: Colors.accent, fontSize: 14, fontWeight: '500' }}>
            Password dimenticata?
          </Text>
        </TouchableOpacity>

        <GradientButton
          title="Accedi"
          onPress={handleLogin}
          loading={loading}
          full
          pill
          icon={<Ionicons name="arrow-forward" size={18} color={Colors.text} />}
          style={{ marginBottom: 32 }}
        />

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 22 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <Text style={{ color: Colors.muted, marginHorizontal: 16, fontSize: 13 }}>Oppure accedi con</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 40 }}>
          <SocialButton provider="google" onPress={() => {}} />
          <SocialButton provider="apple" onPress={() => {}} />
          <SocialButton provider="facebook" onPress={() => {}} />
        </View>

        <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => router.push('/(auth)/register' as any)}>
          <Text style={{ color: Colors.muted, fontSize: 15 }}>
            Non hai un account?{' '}
            <Text style={{ color: Colors.accent, fontWeight: '700' }}>Registrati →</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
