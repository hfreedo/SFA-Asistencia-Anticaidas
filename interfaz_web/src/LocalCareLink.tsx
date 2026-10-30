import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { CircleAlert, CircleCheck, Link2, LoaderCircle } from "lucide-react";
import { accessDataClient } from "./accessClient";
import { TeamSelect } from "./TeamSelect";
import "./localCareLink.css";

type Person = { id: string; full_name: string; room: string };
export function LocalCareLink({ session, localId }: { session: Session; localId?: number }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; success: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [saved, setSaved] = useState<Person|null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    let active = true;
    setPeople([]); setSelected(""); setConfirmed(false); setNotice(null); setFailed(false); setUnavailable(false); setSaved(null); setEditing(false);
    const consultation = fetch("/api/cloud/monitor-session", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(response => { if (!response.ok && active) {
        const missing=response.status===404 || response.status===405;
        setUnavailable(missing);
        setNotice({ text: missing ? "El servidor activo no incluye la vinculación por cuenta. Inicia el Centro más reciente y vuelve a cargar esta página. Tus fichas se conservan." : response.status===403 ? "La conexión de esta página fue rechazada por la protección local. Revisa el origen y el puerto del panel; no cambies los permisos del equipo." : "No se pudo habilitar la consulta. Revisa la sesión, los permisos y la versión del Centro.", success:false });
      } return response.ok; })
      .catch(() => { if (active) setNotice({ text: "No se pudo reanudar la consulta en esta PC.", success: false }); return false; });
    void Promise.resolve(accessDataClient(session.access_token).from("sfa_residents").select("id,full_name,room").is("archived_at", null).order("full_name"))
      .then(async result => {
        if (!active) return;
        if (result.error) { setFailed(true); return; }
        const authorized:Person[] = result.data ?? [];
        setPeople(authorized);
        if (!await consultation || !active) return;
        const response = await fetch("/api/cloud/status", {cache:"no-store"}).catch(() => null);
        if (!response?.ok || !active) return;
        const status = await response.json();
        if (!active || status.monitor_session_active !== true || !Array.isArray(status.monitor_links)) return;
        const link = status.monitor_links.find((item:{local_resident_id:number;resident_id:string}) => item.local_resident_id === localId);
        const person = authorized.find(person => person.id === link?.resident_id);
        if (person) { setSaved(person); setSelected(person.id); }
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [session.access_token, localId]);
  async function connect() {
    if (!localId || !selected || !confirmed || busy || unavailable) return;
    setBusy(true); setNotice(null);
    try {
      const result = await fetch("/api/cloud/monitor", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ local_resident_id: localId, remote_resident_id: selected }) });
      if (!result.ok) {
        if(result.status===404 || result.status===405) { setUnavailable(true); throw new Error("server_version"); }
        if(result.status===403) throw new Error("local_access");
        throw new Error();
      }
      const body = await result.json();
      if (body.linked !== true || body.remote_resident_id !== selected) throw new Error();
      setSaved(people.find(person => person.id === selected) ?? null); setEditing(false); setConfirmed(false);
      setNotice({ text: "Monitoreo vinculado. Abre Ubicación > Por internet para consultar esta ficha.", success: true });
    } catch(error) { setNotice({ text: error instanceof Error && error.message==="server_version" ? "El servidor activo no incluye esta vinculación. Inicia el Centro más reciente; no es necesario cambiar cuidadores ni crear otra ficha." : error instanceof Error && error.message==="local_access" ? "Acceso rechazado. Comprueba la conexión local y la autorización de tu cuenta para esta ficha. No se confirmó el vínculo." : "No se pudo verificar el vínculo. Comprueba permisos, conexión y la versión del Centro.", success: false }); }
    finally { setBusy(false); }
  }
  return <section className="local-care-link" aria-labelledby="local-care-title" aria-busy={busy}><h2 id="local-care-title">Monitorear una ficha existente</h2>
    {failed && <div className="care-link-feedback" role="alert"><CircleAlert size={18} aria-hidden="true"/><span>No se pudieron consultar las fichas autorizadas.</span></div>}
    {notice && <div className={`care-link-feedback${notice.success ? " is-success" : ""}`} role={notice.success ? "status" : "alert"}>{notice.success ? <CircleCheck size={18} aria-hidden="true"/> : <CircleAlert size={18} aria-hidden="true"/>}<span>{notice.text}</span></div>}
    {saved && !editing ? <div className="care-link-saved">
      <div><span className="care-link-caption">Ficha que consultas con esta cuenta</span><strong>{saved.full_name}</strong><span>{saved.room}</span><p><CircleCheck size={15} aria-hidden="true"/>Vínculo guardado · consulta habilitada</p></div>
      <button className="resident-button" onClick={() => { setEditing(true); setConfirmed(false); setNotice(null); }}>Cambiar ficha</button>
    </div> : <>
    <div className="care-link-field"><label htmlFor="monitor-person">Ficha a monitorear</label><TeamSelect id="monitor-person" icon={Link2} value={selected} disabled={busy || !localId} onChange={e => { setSelected(e.target.value); setConfirmed(false); if(!unavailable) setNotice(null); }}><option value="">Seleccionar ficha autorizada</option>{people.map(p => <option key={p.id} value={p.id}>{`${p.full_name} · ${p.room} · ${p.id.slice(0,8)}`}</option>)}</TeamSelect></div>
    <label className="care-link-confirm"><input type="checkbox" checked={confirmed} disabled={!selected || busy} onChange={e => setConfirmed(e.target.checked)}/><span>Confirmo que quiero consultar esta persona desde esta PC.</span></label>
    <button className="access-primary" disabled={!localId || !selected || !confirmed || busy || unavailable} onClick={() => void connect()}>{busy ? <LoaderCircle className="access-spin" size={17} aria-hidden="true"/> : <Link2 size={17} aria-hidden="true"/>}{busy ? "Vinculando…" : "Vincular monitoreo"}</button>
    {saved && <button className="resident-button care-link-cancel" onClick={() => { setEditing(false); setSelected(saved.id); setConfirmed(false); setNotice(null); }}>Conservar vínculo actual</button>}
    </>}
    <p className="cloud-footnote">No crea otra ficha, no envía datos del cinturón y no cambia cuidadores. Este vínculo pertenece a tu cuenta en esta PC.</p>
  </section>;
}
