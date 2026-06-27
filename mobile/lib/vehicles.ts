// lib/vehicles.ts
// Sorgente dati dei mezzi geolocalizzati mostrati sulla ComponenteMappa (CU-02).
// [DA VERIFICARE] Dati mock locali: il CONTROLLER (FastAPI) è ancora commentato in
// docker-compose.yml. Quando il backend sarà attivo, questi mezzi arriveranno via
// REST (View_to_Controller, HTTPS/JSON) e questo array sarà sostituito da una fetch.

import type { VehicleType } from '@/components/ui/VehicleCard';

export interface MapVehicle {
  id: string;
  name: string;
  model: string;
  type: VehicleType;
  lat: number;
  lng: number;
  batteryPct: number;
}

/** Coordinate ereditate dai MOCK_VEHICLES originali della home (zona Bari). */
export const MAP_VEHICLES: MapVehicle[] = [
  { id: '1', name: 'Monopattino',    model: 'Flash F2',   type: 'scooter', lat: 41.1177, lng: 16.8718, batteryPct: 78  },
  { id: '2', name: 'Auto elettrica', model: 'City EV',    type: 'car',     lat: 41.1200, lng: 16.8690, batteryPct: 92  },
  { id: '3', name: 'Auto elettrica', model: 'Compact EV', type: 'car',     lat: 41.1155, lng: 16.8750, batteryPct: 76  },
  { id: '4', name: 'Monopattino',    model: 'Urban Pro',  type: 'scooter', lat: 41.1190, lng: 16.8760, batteryPct: 42  },
  { id: '5', name: 'Bici elettrica', model: 'E-Bike X',   type: 'ebike',   lat: 41.1210, lng: 16.8720, batteryPct: 88  },
];

/** Converte un mezzo proveniente dal Controller (snake_case, id numerico) in MapVehicle. */
export function toMapVehicle(v: {
  id: number; name: string; model: string; type: string; lat: number; lng: number; battery_pct: number;
}): MapVehicle {
  return {
    id: String(v.id),
    name: v.name,
    model: v.model,
    type: v.type as MapVehicle['type'],
    lat: v.lat,
    lng: v.lng,
    batteryPct: v.battery_pct,
  };
}

/** Icona MaterialCommunityIcons per tipologia — indicatori distinti sulla mappa (CU-02 passo 3). */
export const vehicleIcon: Record<VehicleType, string> = {
  scooter: 'scooter',
  ebike:   'bicycle-electric',
  car:     'car-electric',
};

/** Etichetta tipologia in italiano. */
export const vehicleTypeLabel: Record<VehicleType, string> = {
  scooter: 'Monopattino',
  ebike:   'Bici elettrica',
  car:     'Auto elettrica',
};
