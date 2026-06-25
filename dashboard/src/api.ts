// Client REST verso il CONTROLLER (FastAPI). Tutte le chiamate passano dal proxy /api.
import type {
  AreaRestrizione, DensitaArea, ReportAggregato, Segnalazione, TokenResponse,
  Tratta, User, UserAdmin, UtilizzoTipo, Vehicle,
} from './types';

const BASE = '/api';

let _token: string | null = localStorage.getItem('sm_token');
export function setToken(t: string | null) {
  _token = t;
  if (t) localStorage.setItem('sm_token', t);
  else localStorage.removeItem('sm_token');
}
export function getToken() { return _token; }

async function req<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_token) headers.Authorization = `Bearer ${_token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let detail = `Errore ${res.status}`;
    try { detail = (await res.json()).detail ?? detail; } catch { /* no body */ }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth (GestioneUtenti) ───────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    req<TokenResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (body: {
    name: string; surname: string; email: string; password: string; phone?: string;
    role: string; ente_appartenenza?: string; zona_competenza?: string;
  }) => req<TokenResponse>('/auth/register', { method: 'POST', body }),
  me: () => req<User>('/auth/me'),
};

// ── GestioneSegnalazioni ──────────────────────────────────────────────────────
export const segnalazioniApi = {
  list: (q: { stato?: string; gravita?: string; tipo?: string } = {}) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
    return req<Segnalazione[]>(`/segnalazioni?${p.toString()}`);
  },
  chiudi: (id: number) => req<Segnalazione>(`/segnalazioni/${id}/chiudi`, { method: 'PATCH' }),
};

// ── GestioneOperatore ─────────────────────────────────────────────────────────
export const operatoreApi = {
  flotta: () => req<Vehicle[]>('/operatore/flotta'),
  mezziRilascio: () => req<Vehicle[]>('/operatore/mezzi-rilascio'),
  densita: () => req<DensitaArea[]>('/operatore/aree-densita'),
  utenti: () => req<UserAdmin[]>('/operatore/utenti'),
  cambiaStatoUtente: (id: number, account_status: string) =>
    req<UserAdmin>(`/operatore/utenti/${id}/stato`, { method: 'POST', body: { account_status } }),
  bloccoMezzo: (id: number, locked: boolean) =>
    req<Vehicle>(`/operatore/mezzi/${id}/blocco`, { method: 'POST', body: { locked } }),
  assegnaBonus: () => req<{ premiati: number[]; punti_assegnati: number }>('/operatore/bonus', { method: 'POST' }),
};

// ── GestioneAmministrazione ───────────────────────────────────────────────────
export const amministrazioneApi = {
  utilizzo: () => req<UtilizzoTipo[]>('/amministrazione/statistiche/utilizzo'),
  tratte: () => req<Tratta[]>('/amministrazione/statistiche/tratte'),
  zoneCritiche: () => req<Segnalazione[]>('/amministrazione/statistiche/zone-critiche'),
  report: (from?: string, to?: string) => {
    const p = new URLSearchParams();
    if (from) p.set('from_date', from);
    if (to) p.set('to_date', to);
    return req<ReportAggregato>(`/amministrazione/report?${p.toString()}`);
  },
};

// ── GestioneRestrizioni ───────────────────────────────────────────────────────
export const restrizioniApi = {
  list: () => req<AreaRestrizione[]>('/aree-restrizione'),
  crea: (body: Partial<AreaRestrizione>) => req<AreaRestrizione>('/aree-restrizione', { method: 'POST', body }),
  aggiorna: (id: number, body: Partial<AreaRestrizione>) =>
    req<AreaRestrizione>(`/aree-restrizione/${id}`, { method: 'PATCH', body }),
  elimina: (id: number) => req<void>(`/aree-restrizione/${id}`, { method: 'DELETE' }),
};

// ── WebSocket (Controller_to_View real-time) ──────────────────────────────────
export function openVehicleSocket(vehicleId: number, onMsg: (d: any) => void): WebSocket {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws/mezzi/${vehicleId}?token=${_token ?? ''}`);
  ws.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch { /* ignore */ } };
  return ws;
}
