import { useEffect, useMemo, useState } from "react";
import { Cloud, LogIn, RefreshCw } from "lucide-react";
import { type RemotePosition } from "./RemoteLocation";
import { InternetGeofence, type ZoneApi } from "./CloudGeofence";

export function LocalRemoteLocation({ residentId, residentName, onPrepare }: { residentId?: number; residentName: string; onPrepare?: () => void }) {
  const [result, setResult] = useState<{ id: number; position: RemotePosition | null; error: string; reference: string; remoteName?: string; remoteId?: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const zoneApi = useMemo<ZoneApi>(() => {
    const request = async (body?: object) => {
      const response = await fetch(`/api/cloud/residents/${residentId}/geofence`, { cache: "no-store", ...(body ? {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      } : {}) });
      if (!response.ok) throw new Error("Remote zone unavailable");
      return response.json();
    };
    return { load: () => request(), save: body => request(body) };
  }, [residentId]);
  useEffect(() => {
    if (!residentId) return;
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      if (active) setLoading(true);
      try {
        const response = await fetch(`/api/cloud/residents/${residentId}/location`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          const code = data?.detail?.code;
          const error = response.status === 401 ? "Abre Preparación e inicia sesión con tu cuenta de cuidador o administrador para consultar la ubicación."
            : response.status === 404 ? "Este perfil local todavía no está vinculado al residente de Supabase. Vincúlalo desde Preparación."
            : response.status === 403 ? "Abre el panel en localhost y comprueba que tu cuenta tenga acceso a este residente."
            : "No se pudo consultar Supabase. Revisa la conexión de esta PC.";
          if (active) setResult({ id: residentId, position: null, error, reference: typeof code === "string" && /^[a-z_]{1,40}$/.test(code) ? code : String(response.status) });
        } else if (active) setResult({ id: residentId, position: data.position ?? null, error: "", reference: "", remoteName: data.remote_name, remoteId: data.remote_resident_id });
      } catch { if (active) setResult({ id: residentId, position: null, error: "No se pudo conectar con el servidor de esta PC.", reference: "network" }); }
      finally { pending = false; if (active) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [residentId, refresh]);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const current = result?.id === residentId ? result : null;
  return <section className="local-remote-gps" aria-label="GPS por internet">
    <div className="geo-section-heading"><Cloud size={20} /><h3>GPS por internet · {current?.remoteId && !current.error ? current.remoteName || "Persona autorizada" : "Ficha por verificar"}</h3>
      <button type="button" className="resident-button" disabled={!residentId || loading} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={17} />Actualizar</button></div>
    <p className="remote-gps-description">Ubicación compartida desde la app Android mediante Wi-Fi o datos móviles. No requiere cinturón ni la misma red que esta PC.</p>
    <p className="cloud-footnote">Perfil local de esta PC: {residentName}. La consulta por internet utiliza su vínculo autorizado.</p>
    {!residentId ? <p role="status">Selecciona un residente para consultar su ubicación.</p> : current?.error ? <div className="geo-feedback error" role="alert"><Cloud size={19} /><div><strong>{current.error}</strong><p>Referencia: {current.reference}</p></div></div> : <>
      {!current && <p role="status">Consultando la ubicación remota…</p>}
      {current && <InternetGeofence key={residentId} api={zoneApi} position={current.position} clock={clock} />}
    </>}
    <div className="geo-actions">{onPrepare ? <button className="resident-button link-resident" onClick={onPrepare}><LogIn size={17} />Preparar acceso y vínculo</button> : <a className="resident-button link-resident" href="/acceso/acceso.html" target="_blank" rel="noopener noreferrer"><LogIn size={17} />Acceso y vínculo de esta PC</a>}</div>
    <p className="remote-gps-footnote">Guarda la zona remota aquí para que Android la consulte por internet. La zona local de la PC no se copia automáticamente.</p>
  </section>;
}
