// Gestione sessione lato VIEW: token + utente + ruolo, persistiti in localStorage.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, getToken, setToken } from './api';
import type { User } from './types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: Parameters<typeof authApi.register>[0]) => Promise<User>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Ripristina la sessione da token salvato.
  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    authApi.me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const register = async (body: Parameters<typeof authApi.register>[0]) => {
    const res = await authApi.register(body);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => { setToken(null); setUser(null); };

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
