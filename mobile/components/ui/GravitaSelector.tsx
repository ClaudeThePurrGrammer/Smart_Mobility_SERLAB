import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/theme';

export type Gravita = 'BASSA' | 'MEDIA' | 'ALTA';

interface Props {
  value: Gravita;
  onChange: (v: Gravita) => void;
}

const OPTIONS: { value: Gravita; label: string; color: string }[] = [
  { value: 'BASSA', label: 'Bassa', color: '#10B981' },
  { value: 'MEDIA', label: 'Media', color: '#F59E0B' },
  { value: 'ALTA',  label: 'Alta',  color: '#EF4444' },
];

export default function GravitaSelector({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map(opt => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.chip,
              selected && { borderColor: opt.color, backgroundColor: `${opt.color}18` },
            ]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.75}
          >
            <View style={[styles.dot, { backgroundColor: opt.color }]} />
            <Text style={[styles.chipText, selected && { color: opt.color }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', gap: 10 },
  chip:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, paddingVertical: 10 },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: Colors.muted, fontSize: 13, fontWeight: '600' },
});
