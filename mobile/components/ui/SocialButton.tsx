import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

type Provider = 'google' | 'apple' | 'facebook';

interface Props {
  provider: Provider;
  onPress: () => void;
}

const config: Record<Provider, { label: string; icon: React.ReactNode }> = {
  google: {
    label: 'Google',
    icon: <FontAwesome name="google" size={22} color="#EA4335" />,
  },
  apple: {
    label: 'Apple',
    icon: <Ionicons name="logo-apple" size={22} color={Colors.text} />,
  },
  facebook: {
    label: 'Facebook',
    icon: <FontAwesome name="facebook" size={22} color="#1877F2" />,
  },
};

export default function SocialButton({ provider, onPress }: Props) {
  const { label, icon } = config[provider];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.25)',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        flex: 1,
      }}
    >
      {icon}
      <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '500' }}>{label}</Text>
    </TouchableOpacity>
  );
}
