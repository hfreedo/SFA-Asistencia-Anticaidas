import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link2 } from "lucide-react";
import { accessDataClient } from "./accessClient";
import { TeamSelect } from "./TeamPanel";

type Person = { id: string; full_name: string; room: string };
export function LocalCareLink({ session, localId }: { session: Session; localId?: number }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setPeople([]); setSelected(""); setConfirmed(false); setNotice(""); setFailed(false);
    void fetch("/api/cloud/monitor-session", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(response => { if (!response.ok && active) setNotice("Actualiza el Centro para habilitar el monitoreo por cuenta en esta PC."); })
      .catch(() => { if (active) setNotice("No se pudo reanudar la consulta en esta PC."); });
    void Promise.resolve(accessDataClient(session.access_token).from("sfa_residents").select("id,full_name,room").is("archived_at", null).order("full_name"))
      .then(result => { if (!active) return; if (result.error) setFailed(true); else setPeople(result.data ?? []); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [session.access_token, localId]);
  async function connect() {
    if (!localId || !selected || !confirmed || busy) return;
    setBusy(true); setNotice("");
    try {
      const result = await fetch("/api/cloud/monitor", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ local_resident_id: localId, remote_resident_id: selected }) });
      if (!result.ok) throw new Error();
      const body = await result.json();
      if (body.linked !== true || body.remote_resident_id !== selected) throw new Error();
      setNotice("Monitoreo vinculado. Abre Ubicación > Por internet para consultar esta ficha.");
    } catch { setNotice("No se pudo verificar el vínculo. Comprueba permisos, conexión y la versión del Centro."); }
    finally { setBusy(false); }
  }
  return <section className="cloud-local" aria-labelledby="local-care-title"><h2 id="local-care-title">Monitorear una ficha existente</h2>
    {failed && <p role="alert">No se pudieron consultar las fichas autorizadas.</p>}
    <div className="team-field"><label htmlFor="monitor-person">Ficha remota para el mapa de esta PC</label><TeamSelect id="monitor-person" icon={Link2} value={selected} disabled={busy || !localId} onChange={e => { setSelected(e.target.value); setConfirmed(false); setNotice(""); }}><option value="">Seleccionar ficha autorizada</option>{people.map(p => <option key={p.id} value={p.id}>{`${p.full_name} · ${p.room} · ${p.id.slice(0,8)}`}</option>)}</TeamSelect></div>
    <label className="team-check"><input type="checkbox" checked={confirmed} disabled={!selected || busy} onChange={e => setConfirmed(e.target.checked)}/>Confirmo que esta es la persona que quiero ver desde el perfil local seleccionado.</label>
    <button className="access-primary" disabled={!localId || !selected || !confirmed || busy} onClick={() => void connect()}><Link2 size={17}/>Vincular monitoreo</button>
    {notice && <p role="status">{notice}</p>}
    <p className="cloud-footnote">No crea otra ficha, no envía datos del cinturón y no cambia cuidadores. Este vínculo pertenece a tu cuenta en esta PC.</p>
  </section>;
}
