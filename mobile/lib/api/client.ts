// lib/api/client.ts
// Client REST della VIEW verso il CONTROLLER (View_to_Controller, HTTPS/JSON).
// L'host del backend viene dedotto automaticamente dall'URL di Metro (stesso PC),
// così l'app sul telefono raggiunge l'API senza configurare l'IP a mano.

import Constants from 'expo-constants';

function resolveBaseUrl(): string {
  // 1) Override esplicito via env (es. backend remoto / produzione).
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  // 2) IP del PC che serve Metro (es. "192.168.1.10:8081" → "192.168.1.10").
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.hostUri ??
    (Constants as any).manifest?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:8000`;

  // 3) Fallback (emulatore / web sullo stesso PC).
  return 'http://localhost:8000';
}

export const API_BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Logout forzato globale: registrato dal layout autenticato, viene invocato
// quando il backend risponde 403 perché l'account è sospeso/bloccato (deps.py).
let onAccountBlocked: (() => void) | null = null;
export function registerAccountBlockedCallback(cb: (() => void) | null) {
  onAccountBlocked = cb;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = opts;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      `Impossibile contattare il server (${API_BASE_URL}). Verifica che il backend sia avviato e di essere sulla stessa rete.`,
      0,
    );
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) || `Errore ${res.status}`;
    // 403 per account sospeso/bloccato → logout immediato (il detail contiene
    // "Account…"; distinguibile dai 403 di ruolo "Permessi insufficienti…").
    if (res.status === 403 && typeof detail === 'string' && /account/i.test(detail)) {
      onAccountBlocked?.();
    }
    throw new ApiError(typeof detail === 'string' ? detail : 'Richiesta non valida', res.status);
  }
  return data as T;
}
