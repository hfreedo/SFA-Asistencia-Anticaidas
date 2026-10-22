import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Clock3, Hand, MapPin, RefreshCw, ShieldAlert, TestTube2, X } from "lucide-react";
import "./incidents.css";
import { ZoneSituation, zoneNeedsFollowup, type ZoneStatus } from "./ZoneSituation";

type Incident = { id: string; event_type: string; observed_at: string; simulated: boolean; detail: { text?: string };
  actor_id: string | null; outcome: "attending" | "attended" | "false_alarm" | null; updated_at: string | null };
const labels: Record<string, string> = { SOS: "Solicitud SOS", PRUEBA_SOS: "Prueba SOS entre dispositivos", PRUEBA_NOTIFICACION: "Prueba de notificación", CAIDA_CONFIRMADA: "Caída informada", GEOCERCA_SALIDA: "Salida de geocerca" };
export type IncidentSnapshot = { events: Incident[]; can_attend: boolean; viewer_id: string; zone_status?: ZoneStatus|null };
export type IncidentApi = { load: () => Promise<IncidentSnapshot>; attend: (id: string, expected: string | null, outcome: string) => Promise<void> };
export type IncidentAttention = { pending:number; followup:boolean };
const browserAllowed = () => typeof Notification !== "undefined" && window.isSecureContext && Notification.permission === "granted";
const isPending = (item: Incident) => !item.outcome || item.outcome === "attending";
function elapsed(stamp: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(stamp)) / 1000));
  if (!Number.isFinite(seconds)) return "Sin hora válida";
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function IncidentWorkspace({ api, compact = false, onAttentionChange }: { api: IncidentApi; compact?: boolean; onAttentionChange?:(summary:IncidentAttention)=>void }) {
  const [items, setItems] = useState<Incident[]>([]);
  const [zone, setZone] = useState<ZoneStatus|null>(null);
  const [canAttend, setCanAttend] = useState(false);
  const [viewer, setViewer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [desktop, setDesktop] = useState(browserAllowed);
  const [now, setNow] = useState(Date.now);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [confirmation, setConfirmation] = useState<{ item: Incident; outcome: "attended" | "false_alarm" } | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const notify = useRef(browserAllowed());
  const firstPending = useRef<HTMLLIElement>(null);
  const supportsDesktop = typeof Notification !== "undefined" && window.isSecureContext;
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    let active = true; let requesting = false;
    const load = async () => {
      if (requesting) return;
      requesting = true;
      try {
        const result = await api.load();
        if (!active) return;
        const events = result.events;
        if (seen.current && notify.current && supportsDesktop && Notification.permission === "granted") {
          for (const event of events) {
            const age = Date.now() - Date.parse(event.observed_at);
            if (!seen.current.has(event.id) && !event.outcome && age >= -30000 && age <= 300000) {
              try { new Notification(event.simulated ? "SFA · Prueba de aviso" : event.event_type === "GEOCERCA_SALIDA" ? "SFA · Salida de geocerca" : "SFA · Solicitud de asistencia", {
                body: event.simulated ? "Prueba recibida; no es una emergencia." : "Abre el panel para consultar el incidente.", tag: event.id,
              }); } catch { setFeedback("El navegador bloqueó el aviso de escritorio. El incidente permanece en el panel."); }
            }
          }
        }
        seen.current = new Set(events.map(e => e.id));
        setItems(events); setZone(result.zone_status ?? null); setCanAttend(Boolean(result.can_attend)); setViewer(result.viewer_id); setError(""); setCheckedAt(Date.now());
      } catch (failure) { if (active) {
        const code = (failure as {code?: string; status?: number})?.code;
        if (code === "42501" || code === "PGRST301" || (failure as {status?:number})?.status === 401 || (failure as {status?:number})?.status === 403) { setItems([]); setZone(null); }
        const status = (failure as {status?:number})?.status;
        setCanAttend(false); setError(status === 401 || status === 403
          ? "No se pudieron actualizar los incidentes. Abre Acceso y sincronización, inicia sesión y reanuda los envíos de esta PC; verifica el perfil vinculado y sus permisos."
          : "No se pudieron actualizar los incidentes. El último estado recibido no confirma la situación actual. Revisa conexión, sesión y permisos.");
      } }
      finally { requesting = false; }
    };
    const refreshVisible = () => { if (document.visibilityState !== "hidden") void load(); };
    void load(); const timer = window.setInterval(() => void load(), 3000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refreshVisible); document.removeEventListener("visibilitychange", refreshVisible); };
  }, [api, revision, supportsDesktop]);

  async function act(item: Incident, outcome: "attending" | "attended" | "false_alarm") {
    setBusy(true); setFeedback("");
    try {
      await api.attend(item.id, item.updated_at, outcome);
      setFeedback(outcome === "attending" ? "Atención tomada. Los demás cuidadores verán tu estado." : "Resolución registrada y compartida.");
    } catch { setFeedback("No se guardó el cambio. Otro cuidador puede haber actualizado la atención o tus permisos cambiaron. Se consultará el estado actual."); }
    finally { setBusy(false); setConfirmation(null); setRevision(n => n + 1); }
  }
  async function enableDesktop() {
    if (!supportsDesktop) return;
    try {
      const allowed = await Notification.requestPermission();
      notify.current = allowed === "granted"; setDesktop(notify.current);
      if (notify.current) { seen.current = new Set(); setRevision(n => n + 1); }
      setFeedback(notify.current ? "Avisos habilitados mientras este panel esté abierto." : "Avisos bloqueados por el navegador; los incidentes siguen disponibles aquí.");
    } catch { setFeedback("No se pudo solicitar el permiso del navegador."); }
  }
  const pending = items.filter(isPending);
  const realPending = pending.filter(item => !item.simulated);
  const followup = zoneNeedsFollowup(zone,now,!error);
  useEffect(()=>{ onAttentionChange?.({pending:realPending.length,followup}); },[realPending.length,followup,onAttentionChange]);
  const visible = [...(showHistory ? items : pending)].sort((a,b) =>
    Number(isPending(b) && !b.simulated) - Number(isPending(a) && !a.simulated) || Date.parse(a.observed_at) - Date.parse(b.observed_at));
  const exits = realPending.filter(item => item.event_type === "GEOCERCA_SALIDA").length;
  const oldest = realPending.reduce<Incident | null>((first,item) => !first || Date.parse(item.observed_at) < Date.parse(first.observed_at) ? item : first, null);
  return <section className="incident-workspace" aria-labelledby="incidents-title">
    <ZoneSituation zone={zone} now={now} connected={!error} closedExit={!realPending.some(item=>item.event_type==="GEOCERCA_SALIDA") && items.some(item=>!item.simulated && item.event_type==="GEOCERCA_SALIDA" && !isPending(item))}/>
    {realPending.length > 0 && <div className="persistent-incident-alert" role="alert" aria-label="Atención pendiente">
      <span className="incident-priority-icon">{exits ? <MapPin size={28} /> : <ShieldAlert size={28} />}</span><div className="incident-priority-copy"><span className="incident-eyebrow">Requiere atención del cuidador</span>
        <strong>{exits && exits === realPending.length ? "Salida de geocerca pendiente de atención" : "Hay solicitudes de asistencia pendientes"}</strong>
        <div className="incident-summary"><span>Geocerca <b>{exits}</b></span><span>SOS <b>{realPending.filter(item => item.event_type === "SOS").length}</b></span><span>Caídas <b>{realPending.filter(item => item.event_type === "CAIDA_CONFIRMADA").length}</b></span></div>
        <p>Reingresar a la zona o descartar el aviso no cierra la atención.</p></div>
      <div className="incident-priority-action"><span><Clock3 size={16} />Pendiente desde hace</span><strong>{oldest ? elapsed(oldest.observed_at, now) : "00:00"}</strong>
        <button onClick={() => { setShowHistory(false); firstPending.current?.focus(); firstPending.current?.scrollIntoView({block:"nearest",behavior:"smooth"}); }}>Revisar pendientes</button></div>
    </div>}
    <div className="cloud-section-title"><ShieldAlert size={21} /><h3 id="incidents-title">Incidentes y atención</h3>
      <button className="access-secondary" disabled={busy} onClick={() => setRevision(n => n + 1)}><RefreshCw size={16} />Actualizar incidentes</button>
    </div>
    <div className="incident-tools"><button className="access-secondary" aria-pressed={showHistory} onClick={() => setShowHistory(v => !v)}>{showHistory ? "Ver pendientes" : `Ver historial (${items.length})`}</button>
      {supportsDesktop && <button className="access-secondary" aria-pressed={desktop} onClick={() => { if (desktop) { notify.current = false; setDesktop(false); } else void enableDesktop(); }}><Bell size={16} />{desktop ? "Desactivar avisos en esta PC" : "Activar avisos en esta PC"}</button>}
      <span className={error ? "incident-sync is-stale" : "incident-sync"} role="status">{error ? "Canal sin actualizar" : checkedAt ? `Consulta verificada hace ${Math.max(0,Math.floor((now-checkedAt)/1000))} s` : "Conectando al canal de incidentes"}</span>
    </div>
    {error && <p role="alert" className="cloud-warning">{error}</p>}
    {feedback && <p role="status" className="cloud-footnote">{feedback}</p>}
    {!error && !visible.length && <p className="cloud-footnote">No hay incidentes {showHistory ? "registrados" : "pendientes"} para este residente.</p>}
    <ol className="incident-list">{visible.map(item => <li key={item.id} ref={item.id === visible.find(event => !event.simulated && isPending(event))?.id ? firstPending : undefined} tabIndex={-1} className={`incident-row ${item.simulated ? "is-test" : isPending(item) ? "is-priority" : "is-resolved"}`}>
      <div className="incident-copy"><strong>{item.simulated ? <TestTube2 size={20} /> : item.event_type === "GEOCERCA_SALIDA" ? <MapPin size={23} /> : <ShieldAlert size={23} />}{labels[item.event_type] ?? "Incidente de asistencia"}</strong>
        <p>{item.simulated ? "PRUEBA · No es una emergencia" : item.detail.text ?? ""}</p>
        <time dateTime={item.observed_at}>{new Date(item.observed_at).toLocaleString("es")}</time>
        {!item.simulated && isPending(item) && <span className="incident-elapsed"><Clock3 size={15} />{elapsed(item.observed_at, now)} sin resolver</span>}
        <span className="incident-state">{!item.outcome ? "Pendiente de atención" : item.outcome === "attended" ? "Atención realizada" : item.outcome === "false_alarm" ? "Falsa alarma registrada" : item.actor_id === viewer ? "En atención por ti" : "En atención por otro cuidador"}</span>
      </div>
      {canAttend && !item.outcome && <button className="access-primary" disabled={busy} onClick={() => void act(item, "attending")}><Hand size={17} />Tomar atención</button>}
      {canAttend && item.outcome === "attending" && item.actor_id === viewer && <div className="cloud-actions">
        <button className="access-primary" disabled={busy} onClick={() => setConfirmation({ item, outcome: "attended" })}><CheckCheck size={17} />Atención realizada</button>
        <button className="access-secondary" disabled={busy} onClick={() => setConfirmation({ item, outcome: "false_alarm" })}><X size={17} />Falsa alarma</button>
      </div>}
    </li>)}</ol>
    {!compact && <p className="cloud-footnote">Las alertas de este panel no requieren permisos de notificación. Los avisos del sistema son opcionales y no confirman entrega al celular.</p>}
    {confirmation && <div className="team-dialog-backdrop"><section role="alertdialog" aria-modal="true" aria-labelledby="incident-confirm-title" className="team-dialog" onKeyDown={event => {
      if (event.key === "Escape" && !busy) setConfirmation(null);
      if (event.key === "Tab") {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        if (!buttons.length) event.preventDefault();
        else if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
      }
    }}>
      <h3 id="incident-confirm-title">{confirmation.outcome === "attended" ? "Confirmar atención realizada" : "Confirmar falsa alarma"}</h3>
      <p>El cambio se compartirá con los cuidadores autorizados. El incidente no se borra.</p>
      {confirmation.item.event_type === "GEOCERCA_SALIDA" && <p>Cerrar la atención no confirma que la persona haya regresado. Si sigue fuera o el GPS es incierto, la advertencia de zona permanecerá visible.</p>}
      <div className="cloud-actions"><button autoFocus className="access-secondary" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</button><button className="access-primary" disabled={busy} onClick={() => void act(confirmation.item, confirmation.outcome)}>Confirmar resolución</button></div>
    </section></div>}
  </section>;
}
