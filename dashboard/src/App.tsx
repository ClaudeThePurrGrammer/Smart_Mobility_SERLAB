import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import type { Role } from './types';
import FormAutenticazione from './pages/FormAutenticazione';
import VistaOperatore from './pages/VistaOperatore';
import VistaAmministrazione from './pages/VistaAmministrazione';

// Destinazione post-login in base al ruolo (FormAutenticazione §2.3.6.1).
function homeForRole(role: Role): string {
  if (role === 'OPERATORE') return '/operatore';
  if (role === 'AMMINISTRAZIONE') return '/amministrazione';
  return '/non-autorizzato';
}

// Guardia di rotta per ruolo: un ruolo non accede alle viste di un altro.
function Protected({ role, children }: { role: Role; children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-wrap">Caricamento…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeForRole(user.role)} replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={homeForRole(user.role)} replace /> : <FormAutenticazione />}
      />
      <Route
        path="/operatore/*"
        element={<Protected role="OPERATORE"><VistaOperatore /></Protected>}
      />
      <Route
        path="/amministrazione/*"
        element={<Protected role="AMMINISTRAZIONE"><VistaAmministrazione /></Protected>}
      />
      <Route
        path="/non-autorizzato"
        element={<div className="auth-wrap"><div className="auth-card">
          <h2>Accesso non disponibile</h2>
          <p className="auth-sub">La dashboard web è riservata a Operatore e Amministrazione Pubblica.
          Gli utenti finali usano l'app mobile.</p>
        </div></div>}
      />
      <Route
        path="*"
        element={
          loading ? <div className="auth-wrap">Caricamento…</div>
            : <Navigate to={user ? homeForRole(user.role) : '/login'} replace />
        }
      />
    </Routes>
  );
}
