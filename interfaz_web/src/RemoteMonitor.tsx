import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Activity, Bell, CheckCircle2, Clock3, Cloud, CloudUpload, Link2, Pause, RefreshCw, UserRound } from "lucide-react";
import { accessDataClient } from "./accessClient";
import { isFreshSample, isLocalPortal, sampleAge } from "./cloudPolicy";
import { type RemotePosition } from "./RemoteLocation";
import { RemoteGeofence } from "./RemoteGeofence";
import { IncidentPanel } from "./IncidentPanel";
import { loadMapPosition } from "./mapPosition";

type Resident = { id: string; full_name: string; room: string };
type Sample = { id: string; observed_at: string; received_at: string; payload: { state?: string; accel_g?: number; tilt_deg?: number; motion?: number; fall_count?: number; simulated?: boolean } };
type Event = { id: string; event_type: string; observed_at: string; simulated: boolean; detail: { text?: string } };
type Space = { space_id: string; name: string; role: string };
type LocalResident = { id: number; full_name: string; room: string; is_active: number };
type SyncStatus = { session_active: boolean; pending: number; sent: number; blocked: number; last_error: string | null; bindings: { local_resident_id: number; space_id: string; enabled: number | boolean }[] };

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

export function LocalSync({ session, spaces, activeResidentId }: { session: Session; spaces: Space[]; activeResidentId?: number }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [residents, setResidents] = useState<LocalResident[]>([]);
  const [resident, setResident] = useState(0);
  const [space, setSpace] = useState(spaces[0]?.space_id ?? "");
  const [authorization, setAuthorization] = useState<{ resident: number; space: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const consent = authorization?.resident === resident && authorization.space === space;
  const linked = Boolean(status?.bindings.some(b => b.local_resident_id === resident && b.space_id === space && (b.enabled === 1 || b.enabled === true)));
  useEffect(() => {
    let active = true;
    setAuthorization(null);
    void localRequest("/api/residents").then((data: LocalResident[]) => {
      if (active) {
        const list = data.filter(r => r.is_active && (activeResidentId === undefined || r.id === activeResidentId));
        setResidents(list); setResident(list[0]?.id ?? 0);
      }
    }).catch(() => { if (active) setError("El servidor local no está disponible."); });
    const load = async () => {
      try {
        const data = await localRequest("/api/cloud/status");
        if (!Array.isArray(data.bindings)) throw new Error();
        if (active) setStatus(data);
      }
      catch { if (active) { setStatus(null); setError("No se pudo consultar la sincronización local."); } }
    };
    void load();
    const interval = window.setInterval(() => void load(), 4000);
    return () => { active = false; window.clearInterval(interval); };
  }, [activeResidentId]);
  async function act(kind: "connect" | "session" | "pause") {
    if (busy || (kind === "connect" && (!status || linked || !consent || !resident || !spaces.some(s => s.space_id === space))) || (kind === "session" && !linked)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await localRequest(`/api/cloud/${kind}`, session.access_token,
        kind === "connect" ? { resident_id: resident, space_id: space, consent } : {});
      if (!Array.isArray(data.bindings)) throw new Error();
      setStatus(data);
      if (kind === "connect") setAuthorization(null);
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
    <div className="cloud-controls"><label>Perfil local activo<select value={resident} disabled={busy} onChange={e => { setResident(Number(e.target.value)); setAuthorization(null); setNotice(""); }}>{!residents.length && <option value={0}>Sin perfil activo</option>}{residents.map(r => <option key={r.id} value={r.id}>{r.full_name} · {r.room}</option>)}</select></label>
      <label>Espacio autorizado<select value={space} disabled={busy} onChange={e => { setSpace(e.target.value); setAuthorization(null); setNotice(""); }}>{spaces.map(s => <option key={s.space_id} value={s.space_id}>{s.name}</option>)}</select></label></div>
    {linked ? <div className="cloud-binding-saved" role="status"><CheckCircle2 size={21} /><div><strong>Vínculo de este perfil guardado</strong><p>Nombre, referencia, nuevos eventos y telemetría. Sin teléfonos, notas médicas, fotos ni ubicación. No necesitas volver a autorizar este vínculo.</p></div></div>
      : status ? <label className="cloud-consent"><input type="checkbox" checked={consent} disabled={busy || !resident || !spaces.some(s => s.space_id === space)} onChange={e => setAuthorization(e.target.checked ? { resident, space } : null)} />Autorizar nombre, referencia, nuevos eventos y telemetría. Sin teléfonos, notas médicas, fotos ni ubicación.</label>
        : <p className="cloud-footnote">Comprobando el vínculo guardado. No se habilita una nueva vinculación hasta verificar su estado.</p>}
    <div className="cloud-actions">{status && !linked && <button className="access-primary" disabled={busy || !consent || !resident || !spaces.some(s => s.space_id === space)} onClick={() => void act("connect")}><Link2 size={18} />Vincular y sincronizar</button>}
      <button className="access-secondary" disabled={busy || !linked} onClick={() => void act("session")}><RefreshCw size={17} />Reanudar envíos</button>
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
  const [receivers, setReceivers] = useState<number | null>(null);
  const [receiverError, setReceiverError] = useState(false);
  useEffect(() => {
    let active = true;
    const data = accessDataClient(session.access_token);
    const load = async () => {
      const result = await data.from("sfa_residents").select("id,full_name,room").is("archived_at", null).order("full_name");
      if (!active) return;
      if (result.error) { setResidents([]); setSelected(""); setError("No se pudo consultar el directorio remoto."); }
      else { const list = result.data ?? []; setResidents(list); setSelected(previous => list.some(r => r.id === previous) ? previous : list.length === 1 ? list[0].id : ""); setError(""); }
      setLoading(false);
    };
    void load().catch(() => { if (active) { setError("Sin conexión con el monitoreo remoto."); setLoading(false); } });
    const timer = window.setInterval(() => void load().catch(() => { if (active) setError("Sin conexión con el monitoreo remoto."); }), 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session.access_token]);
  useEffect(() => {
    let active = true;
    setReceivers(null); setReceiverError(false);
    if (!selected || !spaces.some(s => s.role === "admin" || s.role === "caregiver")) return;
    void Promise.resolve(accessDataClient(session.access_token).rpc("sfa_push_test_targets", { p_resident: selected })).then(result => {
      if (!active) return;
      if (result.error || !Array.isArray(result.data?.devices)) setReceiverError(true);
      else setReceivers(result.data.devices.length);
    }).catch(() => { if (active) setReceiverError(true); });
    return () => { active = false; };
  }, [selected, session.access_token, spaces]);
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
        const result = await loadMapPosition(session.access_token, selected);
        if (active) { setPosition(result); setPositionError(""); }
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
        <label className="cloud-resident-picker"><UserRound size={18} /><select aria-label="Residente remoto" value={selected} onChange={e => setSelected(e.target.value)} disabled={!residents.length}><option value="">{residents.length ? "Seleccionar persona autorizada" : "Sin residentes vinculados"}</option>{residents.map(r => <option key={r.id} value={r.id}>{r.full_name} · {r.id.slice(0,8)}</option>)}</select></label></div>
      {error && <p className="cloud-warning" role="alert">{error}</p>}
      {loading ? <p role="status">Consultando residentes autorizados…</p> : !person ? <div className="cloud-empty"><Link2 size={26} /><strong>{residents.length ? "Selecciona a quién quieres monitorear" : "Aún no hay un perfil sincronizado"}</strong><p>{residents.length ? "La referencia debe coincidir con la ficha elegida en Compartir en el celular emisor." : "Los perfiles locales se conservan en la PC."}</p></div> : <>
        <p className="cloud-footnote">Ficha remota: {person.full_name} · {person.id.slice(0,8)}. GPS y SOS se consultan para esta ficha, independientemente del cinturón.</p>
        <details><summary>Recepción de avisos en tu cuenta</summary>{receiverError ? <p role="status">No se pudo verificar el registro de celulares.</p> : receivers !== null ? <p>{receivers ? `${receivers} celular(es) registrado(s) para tu cuenta.` : "Sin celulares registrados para recibir FCM. Activa avisos desde Cuidar > Alertas en tu Android."}</p> : <p>Registro no consultado.</p>}<p className="cloud-footnote">El mapa y los incidentes web no requieren FCM. El envío push actual necesita la PC emisora configurada y activa; las pruebas SOS requieren aceptar pruebas en cada celular receptor.</p></details>
        <div className="cloud-person"><div><h3>{person.full_name}</h3><p>{person.room}</p></div><span className={fresh ? `cloud-signal ${["CAIDA_CONFIRMADA","POSIBLE_CAIDA"].includes(sample.payload.state ?? "") ? "critical" : "fresh"}` : "cloud-signal"}><Activity size={16} />{fresh ? STATE[sample.payload.state ?? ""] ?? "Lectura reciente" : sample?.payload.simulated ? "Muestra de simulación" : "Sin lecturas recientes"}</span></div>
        <IncidentPanel resident={selected} session={session} />
        <div className="cloud-metrics"><div><span>Aceleración</span><strong>{metric(sample?.payload.accel_g, " g")}</strong></div><div><span>Inclinación</span><strong>{metric(sample?.payload.tilt_deg, "°")}</strong></div><div><span>Movimiento</span><strong>{metric(sample?.payload.motion)}</strong></div></div>
        <p className="cloud-last"><Clock3 size={16} />{sample ? `Última muestra: ${time(sample.observed_at)} · hace ${Math.floor(age ?? 0)} s` : "Sin muestras del cinturón para este perfil"}</p>
        {positionError && <p role="alert" className="cloud-warning">{positionError}</p>}
        <RemoteGeofence key={selected} resident={selected} session={session} position={position} clock={clock} />
        <div className="cloud-section-title"><Bell size={19} /><h3>Eventos recibidos</h3></div>
        {events.length ? <ol className="cloud-events">{events.map(event => <li key={event.id}><div><strong>{event.event_type.replaceAll("_", " ")}</strong><p>{event.detail.text ?? ""}</p></div><div>{event.simulated && <span>Simulado</span>}<time>{time(event.observed_at)}</time></div></li>)}</ol> : <p className="cloud-footnote">No hay eventos recibidos para este perfil.</p>}
      </>}
    </section>
  </div>;
}
