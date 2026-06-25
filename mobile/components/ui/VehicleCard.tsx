import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

export type VehicleType = 'scooter' | 'bike' | 'ebike' | 'car';

export interface Vehicle {
  id: string;
  name: string;
  model: string;
  type: VehicleType;
  batteryPct: number;
  distanceToM: number;
  walkMinutes: number;
  tripKm: number;
  estimatedEur: number;
  recommended?: boolean;
}

interface Props {
  vehicle: Vehicle;
  selected?: boolean;
  onPress: (v: Vehicle) => void;
}

const typeIcon: Record<VehicleType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  scooter: 'scooter',
  bike:    'bicycle',
  ebike:   'bicycle-electric',
  car:     'car-electric',
};

function BatteryBar({ pct }: { pct: number }) {
  const color = pct > 50 ? Colors.success : pct > 20 ? Colors.warning : Colors.danger;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="battery-half" size={14} color={color} />
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{pct}%</Text>
    </View>
  );
}

export default function VehicleCard({ vehicle, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={() => onPress(vehicle)}
      activeOpacity={0.85}
      style={{
        backgroundColor: selected ? 'rgba(124,58,237,0.2)' : Colors.card,
        borderWidth: 1,
        borderColor: selected ? Colors.primary : Colors.border,
        borderRadius: 16,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      {/* Contenuto della card */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
        <View style={{
          width: 52, height: 52, borderRadius: 12,
          backgroundColor: Colors.surface,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <MaterialCommunityIcons name={typeIcon[vehicle.type]} size={28} color={Colors.accent} />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 15 }}>{vehicle.name}</Text>
          <Text style={{ color: Colors.muted, fontSize: 12 }}>{vehicle.model}</Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <BatteryBar pct={vehicle.batteryPct} />
            <Text style={{ color: Colors.muted, fontSize: 12 }}>
              <Ionicons name="walk" size={12} /> {vehicle.distanceToM}m
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ color: Colors.accent, fontWeight: '700', fontSize: 16 }}>
            € {vehicle.estimatedEur.toFixed(2)}
          </Text>
          <Text style={{ color: Colors.muted, fontSize: 11 }}>
            {vehicle.walkMinutes}min · {vehicle.tripKm}km
          </Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
        </View>
      </View>
    </TouchableOpacity>
  );
}
