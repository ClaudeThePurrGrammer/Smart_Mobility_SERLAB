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
  role: string;
  created_at: string;
}

export interface ApiUserAdmin {
  id: number;
  name: string;
  surname: string;
  email: string;
  role: string;
  account_status: 'ATTIVO' | 'SOSPESO' | 'BLOCCATO';
  points: number;
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
  type: 'scooter' | 'ebike' | 'car';
  lat: number;
  lng: number;
  battery_pct: number;
  status: string;
  unlock_fee: number;
  price_per_min: number;
  locked: boolean;
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
  orario_inizio_pausa: string | null;
  pausa_secondi_accumulati: number;
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
  tipo?: string;
  gravita?: string;
  attachments?: string[];
  created_at: string;
}

export interface ApiPreferences {
  notif_ride: boolean;
  notif_promo: boolean;
  notif_system: boolean;
  location_bg: boolean;
  biometric: boolean;
}

export interface ApiReservationVehicle {
  id: number;
  nome: string;
  modello: string;
  tipo: string;
  livello_carica: number;
  posizione_gps: { lat: number; lng: number };
}

export interface ApiReservation {
  id: number;
  id_mezzo: number;
  ora_creazione: string;
  ora_scadenza: string;
  stato: string;
  mezzo: ApiReservationVehicle | null;
}

export interface ApiSegnalazione {
  id: number;
  user_id: number;
  ride_id: number | null;
  category: string;
  description: string;
  tipo: string;
  gravita: 'BASSA' | 'MEDIA' | 'ALTA';
  stato: string;
  gps_lat: number | null;
  gps_lng: number | null;
  zona: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface ApiMonitoraggioFrequenza {
  tipo: string;
  da: string | null;
  a: string | null;
  totale_corse: number;
}

export interface ApiTrattaFrequenza {
  from_addr: string;
  to_addr: string;
  corse: number;
}

export interface ApiReportMobilita {
  tipo: string;
  da: string | null;
  a: string | null;
  totale_corse: number;
  tratte: ApiTrattaFrequenza[];
}

export interface ApiAreaRestrizioneOut {
  id: number;
  nome: string;
  tipo: string;
  lat: number;
  lng: number;
  radius_m: number;
  vehicle_types: string[];
  orario: string | null;
  attiva: boolean;
  note: string;
  valida_dal: string | null;
  valida_al: string | null;
}

export interface ApiSegnalazioneZona {
  id: number;
  zona: string | null;
  descrizione: string;
  valida_dal: string | null;
  valida_al: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  created_at: string;
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
