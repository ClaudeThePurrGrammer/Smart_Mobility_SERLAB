import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import GradientButton from '@/components/ui/GradientButton';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleRegister = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.replace('/(app)');
    }, 1200);
  };

  const field = (
    icon: any, value: string, setter: (v: string) => void,
    placeholder: string, extra?: object
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, height: 54 }}>
      <Ionicons name={icon} size={20} color={Colors.muted} style={{ marginRight: 12 }} />
      <TextInput
        value={value}
        onChangeText={setter}
        placeholder={placeholder}
        placeholderTextColor={Colors.muted}
        style={{ flex: 1, color: Colors.text, fontSize: 16 }}
        {...extra}
      />
    </View>
  );

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

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 24 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <Text style={{ color: Colors.text, fontSize: 26, fontWeight: '800', marginBottom: 4, lineHeight: 34 }}>
          Crea il tuo{' '}
          <Text style={{ color: Colors.accent }}>account</Text>
        </Text>
        <Text style={{ color: Colors.muted, fontSize: 15, marginBottom: 28 }}>
          Unisciti a Smart Mobility
        </Text>

        <View style={{ gap: 14, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, height: 54, justifyContent: 'center' }}>
              <TextInput value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={Colors.muted} style={{ color: Colors.text, fontSize: 16 }} />
            </View>
            <View style={{ flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, height: 54, justifyContent: 'center' }}>
              <TextInput value={surname} onChangeText={setSurname} placeholder="Cognome" placeholderTextColor={Colors.muted} style={{ color: Colors.text, fontSize: 16 }} />
            </View>
          </View>

          {field('mail-outline', email, setEmail, 'Email', { keyboardType: 'email-address', autoCapitalize: 'none' })}

          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, height: 54 }}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.muted} style={{ marginRight: 12 }} />
            <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={Colors.muted} secureTextEntry={!showPwd} style={{ flex: 1, color: Colors.text, fontSize: 16 }} />
            <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: confirm && confirm !== password ? Colors.danger : Colors.border, borderRadius: 14, paddingHorizontal: 16, height: 54 }}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.muted} style={{ marginRight: 12 }} />
            <TextInput value={confirm} onChangeText={setConfirm} placeholder="Conferma password" placeholderTextColor={Colors.muted} secureTextEntry={!showPwd} style={{ flex: 1, color: Colors.text, fontSize: 16 }} />
          </View>
          {confirm !== '' && confirm !== password && (
            <Text style={{ color: Colors.danger, fontSize: 12, marginTop: -8, paddingLeft: 4 }}>Le password non coincidono</Text>
          )}
        </View>

        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 28 }}
          onPress={() => setAccepted(!accepted)}
        >
          <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: accepted ? Colors.primary : Colors.border, backgroundColor: accepted ? Colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            {accepted && <Ionicons name="checkmark" size={14} color={Colors.text} />}
          </View>
          <Text style={{ color: Colors.muted, fontSize: 13, flex: 1, lineHeight: 20 }}>
            Accetto i <Text style={{ color: Colors.accent }}>Termini di Servizio</Text> e la <Text style={{ color: Colors.accent }}>Privacy Policy</Text> di Smart Mobility
          </Text>
        </TouchableOpacity>

        <GradientButton
          title="Crea account"
          onPress={handleRegister}
          loading={loading}
          full
          icon={<Ionicons name="arrow-forward" size={18} color={Colors.text} />}
          style={{ marginBottom: 24 }}
        />

        <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => router.back()}>
          <Text style={{ color: Colors.muted, fontSize: 15 }}>
            Hai già un account?{' '}
            <Text style={{ color: Colors.accent, fontWeight: '700' }}>Accedi →</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
