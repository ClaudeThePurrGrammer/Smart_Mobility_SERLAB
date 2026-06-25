// Tipi del contratto REST Controller_to_View (rispecchiano gli schemi Pydantic).

export type Role = 'UTENTE' | 'OPERATORE' | 'AMMINISTRAZIONE';
export type AccountStatus = 'ATTIVO' | 'SOSPESO' | 'BLOCCATO';

export interface User {
  id: number;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
  provider: string;
  points: number;
  balance: number;
  notifications_enabled: boolean;
  role: Role;
  account_status: AccountStatus;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Vehicle {
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
  locked: boolean;
}

export interface Segnalazione {
  id: number;
  user_id: number;
  ride_id: number | null;
  category: string;
  description: string;
  tipo: string;
  gravita: 'BASSA' | 'MEDIA' | 'ALTA';
  stato: 'APERTA' | 'CHIUSA';
  gps_lat: number | null;
  gps_lng: number | null;
  created_at: string;
  closed_at: string | null;
}

export interface AreaRestrizione {
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
}

export interface UserAdmin {
  id: number;
  name: string;
  surname: string;
  email: string;
  role: Role;
  account_status: AccountStatus;
  points: number;
  created_at: string;
}

export interface DensitaArea {
  area_id: number;
  nome: string;
  lat: number;
  lng: number;
  mezzi: number;
  capienza: number;
  livello: 'BASSA' | 'OK' | 'ALTA';
}

export interface UtilizzoTipo { tipo: string; corse: number; km_totali: number; minuti_totali: number; }
export interface Tratta { from_addr: string; to_addr: string; corse: number; }
export interface ReportAggregato {
  periodo: { da: string | null; a: string | null };
  totale_corse: number;
  km_totali: number;
  minuti_totali: number;
  km_medi_corsa: number;
  corse_per_tipo: Record<string, number>;
  mezzi_attivi: number;
  segnalazioni_aperte: number;
}
