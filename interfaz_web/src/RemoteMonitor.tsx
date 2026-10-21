import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Activity, Bell, Clock3, Cloud, CloudUpload, Link2, Pause, RefreshCw, UserRound } from "lucide-react";
import { accessDataClient } from "./accessClient";
import { isFreshSample, isLocalPortal, sampleAge } from "./cloudPolicy";
import { RemoteLocation, type RemotePosition } from "./RemoteLocation";
import { IncidentPanel } from "./IncidentPanel";

type Resident = { id: string; full_name: string; room: string };
type Sample = { id: string; observed_at: string; received_at: string; payload: { state?: string; accel_g?: number; tilt_deg?: number; motion?: number; fall_count?: number; simulated?: boolean } };
type Event = { id: string; event_type: string; observed_at: string; simulated: boolean; detail: { text?: string } };
type Space = { space_id: string; name: string; role: string };
type LocalResident = { id: number; full_name: string; room: string; is_active: number };
type SyncStatus = { session_active: boolean; pending: number; sent: number; blocked: number; last_error: string | null; bindings: { local_resident_id: number }[] };

const STATE: Record<string, string> = { NORMAL: "Movimiento estable", EVENTO_INERCIAL: "Movimiento brusco", POSIBLE_CAIDA: "Posible caída", CAIDA_CONFIRMADA: "Caída informada", ALERTA_SILENCIADA: "Alerta silenciada" };
function time(value: string) { return new Date(value).toLocaleString("es", { dateStyle: "short", timeStyle: "medium" }); }
function metric(value: number | undefined, suffix = "") { return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : "—"; }

async function localRequest(path: string, token?: string, body?: object) {
  const response = await fetch(path, { method: body ? "POST" : "GET", headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) {
    let code = "";
    try {
      const result = await response.json();
      const value = result?.detail?.code;
      if (typeof value === "string" && /^[a-zA-Z0-9_]{1,60}$/.test(value)) code = value;
    } catch { /* The status remains usable for non-JSON responses. */ }
    throw new Error(`${response.status}${code ? ` · ${code}` : ""}`);
  }
  return response.json();
}

function LocalSync({ session, spaces }: { session: Session; spaces: Space[] }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [residents, setResidents] = useState<LocalResident[]>([]);
  const [resident, setResident] = useState(0);
  const [space, setSpace] = useState(spaces[0]?.space_id ?? "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void localRequest("/api/residents").then((data: LocalResident[]) => {
      if (active) { const list = data.filter(r => r.is_active); setResidents(list); setResident(list[0]?.id ?? 0); }
    }).catch(() => { if (active) setError("El servidor local no está disponible."); });
    const load = async () => {
      try { const data = await localRequest("/api/cloud/status"); if (active) setStatus(data); }
      catch { if (active) { setStatus(null); setError("No se pudo consultar la sincronización local."); } }
    };
    void load();
    const interval = window.setInterval(() => void load(), 4000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  async function act(kind: "connect" | "session" | "pause") {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await localRequest(`/api/cloud/${kind}`, session.access_token,
        kind === "connect" ? { resident_id: resident, space_id: space, consent } : {});
      setStatus(data);
      setNotice(kind === "pause" ? "Envíos pausados. Los pendientes se conservan." : "Sesión de envío habilitada.");
    } catch (failure) {
      const reference = failure instanceof Error && /^\d{3}( · [a-zA-Z0-9_]{1,60})?$/.test(failure.message) ? failure.message : "red";
      setError(`No se pudo completar la operación. Referencia: ${reference}. Los datos locales se conservan.`);
    }
    finally { setBusy(false); }
  }
  return <section className="cloud-local" aria-labelledby="cloud-local-title">
    <div className="cloud-section-title"><CloudUpload size={21} /><h2 id="cloud-local-title">Sincronización de esta PC</h2></div>
    {error && <p className="cloud-warning" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="cloud-controls"><label>Perfil local activo<select value={resident} onChange={e => setResident(Number(e.target.value))}>{!residents.length && <option value={0}>Sin perfil activo</option>}{residents.map(r => <option key={r.id} value={r.id}>{r.full_name} · {r.room}</option>)}</select></label>
      <label>Espacio autorizado<select value={space} onChange={e => setSpace(e.target.value)}>{spaces.map(s => <option key={s.space_id} value={s.space_id}>{s.name}</option>)}</select></label></div>
    <label className="cloud-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Autorizar nombre, referencia, nuevos eventos y telemetría. Sin teléfonos, notas médicas, fotos ni ubicación.</label>
    <div className="cloud-actions"><button className="access-primary" disabled={busy || !consent || !resident || !space} onClick={() => void act("connect")}><Link2 size={18} />Vincular y sincronizar</button>
      <button className="access-secondary" disabled={busy || !status?.bindings.length} onClick={() => void act("session")}><RefreshCw size={17} />Reanudar envíos</button>
      <button className="access-secondary" disabled={busy || !status?.session_active} onClick={() => void act("pause")}><Pause size={17} />Pausar envíos</button></div>
    {status && <div className="cloud-sync-counts"><span>{status.session_active ? "Sesión de envío activa" : "Sesión de envío pausada"}</span><span>{status.pending} pendientes</span><span>{status.sent} enviados</span><span>{status.blocked} requieren revisión</span></div>}
    <p className="cloud-footnote">La sesión de envío no se guarda en disco. Al reiniciar la PC o vencer la sesión, los pendientes se conservan y se debe reanudar el envío.</p>
  </section>;
}

export function RemoteMonitor({ session, spaces }: { session: Session; spaces: Space[] }) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selected, setSelected] = useState("");
  const [sample, setSample] = useState<Sample | null>(null);
  const [position, setPosition] = useState<RemotePosition | null>(null);
  const [positionError, setPositionError] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    let active = true;
    const data = accessDataClient(session.access_token);
    const load = async () => {
      const result = await data.from("sfa_residents").select("id,full_name,room").is("archived_at", null).order("full_name");
      if (!active) return;
      if (result.error) { setResidents([]); setSelected(""); setError("No se pudo consultar el directorio remoto."); }
      else { const list = result.data ?? []; setResidents(list); setSelected(previous => list.some(r => r.id === previous) ? previous : list[0]?.id ?? ""); setError(""); }
      setLoading(false);
    };
    void load().catch(() => { if (active) { setError("Sin conexión con el monitoreo remoto."); setLoading(false); } });
    const timer = window.setInterval(() => void load().catch(() => { if (active) setError("Sin conexión con el monitoreo remoto."); }), 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session.access_token]);
  useEffect(() => {
    let active = true;
    setSample(null); setEvents([]); setPosition(null); setPositionError("");
    if (!selected) return;
    const data = accessDataClient(session.access_token);
    const load = async () => {
      try {
        const [reading, history] = await Promise.all([
          data.from("sfa_pc_samples").select("id,observed_at,received_at,payload").eq("resident_id", selected).eq("kind", "telemetry").order("observed_at", { ascending: false }).limit(1),
          data.from("sfa_events").select("id,event_type,observed_at,simulated,detail").eq("resident_id", selected).order("observed_at", { ascending: false }).limit(12),
        ]);
        if (reading.error || history.error) throw new Error();
        if (active) { setSample(reading.data?.[0] ?? null); setEvents(history.data ?? []); setError(""); }
      } catch { if (active) { setSample(null); setEvents([]); setError("No se pudieron actualizar las lecturas. No se considera una señal de seguridad."); } }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selected, session.access_token]);
  useEffect(() => {
    let active = true;
    if (!selected) return;
    const load = async () => {
      try {
        const result = await accessDataClient(session.access_token).from("sfa_positions")
          .select("latitude,longitude,accuracy_m,observed_at").eq("resident_id", selected).eq("simulated", false)
          .order("observed_at", { ascending: false }).limit(1);
        if (result.error) throw new Error();
        if (active) { setPosition(result.data?.[0] ?? null); setPositionError(""); }
      } catch { if (active) { setPosition(null); setPositionError("No se pudo consultar la ubicación remota."); } }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selected, session.access_token]);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const person = residents.find(r => r.id === selected);
  const fresh = sample && isFreshSample(sample.observed_at, Boolean(sample.payload.simulated), clock);
  const age = sample ? sampleAge(sample.observed_at, clock) : null;
  return <div className="cloud-monitor">
    {isLocalPortal(window.location) && spaces.some(s => s.role === "admin") && <LocalSync session={session} spaces={spaces.filter(s => s.role === "admin")} />}
    <section className="cloud-remote" aria-labelledby="cloud-monitor-title">
      <div className="cloud-section-title"><Cloud size={21} /><h2 id="cloud-monitor-title">Monitoreo remoto</h2>
        <label className="cloud-resident-picker"><UserRound size={18} /><select aria-label="Residente remoto" value={selected} onChange={e => setSelected(e.target.value)} disabled={!residents.length}>{!residents.length && <option value="">Sin residentes vinculados</option>}{residents.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}</select></label></div>
      {error && <p className="cloud-warning" role="alert">{error}</p>}
      {loading ? <p role="status">Consultando residentes autorizados…</p> : !person ? <div className="cloud-empty"><Link2 size={26} /><strong>Aún no hay un perfil sincronizado</strong><p>Los perfiles locales se conservan en la PC.</p></div> : <>
        <div className="cloud-person"><div><h3>{person.full_name}</h3><p>{person.room}</p></div><span className={fresh ? `cloud-signal ${["CAIDA_CONFIRMADA","POSIBLE_CAIDA"].includes(sample.payload.state ?? "") ? "critical" : "fresh"}` : "cloud-signal"}><Activity size={16} />{fresh ? STATE[sample.payload.state ?? ""] ?? "Lectura reciente" : sample?.payload.simulated ? "Muestra de simulación" : "Sin lecturas recientes"}</span></div>
        <IncidentPanel resident={selected} session={session} />
        <div className="cloud-metrics"><div><span>Aceleración</span><strong>{metric(sample?.payload.accel_g, " g")}</strong></div><div><span>Inclinación</span><strong>{metric(sample?.payload.tilt_deg, "°")}</strong></div><div><span>Movimiento</span><strong>{metric(sample?.payload.motion)}</strong></div></div>
        <p className="cloud-last"><Clock3 size={16} />{sample ? `Última muestra: ${time(sample.observed_at)} · hace ${Math.floor(age ?? 0)} s` : "Sin muestras del cinturón para este perfil"}</p>
        {positionError && <p role="alert" className="cloud-warning">{positionError}</p>}
        <RemoteLocation position={position} clock={clock} />
        <div className="cloud-section-title"><Bell size={19} /><h3>Eventos recibidos</h3></div>
        {events.length ? <ol className="cloud-events">{events.map(event => <li key={event.id}><div><strong>{event.event_type.replaceAll("_", " ")}</strong><p>{event.detail.text ?? ""}</p></div><div>{event.simulated && <span>Simulado</span>}<time>{time(event.observed_at)}</time></div></li>)}</ol> : <p className="cloud-footnote">No hay eventos recibidos para este perfil.</p>}
      </>}
    </section>
  </div>;
}
