// lib/auth/AuthContext.tsx
// Stato di autenticazione globale dell'app (VIEW): token JWT + utente corrente.
// Il token è persistito in modo sicuro con expo-secure-store.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '@/lib/api/endpoints';
import type { ApiUser } from '@/lib/api/types';

const TOKEN_KEY = 'sm_token';

interface AuthContextValue {
  user: ApiUser | null;
  token: string | null;
  /** true finché non sappiamo se esiste una sessione salvata. */
  initializing: boolean;
  login: (email: string, password: string) => Promise<ApiUser>;
  register: (data: { name: string; surname: string; email: string; password: string; phone?: string; role?: string; codice_attivazione?: string }) => Promise<ApiUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Aggiorna lo user in cache (es. dopo topup/ride) senza rifare la fetch. */
  setUser: (u: ApiUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const persistToken = useCallback(async (t: string | null) => {
    setToken(t);
    if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  }, []);

  // Ripristino sessione salvata all'avvio.
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          const me = await authApi.me(saved);
          setUserState(me);
          setToken(saved);
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY); // token scaduto/non valido
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<ApiUser> => {
    const res = await authApi.login({ email, password });
    setUserState(res.user);
    await persistToken(res.access_token);
    return res.user;
  }, [persistToken]);

  const register = useCallback(async (data: { name: string; surname: string; email: string; password: string; phone?: string; role?: string; codice_attivazione?: string }): Promise<ApiUser> => {
    const res = await authApi.register(data);
    setUserState(res.user);
    await persistToken(res.access_token);
    return res.user;
  }, [persistToken]);

  const logout = useCallback(async () => {
    setUserState(null);
    await persistToken(null);
  }, [persistToken]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const me = await authApi.me(token);
    setUserState(me);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ user, token, initializing, login, register, logout, refreshUser, setUser: setUserState }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  return ctx;
}
