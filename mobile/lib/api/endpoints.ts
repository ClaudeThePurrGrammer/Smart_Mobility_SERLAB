// lib/api/endpoints.ts — Funzioni tipizzate per ogni risorsa del Controller.

import { apiFetch } from './client';
import type {
  ApiAreaDensita, ApiAreaRestrizioneOut, ApiGeocodeResult, ApiMessage, ApiMonitoraggioFrequenza,
  ApiParkingArea, ApiPaymentMethod, ApiPreferences, ApiPromotion, ApiReport, ApiReservation, ApiRide,
  ApiReportMobilita, ApiRouteOption, ApiRoutePoint, ApiSegnalazione, ApiSegnalazioneZona,
  ApiTrattaFrequenza, ApiUser, ApiUserAdmin, ApiVehicle, ApiWallet, TokenResponse,
} from './types';

// ─── Auth ────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body: { name: string; surname: string; email: string; password: string; phone?: string; role?: string; codice_attivazione?: string }) =>
    apiFetch<TokenResponse>('/auth/register', { method: 'POST', body }),

  login: (body: { email: string; password: string }) =>
    apiFetch<TokenResponse>('/auth/login', { method: 'POST', body }),

  me: (token: string) => apiFetch<ApiUser>('/auth/me', { token }),

  updateMe: (token: string, body: Partial<Pick<ApiUser, 'name' | 'surname' | 'phone' | 'notifications_enabled'>>) =>
    apiFetch<ApiUser>('/auth/me', { method: 'PATCH', body, token }),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),
};

// ─── Vehicles ────────────────────────────────────────────────────────────
export const vehiclesApi = {
  list: (onlyAvailable = false, lat?: number, lng?: number) => {
    let url = `/vehicles?only_available=${onlyAvailable}`;
    if (lat !== undefined && lng !== undefined) url += `&lat=${lat}&lng=${lng}`;
    return apiFetch<ApiVehicle[]>(url);
  },
  get: (id: number) => apiFetch<ApiVehicle>(`/vehicles/${id}`),
  park: (token: string, vehicleId: number, parkingAreaId: number) =>
    apiFetch<ApiVehicle>(`/vehicles/${vehicleId}/park`, {
      method: 'PATCH',
      body: { parking_area_id: parkingAreaId },
      token,
    }),
};

// ─── Parking areas ─────────────────────────────────────────────────────────
export const parkingApi = {
  list: (lat?: number, lng?: number, radiusKm?: number) => {
    let url = '/parking';
    const parts: string[] = [];
    if (lat !== undefined && lng !== undefined) {
      parts.push(`lat=${lat}`, `lng=${lng}`);
    }
    if (radiusKm !== undefined) parts.push(`radius_km=${radiusKm}`);
    if (parts.length) url += '?' + parts.join('&');
    return apiFetch<ApiParkingArea[]>(url);
  },
};

// ─── Rides ───────────────────────────────────────────────────────────────
export const ridesApi = {
  history: (token: string) => apiFetch<ApiRide[]>('/rides', { token }),
  active: (token: string) => apiFetch<ApiRide | null>('/rides/active', { token }),
  start: (token: string, body: { vehicle_id?: number; vehicle_type?: string; from_addr?: string; to_addr?: string }) =>
    apiFetch<ApiRide>('/rides', { method: 'POST', body, token }),
  end: (token: string, rideId: number, body: { km: number; minutes: number }) =>
    apiFetch<ApiRide>(`/rides/${rideId}/end`, { method: 'POST', body, token }),
  pause: (token: string, rideId: number) =>
    apiFetch<ApiRide>(`/rides/${rideId}/pause`, { method: 'PATCH', token }),
};

// ─── Users / preferenze ──────────────────────────────────────────────────────
export const usersApi = {
  getPreferences: (token: string) => apiFetch<ApiPreferences>('/users/me/preferences', { token }),
  updatePreferences: (token: string, body: Partial<ApiPreferences>) =>
    apiFetch<ApiPreferences>('/users/me/preferences', { method: 'PATCH', body, token }),
  // Aggiorna il proprio profilo (es. riscatto punti: { points: nuovoTotale }).
  updateMe: (token: string, body: { points?: number; name?: string; surname?: string; phone?: string; notifications_enabled?: boolean }) =>
    apiFetch<ApiUser>('/users/me', { method: 'PUT', body, token }),
};

// ─── Geo (geocoding / routing) ───────────────────────────────────────────────
export const geoApi = {
  geocode: (q: string) => apiFetch<ApiGeocodeResult[]>(`/geocode?q=${encodeURIComponent(q)}`),
  route: (from: { lat: number; lng: number }, to: { lat: number; lng: number }) =>
    apiFetch<ApiRoutePoint[]>(`/route?from_lat=${from.lat}&from_lng=${from.lng}&to_lat=${to.lat}&to_lng=${to.lng}`),
  // Alternative di percorso per tipo di mezzo, valutate sui vincoli geografici.
  routeOptions: (from: { lat: number; lng: number }, to: { lat: number; lng: number }, vehicleType: string) =>
    apiFetch<ApiRouteOption[]>(
      `/route/options?from_lat=${from.lat}&from_lng=${from.lng}&to_lat=${to.lat}&to_lng=${to.lng}&vehicle_type=${vehicleType}`,
    ),
};

// ─── Wallet ──────────────────────────────────────────────────────────────
export const walletApi = {
  get: (token: string) => apiFetch<ApiWallet>('/wallet', { token }),
  topup: (token: string, amount: number) =>
    apiFetch<ApiWallet>('/wallet/topup', { method: 'POST', body: { amount }, token }),
};

// ─── Payment methods ─────────────────────────────────────────────────────
export const paymentApi = {
  list: (token: string) => apiFetch<ApiPaymentMethod[]>('/payment-methods', { token }),
  add: (token: string, body: { kind: string; label: string; last4?: string; is_default?: boolean }) =>
    apiFetch<ApiPaymentMethod>('/payment-methods', { method: 'POST', body, token }),
  remove: (token: string, id: number) =>
    apiFetch<void>(`/payment-methods/${id}`, { method: 'DELETE', token }),
};

// ─── Promotions ──────────────────────────────────────────────────────────
export const promotionsApi = {
  list: () => apiFetch<ApiPromotion[]>('/promotions'),
  redeem: (token: string, code: string) =>
    apiFetch<ApiPromotion>('/promotions/redeem', { method: 'POST', body: { code }, token }),
};

// ─── Messages ────────────────────────────────────────────────────────────
export const messagesApi = {
  list: (token: string) => apiFetch<ApiMessage[]>('/messages', { token }),
  create: (token: string, body: { title: string; body: string; type?: ApiMessage['type'] }) =>
    apiFetch<ApiMessage>('/messages', { method: 'POST', body, token }),
  markAllRead: (token: string) => apiFetch<ApiMessage[]>('/messages/read-all', { method: 'POST', token }),
  markRead: (token: string, id: number) => apiFetch<ApiMessage>(`/messages/${id}/read`, { method: 'POST', token }),
};

// ─── Prenotazioni ────────────────────────────────────────────────────────
export const reservationsApi = {
  getActive: (token: string) => apiFetch<ApiReservation | null>('/prenotazioni/attiva', { token }),
  create: (token: string, vehicleId: number) =>
    apiFetch<ApiReservation>('/prenotazioni', { method: 'POST', body: { id_mezzo: vehicleId }, token }),
  cancel: (token: string, reservationId: number) =>
    apiFetch<void>(`/prenotazioni/${reservationId}`, { method: 'DELETE', token }),
};

// ─── Segnalazioni (Operatore/Amministrazione) ────────────────────────────
export const segnalazioniApi = {
  listAperte: (token: string) =>
    apiFetch<ApiSegnalazione[]>('/operatore/segnalazioni', { token }),
  listTutteAperte: (token: string) =>
    apiFetch<ApiSegnalazione[]>('/segnalazioni?stato=APERTA', { token }),
  getById: (token: string, id: number) =>
    apiFetch<ApiSegnalazione>(`/segnalazioni/${id}`, { token }),
  chiudi: (token: string, id: number) =>
    apiFetch<ApiSegnalazione>(`/segnalazioni/${id}/chiudi`, { method: 'PATCH', token }),
};

// ─── Operatore ───────────────────────────────────────────────────────────
export const operatoreApi = {
  listUtenti: (token: string) =>
    apiFetch<ApiUserAdmin[]>('/operatore/utenti', { token }),
  cambiaStatoUtente: (token: string, userId: number, account_status: string, motivo: string) =>
    apiFetch<ApiUserAdmin>(`/operatore/utenti/${userId}/stato`, {
      method: 'POST',
      body: { account_status, motivo },
      token,
    }),
  listFlotta: (token: string) =>
    apiFetch<ApiVehicle[]>('/operatore/flotta', { token }),
  bloccaMezzo: (token: string, vehicleId: number, locked: boolean) =>
    apiFetch<ApiVehicle>(`/operatore/mezzi/${vehicleId}/blocco`, {
      method: 'POST',
      body: { locked },
      token,
    }),
  areeDensita: (token: string) =>
    apiFetch<ApiAreaDensita[]>('/operatore/aree-densita', { token }),
  getBonusConfig: (token: string) =>
    apiFetch<{ soglia_corse: number; punti_bonus: number }>('/operatore/bonus/config', { token }),
  assegnaBonus: (token: string, soglia_corse: number, punti_bonus: number) =>
    apiFetch<{ premiati: number[]; punti_assegnati: number; soglia_corse: number }>(
      '/operatore/bonus', { method: 'POST', body: { soglia_corse, punti_bonus }, token },
    ),
};

// ─── Amministrazione ─────────────────────────────────────────────────────
export const amministrazioneApi = {
  monitoraggioFrequenza: (token: string, vehicleType: string, fromDate?: string, toDate?: string) => {
    let url = `/amministrazione/monitoraggio/frequenza?vehicle_type=${encodeURIComponent(vehicleType)}`;
    if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
    if (toDate) url += `&to_date=${encodeURIComponent(toDate)}`;
    return apiFetch<ApiMonitoraggioFrequenza>(url, { token });
  },
  segnalaZona: (
    token: string,
    body: { zona: string; descrizione: string; valida_dal: string; valida_al: string; gravita: string; gps_lat?: number; gps_lng?: number },
  ) => apiFetch<ApiSegnalazioneZona>('/amministrazione/segnala-zona', { method: 'POST', body, token }),
  reportMobilita: (token: string, vehicleType: string, fromDate: string, toDate: string) => {
    const url = `/amministrazione/report/mobilita?vehicle_type=${encodeURIComponent(vehicleType)}&from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`;
    return apiFetch<ApiReportMobilita>(url, { token });
  },
  inserisciAreaRestrizione: (
    token: string,
    body: { indirizzo: string; radius_m: number; tipo: string; vehicle_types: string[]; note: string; valida_dal: string; valida_al: string },
  ) => apiFetch<ApiAreaRestrizioneOut>('/aree-restrizione/configura', { method: 'POST', body, token }),
  trattePiuUtilizzate: (token: string, vehicleType: string, fromDate?: string, toDate?: string, limit = 10) => {
    let url = `/amministrazione/tratte/frequenza?vehicle_type=${encodeURIComponent(vehicleType)}&limit=${limit}`;
    if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
    if (toDate)   url += `&to_date=${encodeURIComponent(toDate)}`;
    return apiFetch<ApiTrattaFrequenza[]>(url, { token });
  },
};

// ─── Reports ─────────────────────────────────────────────────────────────
export const reportsApi = {
  list: (token: string) => apiFetch<ApiReport[]>('/reports', { token }),
  create: (token: string, body: {
    category: string;
    description?: string;
    tipo?: string;
    gravita?: string;
    ride_id?: number;
    gps_lat?: number;
    gps_lng?: number;
    attachments?: string[];
  }) => apiFetch<ApiReport>('/reports', { method: 'POST', body, token }),
};
