// FormAutenticazione — login/registrazione unica per tutti i ruoli (§2.3.6.1).
// Il routing post-login è gestito da App.tsx in base al ruolo dell'account.
import { useState } from 'react';
import { useAuth } from '../auth';
import type { Role } from '../types';

const ROLES: { key: Role; label: string }[] = [
  { key: 'OPERATORE', label: 'Operatore' },
  { key: 'AMMINISTRAZIONE', label: 'Amministrazione' },
];

export default function FormAutenticazione() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<Role>('OPERATORE');
  const [form, setForm] = useState({
    name: '', surname: '', email: '', password: '', phone: '',
    ente_appartenenza: '', zona_competenza: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register({
          name: form.name, surname: form.surname, email: form.email,
          password: form.password, phone: form.phone, role,
          ente_appartenenza: form.ente_appartenenza, zona_competenza: form.zona_competenza,
        });
      }
      // Il redirect avviene automaticamente (App.tsx osserva lo stato auth).
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h2>Smart <span style={{ color: 'var(--accent)' }}>Mobility</span></h2>
        <p className="auth-sub">Dashboard {mode === 'login' ? 'accesso' : 'registrazione'} — Operatore / Amministrazione</p>

        {error && <div className="error-banner">{error}</div>}

        {mode === 'register' && (
          <>
            <div className="role-tabs">
              {ROLES.map((r) => (
                <div key={r.key} className={`role-tab ${role === r.key ? 'active' : ''}`} onClick={() => setRole(r.key)}>
                  {r.label}
                </div>
              ))}
            </div>
            <div className="grid cols-2" style={{ gap: 10 }}>
              <div>
                <label>Nome</label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </div>
              <div>
                <label>Cognome</label>
                <input value={form.surname} onChange={(e) => set('surname', e.target.value)} />
              </div>
            </div>
            <label>Telefono</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            {role === 'AMMINISTRAZIONE' ? (
              <>
                <label>Ente di appartenenza</label>
                <input value={form.ente_appartenenza} onChange={(e) => set('ente_appartenenza', e.target.value)} placeholder="es. Comune di Bari" />
              </>
            ) : (
              <>
                <label>Zona di competenza</label>
                <input value={form.zona_competenza} onChange={(e) => set('zona_competenza', e.target.value)} placeholder="es. Bari Centro" />
              </>
            )}
          </>
        )}

        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        <label>Password</label>
        <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required />

        <button className="btn-primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 18, padding: 12 }}>
          {busy ? 'Attendere…' : mode === 'login' ? 'Accedi' : 'Registrati'}
        </button>

        <p className="auth-sub" style={{ marginTop: 16, textAlign: 'center' }}>
          {mode === 'login' ? 'Non hai un account? ' : 'Hai già un account? '}
          <span className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
            {mode === 'login' ? 'Registrati' : 'Accedi'}
          </span>
        </p>

        {mode === 'login' && (
          <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 6 }}>
            Demo: operatore@smartmobility.it · comune@bari.it — password123
          </p>
        )}
      </form>
    </div>
  );
}
