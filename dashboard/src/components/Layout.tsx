// Guscio comune delle viste dashboard: sidebar di navigazione + topbar.
import type { ReactNode } from 'react';
import { useAuth } from '../auth';

export interface NavEntry { key: string; label: string; }

export default function Layout({
  title, role, nav, active, onNavigate, children,
}: {
  title: string;
  role: string;
  nav: NavEntry[];
  active: string;
  onNavigate: (key: string) => void;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Smart <span>Mobility</span></div>
        {nav.map((n) => (
          <div key={n.key} className={`nav-item ${active === n.key ? 'active' : ''}`} onClick={() => onNavigate(n.key)}>
            {n.label}
          </div>
        ))}
        <div className="spacer" />
        <div className="role-badge">{role}</div>
        <div className="muted" style={{ fontSize: 13, margin: '10px 4px' }}>
          {user?.name} {user?.surname}
        </div>
        <button className="btn-ghost" onClick={logout}>Esci</button>
      </aside>
      <div className="main">
        <div className="topbar"><h1>{title}</h1></div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
