// VistaAmministrazione — statistiche, tratte, configurazione aree con restrizioni e
// report aggregati con export (AP.01–AP.05).
import { useEffect, useState } from 'react';
import Layout, { type NavEntry } from '../components/Layout';
import ComponenteMappa, { type MapZone } from '../components/ComponenteMappa';
import { amministrazioneApi, restrizioniApi } from '../api';
import type { AreaRestrizione, ReportAggregato, Tratta, UtilizzoTipo, Segnalazione } from '../types';

const NAV: NavEntry[] = [
  { key: 'statistiche', label: '📈 Statistiche' },
  { key: 'aree', label: '🚫 Aree restrizione' },
  { key: 'report', label: '📄 Report & export' },
];

// Colore per tipo di area di restrizione.
const ZONE_COLOR: Record<string, string> = {
  NO_GO: '#ef4444', ZTL: '#a855f7', PEDONALE: '#f59e0b',
  NO_PARKING: '#3b82f6', LIMITE_VELOCITA: '#22c55e',
};

export default function VistaAmministrazione() {
  const [tab, setTab] = useState('statistiche');
  return (
    <Layout title="Vista Amministrazione" role="AMMINISTRAZIONE" nav={NAV} active={tab} onNavigate={setTab}>
      {tab === 'statistiche' && <Statistiche />}
      {tab === 'aree' && <Aree />}
      {tab === 'report' && <ReportExport />}
    </Layout>
  );
}

// ── AP.01 + AP.03 + AP.02 ─────────────────────────────────────────────────────
function Statistiche() {
  const [utilizzo, setUtilizzo] = useState<UtilizzoTipo[]>([]);
  const [tratte, setTratte] = useState<Tratta[]>([]);
  const [zone, setZone] = useState<Segnalazione[]>([]);

  useEffect(() => {
    amministrazioneApi.utilizzo().then(setUtilizzo).catch(() => {});
    amministrazioneApi.tratte(8).then(setTratte).catch(() => {});
    amministrazioneApi.zoneCritiche().then(setZone).catch(() => {});
  }, []);

  const maxCorse = Math.max(1, ...utilizzo.map((u) => u.corse));

  return (
    <>
      <div className="grid cols-2">
        <div className="card">
          <h3>AP.01 — Frequenza di utilizzo per tipologia</h3>
          {utilizzo.map((u) => (
            <div key={u.tipo} style={{ marginBottom: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{u.tipo}</b><span className="muted">{u.corse} corse · {u.km_totali} km</span>
              </div>
              <div style={{ height: 8, background: 'var(--surface)', borderRadius: 6, marginTop: 6 }}>
                <div style={{ height: 8, width: `${(u.corse / maxCorse) * 100}%`, background: 'var(--primary)', borderRadius: 6 }} />
              </div>
            </div>
          ))}
          {utilizzo.length === 0 && <p className="muted">Nessun dato disponibile.</p>}
        </div>

        <div className="card">
          <h3>AP.03 — Tratte più utilizzate</h3>
          <table>
            <thead><tr><th>Partenza → Arrivo</th><th>Corse</th></tr></thead>
            <tbody>
              {tratte.map((t, i) => (
                <tr key={i}><td>{t.from_addr} → {t.to_addr}</td><td>{t.corse}</td></tr>
              ))}
            </tbody>
          </table>
          {tratte.length === 0 && <p className="muted">Nessuna tratta registrata.</p>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>AP.02 — Zone critiche (segnalazioni georeferenziate)</h3>
        <ComponenteMappa
          markers={zone.filter((z) => z.gps_lat != null).map((z) => ({
            id: z.id, lat: z.gps_lat!, lng: z.gps_lng!, label: `${z.tipo} · ${z.gravita} · ${z.description}`,
          }))}
          height={360}
        />
      </div>
    </>
  );
}

// ── AP.04 configuratore aree di restrizione ───────────────────────────────────
function Aree() {
  const [aree, setAree] = useState<AreaRestrizione[]>([]);
  const [form, setForm] = useState({ nome: '', tipo: 'NO_GO', lat: 41.1177, lng: 16.8718, radius_m: 150 });

  const load = () => restrizioniApi.list().then(setAree).catch(() => {});
  useEffect(load, []);

  const crea = async () => {
    if (!form.nome) return;
    await restrizioniApi.crea(form);
    setForm((f) => ({ ...f, nome: '' }));
    load();
  };
  const elimina = async (id: number) => { await restrizioniApi.elimina(id); load(); };
  const toggle = async (a: AreaRestrizione) => { await restrizioniApi.aggiorna(a.id, { attiva: !a.attiva }); load(); };

  const zones: MapZone[] = aree.map((a) => ({
    id: a.id, lat: a.lat, lng: a.lng, radius: a.radius_m,
    color: a.attiva ? (ZONE_COLOR[a.tipo] ?? '#ef4444') : '#555',
    label: `${a.nome} (${a.tipo})`,
  }));
  // Anteprima dell'area in fase di creazione.
  zones.push({ id: 'new', lat: form.lat, lng: form.lng, radius: form.radius_m, color: '#ffffff', label: 'Nuova area' });

  return (
    <div className="grid cols-2">
      <div className="card">
        <h3>Mappa aree — clicca per posizionare la nuova area</h3>
        <ComponenteMappa
          center={[form.lat, form.lng]}
          zones={zones}
          onMapClick={(lat, lng) => setForm((f) => ({ ...f, lat: +lat.toFixed(6), lng: +lng.toFixed(6) }))}
          height={420}
        />
        <div className="legend">
          {Object.entries(ZONE_COLOR).map(([k, c]) => (
            <span key={k}><span className="dot" style={{ background: c }} />{k}</span>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>AP.04 — Configura area con restrizioni</h3>
        <label>Nome area</label>
        <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="es. ZTL Centro" />
        <label>Tipo restrizione</label>
        <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
          {Object.keys(ZONE_COLOR).map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <div className="grid cols-3" style={{ gap: 10 }}>
          <div><label>Lat</label><input value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: +e.target.value }))} /></div>
          <div><label>Lng</label><input value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: +e.target.value }))} /></div>
          <div><label>Raggio (m)</label><input value={form.radius_m} onChange={(e) => setForm((f) => ({ ...f, radius_m: +e.target.value }))} /></div>
        </div>
        <button className="btn-primary" style={{ marginTop: 16, width: '100%' }} onClick={crea}>Crea area</button>

        <h3 style={{ marginTop: 22 }}>Aree configurate</h3>
        <table>
          <thead><tr><th>Nome</th><th>Tipo</th><th>Attiva</th><th></th></tr></thead>
          <tbody>
            {aree.map((a) => (
              <tr key={a.id}>
                <td>{a.nome}</td>
                <td>{a.tipo}</td>
                <td><button className="btn-ghost btn-sm" onClick={() => toggle(a)}>{a.attiva ? 'Sì' : 'No'}</button></td>
                <td><button className="btn-danger btn-sm" onClick={() => elimina(a.id)}>Elimina</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── AP.05 report aggregati + export PDF/CSV ───────────────────────────────────
function ReportExport() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rep, setRep] = useState<ReportAggregato | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const genera = async () => {
    setErr(null);
    try { setRep(await amministrazioneApi.report(from || undefined, to || undefined)); }
    catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => { genera(); }, []);

  const esportaCSV = () => {
    if (!rep) return;
    const rows = [
      ['Indicatore', 'Valore'],
      ['Totale corse', rep.totale_corse],
      ['Km totali', rep.km_totali],
      ['Minuti totali', rep.minuti_totali],
      ['Km medi a corsa', rep.km_medi_corsa],
      ['Mezzi attivi', rep.mezzi_attivi],
      ['Segnalazioni aperte', rep.segnalazioni_aperte],
      ...Object.entries(rep.corse_per_tipo).map(([k, v]) => [`Corse ${k}`, v]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'report-mobilita.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <h3>AP.05 — Report aggregato sulla mobilità (dati anonimi)</h3>
      {err && <div className="error-banner">{err}</div>}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div><label>Da</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label>A</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div style={{ alignSelf: 'flex-end' }}><button className="btn-primary" onClick={genera}>Genera</button></div>
        <div style={{ alignSelf: 'flex-end' }}><button className="btn-ghost" onClick={esportaCSV} disabled={!rep}>Esporta CSV</button></div>
        <div style={{ alignSelf: 'flex-end' }}><button className="btn-ghost" onClick={() => window.print()} disabled={!rep}>Esporta PDF</button></div>
      </div>

      {rep && (
        <div className="grid cols-4" style={{ marginTop: 18 }}>
          <div className="card"><div className="stat-value">{rep.totale_corse}</div><div className="stat-label">Totale corse</div></div>
          <div className="card"><div className="stat-value">{rep.km_totali}</div><div className="stat-label">Km totali</div></div>
          <div className="card"><div className="stat-value">{rep.km_medi_corsa}</div><div className="stat-label">Km medi/corsa</div></div>
          <div className="card"><div className="stat-value">{rep.minuti_totali}</div><div className="stat-label">Minuti totali</div></div>
          <div className="card"><div className="stat-value">{rep.mezzi_attivi}</div><div className="stat-label">Mezzi attivi</div></div>
          <div className="card"><div className="stat-value" style={{ color: 'var(--warning)' }}>{rep.segnalazioni_aperte}</div><div className="stat-label">Segnalazioni aperte</div></div>
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>Corse per tipo</div>
            {Object.entries(rep.corse_per_tipo).map(([k, v]) => (
              <div key={k} className="row" style={{ justifyContent: 'space-between' }}><span>{k}</span><b>{v}</b></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
