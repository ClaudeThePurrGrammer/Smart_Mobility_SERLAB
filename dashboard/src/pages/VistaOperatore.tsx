// VistaOperatore — distribuzione flotta, malfunzionamenti, mappa posizioni, tracciamento
// real-time e azioni operative (OP.02–OP.09).
import { useEffect, useState } from 'react';
import Layout, { type NavEntry } from '../components/Layout';
import ComponenteMappa, { type MapMarker } from '../components/ComponenteMappa';
import { operatoreApi, segnalazioniApi, openVehicleSocket } from '../api';
import type { DensitaArea, Segnalazione, UserAdmin, Vehicle } from '../types';

const NAV: NavEntry[] = [
  { key: 'dashboard',    label: '📊 Dashboard' },
  { key: 'aree',        label: '🅿️ Disponibilità Aree' },
  { key: 'malfunzionamenti', label: '⚠️ Malfunzionamenti' },
  { key: 'mezzi-corsa', label: '📍 Mezzi a fine corsa' },
  { key: 'flotta',      label: '🔒 Flotta & blocco remoto' },
  { key: 'tracciamento', label: '📡 Tracciamento live' },
  { key: 'utenti',      label: '👤 Utenti' },
];

const gravClass = (g: string) => g.toLowerCase();

export default function VistaOperatore() {
  const [tab, setTab] = useState('dashboard');
  return (
    <Layout title="Vista Operatore" role="OPERATORE" nav={NAV} active={tab} onNavigate={setTab}>
      {tab === 'dashboard'         && <Dashboard />}
      {tab === 'aree'              && <DisponibilitaAree />}
      {tab === 'malfunzionamenti'  && <Malfunzionamenti />}
      {tab === 'mezzi-corsa'       && <MezziFineCorse />}
      {tab === 'flotta'            && <Flotta />}
      {tab === 'tracciamento'      && <Tracciamento />}
      {tab === 'utenti'            && <Utenti />}
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

// ── OP.02 — Disponibilità aree di parcheggio ──────────────────────────────────
const STATO_CONFIG = {
  VUOTA:   { icon: '🔴', label: 'Vuota',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)'   },
  CRITICA: { icon: '🟡', label: 'Critica', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  },
  OK:      { icon: '🟢', label: 'OK',      color: '#10B981', bg: 'rgba(16,185,129,0.12)'  },
  PIENA:   { icon: '🔵', label: 'Piena',   color: '#3B82F6', bg: 'rgba(59,130,246,0.12)'  },
} as const;

type StatoArea = keyof typeof STATO_CONFIG;

function DisponibilitaAree() {
  const [aree, setAree]       = useState<DensitaArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro]   = useState<StatoArea | 'tutti'>('tutti');
  const [search, setSearch]   = useState('');

  const load = () => {
    setLoading(true);
    operatoreApi.densita()
      .then(setAree)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = aree
    .filter((a) => filtro === 'tutti' || a.stato === filtro)
    .filter((a) => a.nome.toLowerCase().includes(search.toLowerCase()));

  const counts = {
    VUOTA:   aree.filter((a) => a.stato === 'VUOTA').length,
    CRITICA: aree.filter((a) => a.stato === 'CRITICA').length,
    OK:      aree.filter((a) => a.stato === 'OK').length,
    PIENA:   aree.filter((a) => a.stato === 'PIENA').length,
  };

  return (
    <>
      {/* KPI bar — click per filtrare */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        {(Object.keys(STATO_CONFIG) as StatoArea[]).map((s) => (
          <div
            key={s}
            className="card"
            style={{ cursor: 'pointer', borderColor: filtro === s ? STATO_CONFIG[s].color : undefined }}
            onClick={() => setFiltro(filtro === s ? 'tutti' : s)}
          >
            <div className="stat-value" style={{ color: STATO_CONFIG[s].color }}>
              {STATO_CONFIG[s].icon} {counts[s]}
            </div>
            <div className="stat-label">Aree {STATO_CONFIG[s].label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <input
          placeholder="🔍 Cerca area..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
        />
        <button className="btn-sm" onClick={() => { setFiltro('tutti'); setSearch(''); }}>Reset</button>
        <button className="btn-sm" style={{ marginLeft: 4 }} onClick={load}>↺ Aggiorna</button>
      </div>

      {/* Lista aree */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
          Caricamento aree…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
          Nessuna area trovata.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th>Area di parcheggio</th>
                <th style={{ textAlign: 'center' }}>Veicoli presenti</th>
                <th style={{ textAlign: 'center' }}>Capienza</th>
                <th style={{ textAlign: 'center' }}>Saturazione</th>
                <th style={{ textAlign: 'center' }}>Stato</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const cfg = STATO_CONFIG[a.stato];
                const sat = a.capienza > 0 ? Math.round((a.mezzi / a.capienza) * 100) : 0;
                return (
                  <tr key={a.area_id} style={{ background: filtro === a.stato ? cfg.bg : undefined }}>
                    <td style={{ textAlign: 'center', fontSize: 20 }}>{cfg.icon}</td>
                    <td>
                      <strong>{a.nome}</strong>
                      <br />
                      <span className="muted" style={{ fontSize: 11 }}>
                        {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: cfg.color }}>{a.mezzi}</span>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{a.capienza}</td>
                    <td style={{ textAlign: 'center', minWidth: 120 }}>
                      <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(sat, 100)}%`, background: cfg.color, borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{sat}%</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="pill" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.color + '66' }}>
                        {cfg.label.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '10px 18px', color: 'var(--muted)', fontSize: 12 }}>
            {filtered.length} aree mostrate su {aree.length} totali
          </div>
        </div>
      )}
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

// ── UC-28 — Consultazione posizione mezzi a fine corsa ────────────────────────
const TIPO_LABEL: Record<string, string> = { scooter: 'Monopattino', ebike: 'E-Bike', car: 'Auto elettrica' };
const TIPO_ICON:  Record<string, string> = { scooter: '🛴', ebike: '🚲', car: '🚗' };

function battColor(pct: number) {
  return pct > 50 ? '#10B981' : pct > 20 ? '#F59E0B' : '#EF4444';
}

function MezziFineCorse() {
  const [mezzi, setMezzi]     = useState<Vehicle[]>([]);
  const [filtro, setFiltro]   = useState<string>('tutti');
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const load = () => {
    setLoading(true);
    operatoreApi.mezziRilascio()
      .then(setMezzi)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = filtro === 'tutti' ? mezzi : mezzi.filter((v) => v.type === filtro);

  // Contatori per tipo
  const totScooter = mezzi.filter((v) => v.type === 'scooter').length;
  const totEbike   = mezzi.filter((v) => v.type === 'ebike').length;
  const totCar     = mezzi.filter((v) => v.type === 'car').length;
  const totLiberi  = mezzi.filter((v) => !v.locked).length;
  const totBloccati = mezzi.filter((v) => v.locked).length;
  const battMedia  = mezzi.length ? Math.round(mezzi.reduce((s, v) => s + v.battery_pct, 0) / mezzi.length) : 0;

  // Marker per la mappa: verde = libero, rosso = bloccato
  const markers: MapMarker[] = filtered.map((v) => ({
    id: v.id,
    lat: v.lat,
    lng: v.lng,
    label: `${TIPO_ICON[v.type] ?? '🛵'} ${v.name} · ${TIPO_LABEL[v.type] ?? v.type} · 🔋${v.battery_pct}%${v.locked ? ' · 🔒 BLOCCATO' : ''}`,
  }));

  // Centro mappa sul centroide dei mezzi visibili (o Bari di default)
  const center: [number, number] = filtered.length
    ? [
        filtered.reduce((s, v) => s + v.lat, 0) / filtered.length,
        filtered.reduce((s, v) => s + v.lng, 0) / filtered.length,
      ]
    : [41.1177, 16.8718];

  return (
    <>
      {/* ── KPI bar ── */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat-value">{mezzi.length}</div>
          <div className="stat-label">Totale parcheggiati</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ color: '#10B981' }}>{totLiberi}</div>
          <div className="stat-label">Liberi (prelevabili)</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{totBloccati}</div>
          <div className="stat-label">Bloccati (remoto)</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ color: battColor(battMedia) }}>{battMedia}%</div>
          <div className="stat-label">Batteria media</div>
        </div>
      </div>

      {/* ── Filtri tipo ── */}
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        {[
          { key: 'tutti',   label: `Tutti (${mezzi.length})` },
          { key: 'scooter', label: `🛴 Monopattini (${totScooter})` },
          { key: 'ebike',   label: `🚲 E-Bike (${totEbike})` },
          { key: 'car',     label: `🚗 Auto (${totCar})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={filtro === key ? 'btn-primary btn-sm' : 'btn-sm'}
            style={{ opacity: filtro === key ? 1 : 0.6 }}
            onClick={() => setFiltro(key)}
          >
            {label}
          </button>
        ))}
        <button className="btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setFullscreen(true)}>⛶ Mappa a schermo intero</button>
        <button className="btn-sm" onClick={load}>↺ Aggiorna</button>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
          Caricamento posizioni…
        </div>
      ) : filtered.length === 0 ? (
        // SA-28.1 — Nessun dato di rilascio presente
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <h3 style={{ color: 'var(--muted)', fontWeight: 600 }}>Nessun mezzo rilasciato</h3>
          <p className="muted">
            {filtro === 'tutti'
              ? 'Non ci sono mezzi parcheggiati al momento.'
              : `Nessun mezzo di tipo "${TIPO_LABEL[filtro] ?? filtro}" attualmente parcheggiato.`}
          </p>
        </div>
      ) : (
        <>
          {/* Mappa a tutta larghezza con TUTTI i mezzi parcheggiati — vista come l'utente */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>UC-28 — Mappa mezzi parcheggiati ({filtered.length} mezzi)</span>
              <button className="btn-sm" onClick={() => setFullscreen(true)}>⛶ Schermo intero</button>
            </div>
            <ComponenteMappa markers={markers} center={center} height={560} dark />
          </div>

          {/* Tabella dettaglio sotto la mappa */}
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Dettaglio mezzi parcheggiati</h3>
            <table>
              <thead>
                <tr>
                  <th>Mezzo</th>
                  <th>Tipo</th>
                  <th>Batteria</th>
                  <th>Posizione</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.name}</strong>
                      <br />
                      <span className="muted" style={{ fontSize: 11 }}>{v.model}</span>
                    </td>
                    <td>{TIPO_ICON[v.type] ?? '🛵'} {TIPO_LABEL[v.type] ?? v.type}</td>
                    <td>
                      <span style={{ color: battColor(v.battery_pct), fontWeight: 700 }}>
                        {v.battery_pct}%
                      </span>
                    </td>
                    <td>
                      <span className="muted" style={{ fontSize: 11 }}>
                        {v.lat.toFixed(4)}, {v.lng.toFixed(4)}
                      </span>
                    </td>
                    <td>
                      {v.locked
                        ? <span className="pill bloccato">BLOCCATO</span>
                        : <span className="pill attivo" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', borderColor: 'rgba(16,185,129,0.4)' }}>LIBERO</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Mappa a schermo intero (overlay) — come la vede l'utente ── */}
      {fullscreen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#0D0D1A', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', height: 56, boxSizing: 'border-box', background: '#13132A', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <strong style={{ color: '#fff', fontSize: 15 }}>🅿️ Mezzi parcheggiati — {filtered.length} mezzi</strong>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {[
                { key: 'tutti',   label: `Tutti (${mezzi.length})` },
                { key: 'scooter', label: `🛴 ${totScooter}` },
                { key: 'ebike',   label: `🚲 ${totEbike}` },
                { key: 'car',     label: `🚗 ${totCar}` },
              ].map(({ key, label }) => (
                <button key={key} className={filtro === key ? 'btn-primary btn-sm' : 'btn-sm'}
                  style={{ opacity: filtro === key ? 1 : 0.6 }} onClick={() => setFiltro(key)}>
                  {label}
                </button>
              ))}
              <button className="btn-sm" onClick={() => setFullscreen(false)}>✕ Chiudi</button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ComponenteMappa
              markers={markers}
              center={center}
              height={typeof window !== 'undefined' ? window.innerHeight - 56 : 800}
              dark
            />
          </div>
        </div>
      )}
    </>
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
        <h3>OP.04 — Mappa intera flotta</h3>
        <ComponenteMappa markers={markers} height={420} />
      </div>
      <div className="card">
        <h3>OP.09 — Blocco remoto mezzi</h3>
        <table>
          <thead><tr><th>Mezzo</th><th>Batteria</th><th>Stato</th><th>Azione</th></tr></thead>
          <tbody>
            {flotta.map((v) => (
              <tr key={v.id}>
                <td>{v.name}<br /><span className="muted" style={{ fontSize: 12 }}>{v.model}</span></td>
                <td>{v.battery_pct}%</td>
                <td>
                  {v.locked
                    ? <span className="pill bloccato">BLOCCATO</span>
                    : v.status === 'in_use'
                      ? <span className="pill attivo">IN USO</span>
                      : <span className="pill attivo" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', borderColor: 'rgba(16,185,129,0.4)' }}>LIBERO</span>
                  }
                </td>
                <td>
                  <button
                    className={v.locked ? 'btn-success btn-sm' : 'btn-danger btn-sm'}
                    onClick={() => toggleBlocco(v)}
                  >
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
