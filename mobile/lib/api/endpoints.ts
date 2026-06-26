// lib/api/endpoints.ts — Funzioni tipizzate per ogni risorsa del Controller.

import { apiFetch } from './client';
import type {
  ApiGeocodeResult, ApiMessage, ApiParkingArea, ApiPaymentMethod, ApiPreferences, ApiPromotion,
  ApiReport, ApiReservation, ApiRide, ApiRouteOption, ApiRoutePoint, ApiUser, ApiVehicle, ApiWallet, TokenResponse,
} from './types';

// ─── Auth ────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body: { name: string; surname: string; email: string; password: string; phone?: string }) =>
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
};

// ─── Parking areas ─────────────────────────────────────────────────────────
export const parkingApi = {
  list: (lat?: number, lng?: number) => {
    let url = '/parking';
    if (lat !== undefined && lng !== undefined) url += `?lat=${lat}&lng=${lng}`;
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

// ─── Reports ─────────────────────────────────────────────────────────────
export const reportsApi = {
  list: (token: string) => apiFetch<ApiReport[]>('/reports', { token }),
  create: (token: string, body: { category: string; description?: string }) =>
    apiFetch<ApiReport>('/reports', { method: 'POST', body, token }),
};
