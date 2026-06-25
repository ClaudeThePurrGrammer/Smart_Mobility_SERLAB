import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import GradientButton from '@/components/ui/GradientButton';

import { authApi } from '@/lib/api/endpoints';

export default function ForgotPasswordScreen() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
    } catch { /* ignora: risposta sempre OK */ }
    setLoading(false);
    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: Colors.bg }}
    >
      <LinearGradient
        colors={['#0D0D1A', '#1A0A2E', '#0D0D1A']}
        locations={[0, 0.4, 1]}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 32 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        {!sent ? (
          <>
            <View style={{ alignItems: 'center', marginBottom: 36 }}>
              <LinearGradient colors={Gradients.primary} style={{ width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Ionicons name="lock-open-outline" size={34} color={Colors.text} />
              </LinearGradient>
              <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '800', marginBottom: 8 }}>
                Password dimenticata?
              </Text>
              <Text style={{ color: Colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
                Inserisci la tua email e ti invieremo un link per reimpostare la password.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, height: 54, marginBottom: 24 }}>
              <Ionicons name="mail-outline" size={20} color={Colors.muted} style={{ marginRight: 12 }} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="La tua email"
                placeholderTextColor={Colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ flex: 1, color: Colors.text, fontSize: 16 }}
              />
            </View>

            <GradientButton
              title="Invia link di reset"
              onPress={handleSend}
              loading={loading}
              full
              icon={<Ionicons name="send-outline" size={18} color={Colors.text} />}
            />
          </>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <LinearGradient colors={['#22C55E', '#16A34A']} style={{ width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={42} color={Colors.text} />
            </LinearGradient>
            <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '800' }}>Email inviata!</Text>
            <Text style={{ color: Colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
              Controlla la casella di {email} e segui il link per reimpostare la password.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 }}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={{ color: Colors.text, fontWeight: '600', fontSize: 15 }}>Torna al login</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
