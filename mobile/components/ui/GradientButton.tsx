import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gradients, Colors } from '@/constants/theme';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  full?: boolean;
  pill?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  variant?: 'primary' | 'outline';
}

export default function GradientButton({ title, onPress, loading, full, pill, icon, style, variant = 'primary' }: Props) {
  if (variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={loading}
        style={[
          {
            borderWidth: 1,
            borderColor: Colors.primary,
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 20,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            width: full ? '100%' : undefined,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <>
            <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 16 }}>{title}</Text>
            {icon}
          </>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={[{ borderRadius: pill ? 30 : 14, overflow: 'hidden', width: full ? '100%' : undefined }, style]}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={Gradients.primaryBtn}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingVertical: 16,
          paddingHorizontal: 24,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 10,
        }}
      >
        {loading ? (
          <ActivityIndicator color={Colors.text} />
        ) : (
          <>
            <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 17, letterSpacing: 0.3 }}>
              {title}
            </Text>
            {icon}
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}
