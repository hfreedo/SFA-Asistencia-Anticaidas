import { useEffect, useState } from "react";
import { Cloud, LogIn, RefreshCw } from "lucide-react";
import { RemoteLocation, type RemotePosition } from "./RemoteLocation";

export function LocalRemoteLocation({ residentId, residentName }: { residentId?: number; residentName: string }) {
  const [result, setResult] = useState<{ id: number; position: RemotePosition | null; error: string; reference: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [loading, setLoading] = useState(false);
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
          const error = response.status === 401 ? "Inicia sesión en el acceso de esta PC y reanuda los envíos para habilitar la consulta remota."
            : response.status === 404 ? "Este perfil local todavía no está vinculado al residente de Supabase. Vincúlalo desde el acceso de esta PC."
            : response.status === 403 ? "Abre el panel en localhost y comprueba que tu cuenta tenga acceso a este residente."
            : "No se pudo consultar Supabase. Revisa la conexión de esta PC.";
          if (active) setResult({ id: residentId, position: null, error, reference: typeof code === "string" && /^[a-z_]{1,40}$/.test(code) ? code : String(response.status) });
        } else if (active) setResult({ id: residentId, position: data.position ?? null, error: "", reference: "" });
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
    <div className="geo-section-heading"><Cloud size={20} /><h3>GPS por internet · {residentName}</h3>
      <button type="button" className="resident-button" disabled={!residentId || loading} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={17} />Actualizar</button></div>
    <p className="remote-gps-description">Ubicación compartida desde la app Android mediante Wi-Fi o datos móviles. No requiere cinturón ni la misma red que esta PC.</p>
    {!residentId ? <p role="status">Selecciona un residente para consultar su ubicación.</p> : current?.error ? <div className="geo-feedback error" role="alert"><Cloud size={19} /><div><strong>{current.error}</strong><p>Referencia: {current.reference}</p></div></div> : <>
      {!current && <p role="status">Consultando la ubicación remota…</p>}
      {current && <RemoteLocation position={current.position} clock={clock} />}
    </>}
    <div className="geo-actions"><a className="resident-button link-resident" href="/acceso/acceso.html" target="_blank" rel="noopener noreferrer"><LogIn size={17} />Acceso y vínculo de esta PC</a></div>
    <p className="remote-gps-footnote">La geocerca configurada en el modo local aún no se sincroniza con Android por internet. Este mapa muestra posición y precisión, no confirma entradas ni salidas de zona.</p>
  </section>;
}
