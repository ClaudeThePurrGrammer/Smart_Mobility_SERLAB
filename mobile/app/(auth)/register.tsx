import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Gradients } from '@/constants/theme';
import GradientButton from '@/components/ui/GradientButton';
import { useAuth } from '@/lib/auth/AuthContext';

type Role = 'UTENTE' | 'OPERATORE' | 'AMMINISTRAZIONE';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'UTENTE', label: 'Utente' },
  { value: 'OPERATORE', label: 'Operatore' },
  { value: 'AMMINISTRAZIONE', label: 'Amministrazione Pubblica' },
];

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('UTENTE');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [codiceAttivazione, setCodiceAttivazione] = useState('');

  const codiceAnim = useRef(new Animated.Value(0)).current;
  const needsCodice = role !== 'UTENTE';

  useEffect(() => {
    Animated.timing(codiceAnim, {
      toValue: needsCodice ? 1 : 0,
      duration: 240,
      useNativeDriver: false,
    }).start();
    if (!needsCodice) setCodiceAttivazione('');
  }, [needsCodice]);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError('Compila nome, email e password.');
      return;
    }
    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri.');
      return;
    }
    if (password !== confirm) {
      setError('Le password non coincidono.');
      return;
    }
    if (needsCodice && !/^\d{5}$/.test(codiceAttivazione)) {
      setError('Il codice di attivazione deve essere di esattamente 5 cifre numeriche.');
      return;
    }
    if (!accepted) {
      setError('Devi accettare i Termini di Servizio.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const u = await register({
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        password,
        role,
        ...(needsCodice ? { codice_attivazione: codiceAttivazione } : {}),
      });
      const dest = u.role === 'AMMINISTRAZIONE' ? '/(admin)' : u.role === 'OPERATORE' ? '/(operatore)' : '/(app)';
      router.replace(dest as any);
    } catch (e: any) {
      setError(e?.message ?? 'Registrazione non riuscita.');
    } finally {
      setLoading(false);
    }
  };

  const selectedLabel = ROLE_OPTIONS.find(o => o.value === role)?.label ?? 'Utente';

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
          {/* Nome / Cognome */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, height: 54, justifyContent: 'center' }}>
              <TextInput value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={Colors.muted} style={{ color: Colors.text, fontSize: 16 }} />
            </View>
            <View style={{ flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, height: 54, justifyContent: 'center' }}>
              <TextInput value={surname} onChangeText={setSurname} placeholder="Cognome" placeholderTextColor={Colors.muted} style={{ color: Colors.text, fontSize: 16 }} />
            </View>
          </View>

          {field('mail-outline', email, setEmail, 'Email', { keyboardType: 'email-address', autoCapitalize: 'none' })}

          {/* Password */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, height: 54 }}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.muted} style={{ marginRight: 12 }} />
            <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={Colors.muted} secureTextEntry={!showPwd} style={{ flex: 1, color: Colors.text, fontSize: 16 }} />
            <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Conferma password */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: confirm && confirm !== password ? Colors.danger : Colors.border, borderRadius: 14, paddingHorizontal: 16, height: 54 }}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.muted} style={{ marginRight: 12 }} />
            <TextInput value={confirm} onChangeText={setConfirm} placeholder="Conferma password" placeholderTextColor={Colors.muted} secureTextEntry={!showPwd} style={{ flex: 1, color: Colors.text, fontSize: 16 }} />
          </View>
          {confirm !== '' && confirm !== password && (
            <Text style={{ color: Colors.danger, fontSize: 12, marginTop: -8, paddingLeft: 4 }}>Le password non coincidono</Text>
          )}

          {/* Selettore ruolo */}
          <View>
            <Text style={{ color: Colors.muted, fontSize: 13, marginBottom: 8, paddingLeft: 4 }}>Tipo di account</Text>
            <TouchableOpacity
              onPress={() => setDropdownOpen(v => !v)}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: Colors.card,
                borderWidth: 1, borderColor: dropdownOpen ? Colors.primary : Colors.border,
                borderRadius: 14, paddingHorizontal: 16, height: 54,
              }}
            >
              <Ionicons name="person-circle-outline" size={20} color={Colors.muted} style={{ marginRight: 12 }} />
              <Text style={{ flex: 1, color: Colors.text, fontSize: 16 }}>{selectedLabel}</Text>
              <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.muted} />
            </TouchableOpacity>

            {dropdownOpen && (
              <View style={{
                backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
                borderRadius: 14, marginTop: 4, overflow: 'hidden',
              }}>
                {ROLE_OPTIONS.map((opt, idx) => (
                  <TouchableOpacity
                    key={opt.value}
                    activeOpacity={0.7}
                    onPress={() => { setRole(opt.value); setDropdownOpen(false); }}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 16, height: 48,
                      borderTopWidth: idx > 0 ? 1 : 0, borderColor: Colors.border,
                      backgroundColor: role === opt.value ? 'rgba(124,58,237,0.15)' : 'transparent',
                    }}
                  >
                    <Text style={{ flex: 1, color: role === opt.value ? Colors.accent : Colors.text, fontSize: 15 }}>
                      {opt.label}
                    </Text>
                    {role === opt.value && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Campo codice attivazione — animato */}
          <Animated.View style={{
            overflow: 'hidden',
            opacity: codiceAnim,
            maxHeight: codiceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }),
          }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: Colors.card, borderWidth: 1,
              borderColor: codiceAttivazione.length > 0 && codiceAttivazione.length < 5 ? Colors.danger : Colors.border,
              borderRadius: 14, paddingHorizontal: 16, height: 54,
            }}>
              <Ionicons name="key-outline" size={20} color={Colors.muted} style={{ marginRight: 12 }} />
              <TextInput
                value={codiceAttivazione}
                onChangeText={v => setCodiceAttivazione(v.replace(/\D/g, '').slice(0, 5))}
                placeholder="Codice di attivazione (5 cifre)"
                placeholderTextColor={Colors.muted}
                keyboardType="number-pad"
                maxLength={5}
                style={{ flex: 1, color: Colors.text, fontSize: 16, letterSpacing: 4 }}
              />
              {codiceAttivazione.length === 5 && (
                <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
              )}
            </View>
          </Animated.View>
        </View>

        {/* Termini di Servizio */}
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

        {error && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
            <Text style={{ color: Colors.danger, fontSize: 13, flex: 1 }}>{error}</Text>
          </View>
        )}

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
