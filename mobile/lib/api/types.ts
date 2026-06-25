// lib/api/types.ts — Modelli dati restituiti dal Controller (rispecchiano gli schemi Pydantic).

export interface ApiUser {
  id: number;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
  provider: string;
  points: number;
  balance: number;
  notifications_enabled: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: ApiUser;
}

export interface ApiVehicle {
  id: number;
  name: string;
  model: string;
  type: 'scooter' | 'bike' | 'ebike' | 'car';
  lat: number;
  lng: number;
  battery_pct: number;
  status: string;
  unlock_fee: number;
  price_per_min: number;
}

export interface ApiParkingArea {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius_m: number;
  capacity: number;
  occupied: number;
}

export interface ApiRide {
  id: number;
  vehicle_id: number | null;
  vehicle_type: string;
  from_addr: string;
  to_addr: string;
  km: number;
  minutes: number;
  cost: number;
  points: number;
  status: string;
  started_at: string;
  ended_at: string | null;
}

export interface ApiTransaction {
  id: number;
  type: 'charge' | 'refund' | 'topup';
  label: string;
  amount: number;
  created_at: string;
}

export interface ApiWallet {
  balance: number;
  transactions: ApiTransaction[];
}

export interface ApiPaymentMethod {
  id: number;
  kind: 'card' | 'apple' | 'paypal';
  label: string;
  last4: string | null;
  is_default: boolean;
}

export interface ApiPromotion {
  id: number;
  code: string | null;
  title: string;
  body: string;
  reward: string;
  icon: string;
  color: string;
  kind: 'offer' | 'active';
  expiry: string | null;
  used: number;
  total: number;
}

export interface ApiMessage {
  id: number;
  type: 'promo' | 'ride' | 'alert' | 'system';
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface ApiReport {
  id: number;
  category: string;
  description: string;
  status: string;
  created_at: string;
}

export interface ApiPreferences {
  notif_ride: boolean;
  notif_promo: boolean;
  notif_system: boolean;
  location_bg: boolean;
  biometric: boolean;
}

export interface ApiGeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export interface ApiRoutePoint {
  latitude: number;
  longitude: number;
}

export interface ApiRouteOption {
  points: ApiRoutePoint[];
  distance_m: number;
  duration_min: number;
  restricted: boolean;
  aree_vietate: string[];
  label: string;
}
