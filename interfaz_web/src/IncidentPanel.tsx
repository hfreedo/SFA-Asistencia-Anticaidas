import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Bell, CheckCheck, Hand, RefreshCw, ShieldAlert, TestTube2, X } from "lucide-react";
import { accessDataClient } from "./accessClient";

type Incident = { id: string; event_type: string; observed_at: string; simulated: boolean; detail: { text?: string };
  actor_id: string | null; outcome: "attending" | "attended" | "false_alarm" | null; updated_at: string | null };
const labels: Record<string, string> = { SOS: "Solicitud SOS", PRUEBA_SOS: "Prueba SOS entre dispositivos", PRUEBA_NOTIFICACION: "Prueba de notificación", CAIDA_CONFIRMADA: "Caída informada", GEOCERCA_SALIDA: "Salida de geocerca" };

export function IncidentPanel({ resident, session }: { resident: string; session: Session }) {
  return <IncidentWorkspace key={resident + session.user.id} resident={resident} session={session} />;
}
function IncidentWorkspace({ resident, session }: { resident: string; session: Session }) {
  const [items, setItems] = useState<Incident[]>([]);
  const [canAttend, setCanAttend] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [confirmation, setConfirmation] = useState<{ item: Incident; outcome: "attended" | "false_alarm" } | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const notify = useRef(false);
  const supportsDesktop = typeof Notification !== "undefined" && window.isSecureContext;
  useEffect(() => {
    let active = true; let requesting = false;
    const load = async () => {
      if (requesting) return;
      requesting = true;
      try {
        const result = await accessDataClient(session.access_token).rpc("sfa_incidents", { p_resident: resident });
        if (result.error) throw result.error;
        if (!active) return;
        const events = result.data.events as Incident[];
        if (seen.current && notify.current && supportsDesktop && Notification.permission === "granted") {
          for (const event of events) {
            const age = Date.now() - Date.parse(event.observed_at);
            if (!seen.current.has(event.id) && !event.outcome && age >= -30000 && age <= 300000) {
              try { new Notification(event.simulated ? "SFA · Prueba de aviso" : "SFA · Solicitud de asistencia", {
                body: event.simulated ? "Prueba recibida; no es una emergencia." : "Abre el panel para consultar el incidente.", tag: event.id,
              }); } catch { setFeedback("El navegador bloqueó el aviso de escritorio. El incidente permanece en el panel."); }
            }
          }
        }
        seen.current = new Set(events.map(e => e.id));
        setItems(events); setCanAttend(Boolean(result.data.can_attend)); setError("");
      } catch { if (active) { setItems([]); setCanAttend(false); setError("No se pudieron consultar los incidentes. Revisa conexión, sesión y habilitación del servicio."); } }
      finally { requesting = false; }
    };
    void load(); const timer = window.setInterval(() => void load(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [resident, session.access_token, revision, supportsDesktop]);

  async function act(item: Incident, outcome: "attending" | "attended" | "false_alarm") {
    setBusy(true); setFeedback("");
    try {
      const result = await accessDataClient(session.access_token).rpc("sfa_attend_incident", {
        p_event: item.id, p_expected: item.updated_at, p_outcome: outcome,
      });
      if (result.error) throw result.error;
      setFeedback(outcome === "attending" ? "Atención tomada. Los demás cuidadores verán tu estado." : "Resolución registrada y compartida.");
    } catch { setFeedback("No se guardó el cambio. Otro cuidador puede haber actualizado la atención o tus permisos cambiaron. Se consultará el estado actual."); }
    finally { setBusy(false); setConfirmation(null); setRevision(n => n + 1); }
  }
  async function enableDesktop() {
    if (!supportsDesktop) return;
    try {
      const allowed = await Notification.requestPermission();
      notify.current = allowed === "granted"; setDesktop(notify.current);
      setFeedback(notify.current ? "Avisos habilitados mientras este panel esté abierto." : "Avisos bloqueados por el navegador; los incidentes siguen disponibles aquí.");
    } catch { setFeedback("No se pudo solicitar el permiso del navegador."); }
  }
  const pending = items.filter(item => !item.outcome || item.outcome === "attending");
  const visible = showHistory ? items : pending;
  return <section className="incident-workspace" aria-labelledby="incidents-title">
    <div className="cloud-section-title"><ShieldAlert size={21} /><h3 id="incidents-title">Incidentes y atención</h3>
      <button className="access-secondary" disabled={busy} onClick={() => setRevision(n => n + 1)}><RefreshCw size={16} />Actualizar incidentes</button>
    </div>
    <div className="incident-tools"><button className="access-secondary" aria-pressed={showHistory} onClick={() => setShowHistory(v => !v)}>{showHistory ? "Ver pendientes" : `Ver historial (${items.length})`}</button>
      {supportsDesktop && <button className="access-secondary" aria-pressed={desktop} onClick={() => { if (desktop) { notify.current = false; setDesktop(false); } else void enableDesktop(); }}><Bell size={16} />{desktop ? "Desactivar avisos en esta PC" : "Activar avisos en esta PC"}</button>}
      <span>{pending.length} pendientes</span>
    </div>
    {error && <p role="alert" className="cloud-warning">{error}</p>}
    {feedback && <p role="status" className="cloud-footnote">{feedback}</p>}
    {!error && !visible.length && <p className="cloud-footnote">No hay incidentes {showHistory ? "registrados" : "pendientes"} para este residente.</p>}
    <ol className="incident-list">{visible.map(item => <li key={item.id} className={item.simulated ? "incident-row is-test" : "incident-row"}>
      <div className="incident-copy"><strong>{item.simulated && <TestTube2 size={17} />}{labels[item.event_type] ?? "Incidente de asistencia"}</strong>
        <p>{item.simulated ? "PRUEBA · No es una emergencia" : item.detail.text ?? ""}</p>
        <time dateTime={item.observed_at}>{new Date(item.observed_at).toLocaleString("es")}</time>
        <span className="incident-state">{!item.outcome ? "Pendiente de atención" : item.outcome === "attended" ? "Atención realizada" : item.outcome === "false_alarm" ? "Falsa alarma registrada" : item.actor_id === session.user.id ? "En atención por ti" : "En atención por otro cuidador"}</span>
      </div>
      {canAttend && !item.outcome && <button className="access-primary" disabled={busy} onClick={() => void act(item, "attending")}><Hand size={17} />Tomar atención</button>}
      {canAttend && item.outcome === "attending" && item.actor_id === session.user.id && <div className="cloud-actions">
        <button className="access-primary" disabled={busy} onClick={() => setConfirmation({ item, outcome: "attended" })}><CheckCheck size={17} />Atención realizada</button>
        <button className="access-secondary" disabled={busy} onClick={() => setConfirmation({ item, outcome: "false_alarm" })}><X size={17} />Falsa alarma</button>
      </div>}
    </li>)}</ol>
    <p className="cloud-footnote">Los avisos de esta PC requieren la página abierta. No confirman entrega al celular. Las pruebas están separadas de emergencias reales.</p>
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
      <div className="cloud-actions"><button autoFocus className="access-secondary" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</button><button className="access-primary" disabled={busy} onClick={() => void act(confirmation.item, confirmation.outcome)}>Confirmar resolución</button></div>
    </section></div>}
  </section>;
}
