import React from 'react';
import { View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  padding?: number;
}

export default function GlassCard({ children, style, intensity = 40, padding = 16 }: Props) {
  return (
    <BlurView
      intensity={intensity}
      tint="dark"
      style={[
        {
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: Colors.border,
        },
        style,
      ]}
    >
      <View
        style={{
          backgroundColor: 'rgba(26,26,53,0.75)',
          padding,
        }}
      >
        {children}
      </View>
    </BlurView>
  );
}
