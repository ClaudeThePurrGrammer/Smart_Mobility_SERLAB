// VistaOperatore — distribuzione flotta, malfunzionamenti, mappa posizioni, tracciamento
// real-time e azioni operative (OP.02–OP.09).
import { useEffect, useState } from 'react';
import Layout, { type NavEntry } from '../components/Layout';
import ComponenteMappa, { type MapMarker } from '../components/ComponenteMappa';
import { operatoreApi, segnalazioniApi, openVehicleSocket } from '../api';
import type { DensitaArea, Segnalazione, UserAdmin, Vehicle } from '../types';

const NAV: NavEntry[] = [
  { key: 'dashboard', label: '📊 Dashboard' },
  { key: 'malfunzionamenti', label: '⚠️ Malfunzionamenti' },
  { key: 'flotta', label: '🛴 Flotta & mappa' },
  { key: 'tracciamento', label: '📡 Tracciamento live' },
  { key: 'utenti', label: '👤 Utenti' },
];

const gravClass = (g: string) => g.toLowerCase();

export default function VistaOperatore() {
  const [tab, setTab] = useState('dashboard');
  return (
    <Layout title="Vista Operatore" role="OPERATORE" nav={NAV} active={tab} onNavigate={setTab}>
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'malfunzionamenti' && <Malfunzionamenti />}
      {tab === 'flotta' && <Flotta />}
      {tab === 'tracciamento' && <Tracciamento />}
      {tab === 'utenti' && <Utenti />}
    </Layout>
  );
}

// ── OP.02 + OP.03 sintesi ─────────────────────────────────────────────────────
function Dashboard() {
  const [densita, setDensita] = useState<DensitaArea[]>([]);
  const [segn, setSegn] = useState<Segnalazione[]>([]);
  const [bonusMsg, setBonusMsg] = useState<string | null>(null);

  const load = () => {
    operatoreApi.densita().then(setDensita).catch(() => {});
    segnalazioniApi.list({ stato: 'APERTA' }).then(setSegn).catch(() => {});
  };
  useEffect(load, []);

  const aperte = segn.length;
  const critiche = segn.filter((s) => s.gravita === 'ALTA').length;
  const areeBasse = densita.filter((d) => d.livello === 'BASSA');

  const assegnaBonus = async () => {
    const r = await operatoreApi.assegnaBonus();
    setBonusMsg(`Bonus assegnato a ${r.premiati.length} utenti (+${r.punti_assegnati} pt ciascuno).`);
  };

  return (
    <>
      <div className="grid cols-4">
        <div className="card"><div className="stat-value">{aperte}</div><div className="stat-label">Segnalazioni aperte</div></div>
        <div className="card"><div className="stat-value" style={{ color: 'var(--danger)' }}>{critiche}</div><div className="stat-label">Gravità ALTA</div></div>
        <div className="card"><div className="stat-value" style={{ color: 'var(--warning)' }}>{areeBasse.length}</div><div className="stat-label">Aree a bassa disponibilità</div></div>
        <div className="card">
          <div className="stat-label" style={{ marginBottom: 10 }}>OP.07 — Utenti virtuosi</div>
          <button className="btn-primary" onClick={assegnaBonus}>Assegna bonus</button>
          {bonusMsg && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{bonusMsg}</div>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>OP.02 — Densità mezzi per area (redistribuzione)</h3>
        <table>
          <thead><tr><th>Area</th><th>Mezzi</th><th>Capienza</th><th>Livello</th></tr></thead>
          <tbody>
            {densita.map((d) => (
              <tr key={d.area_id}>
                <td>{d.nome}</td>
                <td>{d.mezzi}</td>
                <td>{d.capienza}</td>
                <td><span className={`pill ${d.livello === 'BASSA' ? 'alta' : d.livello === 'ALTA' ? 'bassa' : 'media'}`}>{d.livello}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── OP.03 / OP.06 ─────────────────────────────────────────────────────────────
function Malfunzionamenti() {
  const [items, setItems] = useState<Segnalazione[]>([]);
  const [filtro, setFiltro] = useState('');

  const load = () => segnalazioniApi.list(filtro ? { gravita: filtro } : {}).then(setItems).catch(() => {});
  useEffect(load, [filtro]);

  const chiudi = async (id: number) => { await segnalazioniApi.chiudi(id); load(); };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>Dashboard malfunzionamenti (ordinati per gravità)</h3>
        <select style={{ width: 180 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Tutte le gravità</option>
          <option value="ALTA">ALTA</option>
          <option value="MEDIA">MEDIA</option>
          <option value="BASSA">BASSA</option>
        </select>
      </div>
      <table>
        <thead><tr><th>#</th><th>Tipo</th><th>Descrizione</th><th>Gravità</th><th>Stato</th><th>Azione</th></tr></thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.tipo}</td>
              <td>{s.description || s.category}</td>
              <td><span className={`pill ${gravClass(s.gravita)}`}>{s.gravita}</span></td>
              <td><span className={`pill ${s.stato.toLowerCase()}`}>{s.stato}</span></td>
              <td>
                {s.stato === 'APERTA'
                  ? <button className="btn-success btn-sm" onClick={() => chiudi(s.id)}>Chiudi</button>
                  : <span className="muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── OP.04 + OP.09 ─────────────────────────────────────────────────────────────
function Flotta() {
  const [flotta, setFlotta] = useState<Vehicle[]>([]);
  const load = () => operatoreApi.flotta().then(setFlotta).catch(() => {});
  useEffect(load, []);

  const toggleBlocco = async (v: Vehicle) => { await operatoreApi.bloccoMezzo(v.id, !v.locked); load(); };

  const markers: MapMarker[] = flotta.map((v) => ({
    id: v.id, lat: v.lat, lng: v.lng, label: `${v.name} · ${v.battery_pct}% · ${v.status}`,
  }));

  return (
    <div className="grid cols-2">
      <div className="card">
        <h3>OP.04 — Posizioni mezzi a fine corsa</h3>
        <ComponenteMappa markers={markers} height={420} />
      </div>
      <div className="card">
        <h3>Flotta — blocco remoto (OP.09)</h3>
        <table>
          <thead><tr><th>Mezzo</th><th>Batteria</th><th>Stato</th><th>Azione</th></tr></thead>
          <tbody>
            {flotta.map((v) => (
              <tr key={v.id}>
                <td>{v.name}<br /><span className="muted" style={{ fontSize: 12 }}>{v.model}</span></td>
                <td>{v.battery_pct}%</td>
                <td>{v.locked ? <span className="pill bloccato">BLOCCATO</span> : v.status}</td>
                <td>
                  <button className={v.locked ? 'btn-success btn-sm' : 'btn-danger btn-sm'}
                    onClick={() => toggleBlocco(v)} disabled={v.status === 'in_use' && !v.locked}>
                    {v.locked ? 'Sblocca' : 'Blocca'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── OP.05 tracciamento real-time via WebSocket ────────────────────────────────
function Tracciamento() {
  const [flotta, setFlotta] = useState<Vehicle[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number; battery_pct: number } | null>(null);

  useEffect(() => { operatoreApi.flotta().then(setFlotta).catch(() => {}); }, []);

  useEffect(() => {
    if (sel == null) return;
    setPos(null);
    const ws = openVehicleSocket(sel, (d) => {
      if (d.lat != null) setPos({ lat: d.lat, lng: d.lng, battery_pct: d.battery_pct });
    });
    return () => ws.close();
  }, [sel]);

  return (
    <div className="grid cols-2">
      <div className="card">
        <h3>OP.05 — Tracciamento in tempo reale</h3>
        <label>Seleziona un mezzo</label>
        <select value={sel ?? ''} onChange={(e) => setSel(e.target.value ? Number(e.target.value) : null)}>
          <option value="">— scegli —</option>
          {flotta.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.model})</option>)}
        </select>
        {pos
          ? <p style={{ marginTop: 14 }}>Posizione live: <b>{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</b><br />
              <span className="muted">Batteria {pos.battery_pct}% · aggiornamento ogni 2s (WebSocket)</span></p>
          : sel != null ? <p className="muted" style={{ marginTop: 14 }}>Connessione al flusso…</p>
          : <p className="muted" style={{ marginTop: 14 }}>Nessun mezzo selezionato.</p>}
      </div>
      <div className="card">
        <h3>Mappa live</h3>
        <ComponenteMappa
          center={pos ? [pos.lat, pos.lng] : [41.1177, 16.8718]}
          markers={pos ? [{ id: 'live', lat: pos.lat, lng: pos.lng, label: 'Mezzo in tragitto' }] : []}
          height={420}
        />
      </div>
    </div>
  );
}

// ── OP.08 sospensione/blocco account ──────────────────────────────────────────
function Utenti() {
  const [utenti, setUtenti] = useState<UserAdmin[]>([]);
  const load = () => operatoreApi.utenti().then(setUtenti).catch(() => {});
  useEffect(load, []);

  const setStato = async (id: number, stato: string) => { await operatoreApi.cambiaStatoUtente(id, stato); load(); };

  return (
    <div className="card">
      <h3>OP.08 — Gestione account utente</h3>
      <table>
        <thead><tr><th>Utente</th><th>Email</th><th>Punti</th><th>Stato</th><th>Azioni</th></tr></thead>
        <tbody>
          {utenti.map((u) => (
            <tr key={u.id}>
              <td>{u.name} {u.surname}</td>
              <td className="muted">{u.email}</td>
              <td>{u.points}</td>
              <td><span className={`pill ${u.account_status.toLowerCase()}`}>{u.account_status}</span></td>
              <td className="row">
                <button className="btn-success btn-sm" onClick={() => setStato(u.id, 'ATTIVO')} disabled={u.account_status === 'ATTIVO'}>Attiva</button>
                <button className="btn-warning btn-sm" onClick={() => setStato(u.id, 'SOSPESO')} disabled={u.account_status === 'SOSPESO'}>Sospendi</button>
                <button className="btn-danger btn-sm" onClick={() => setStato(u.id, 'BLOCCATO')} disabled={u.account_status === 'BLOCCATO'}>Blocca</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
