import { useEffect, useState } from "react";
import { LocateFixed, MapPin, Pencil, RefreshCw, Save } from "lucide-react";
import { GeofenceRadius } from "./GeofenceRadius";
import { RemoteLocation, type MapGeofence, type RemotePosition } from "./RemoteLocation";
import "./cloud-geofence.css";
import { useDraftGuard } from "./useDraftGuard";
import { withTeamDraftExit } from "./teamDraftGuard";

export type CloudZone = MapGeofence & { address_name: string; updated_at: string };
type Context = { geofence: CloudZone | null; can_configure: boolean };
export type ZoneWrite = { p_lat: number; p_lng: number; p_radius: number; p_label: string; p_expected: string | null };
export type ZoneApi = { load: () => Promise<Context>; save: (value: ZoneWrite) => Promise<Context> };

export function InternetGeofence({ api, position, clock }: { api: ZoneApi; position: RemotePosition | null; clock: number }) {
  const [context, setContext] = useState<Context | null>(null);
  const [lat, setLat] = useState(""); const [lng, setLng] = useState("");
  const [radius, setRadius] = useState(100); const [label, setLabel] = useState("Zona de referencia");
  const [dirty, setDirty] = useState(false); const [editing, setEditing] = useState(false);
  useDraftGuard(dirty);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  function accept(value: Context) {
    setContext(value); setLat(value.geofence ? String(value.geofence.home_lat) : "");
    setLng(value.geofence ? String(value.geofence.home_lng) : ""); setRadius(value.geofence?.radius_m ?? 100);
    setLabel(value.geofence?.address_name ?? "Zona de referencia"); setDirty(false); setEditing(false);
  }
  useEffect(() => {
    let active = true;
    setContext(null); setError(""); setNotice(""); setBusy(true);
    api.load().then(value => { if (active) accept(value); }).catch(() => {
      if (active) setError("No se pudo consultar la zona remota. Revisa sesión, permisos y habilitación del servicio.");
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [api, revision]);
  const valid = lat.trim() !== "" && lng.trim() !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180 && Number.isInteger(radius) && radius >= 5 && radius <= 100000;
  const preview: MapGeofence | null = dirty && valid ? { home_lat: Number(lat), home_lng: Number(lng), radius_m: radius } : context?.geofence ?? null;
  async function save() {
    if (!valid || !context?.can_configure || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      accept(await api.save({ p_lat: Number(lat), p_lng: Number(lng), p_radius: radius, p_label: label.trim(), p_expected: context.geofence?.updated_at ?? null }));
      setNotice("Zona guardada en Supabase. Con seguimiento e internet activos, Android la consulta aproximadamente cada 30 segundos. Esto no confirma que el celular ya la recibió.");
    } catch { setError("No se guardó la zona. Comprueba conexión y permisos; si otra persona la modificó, descarta los cambios y recarga antes de guardar de nuevo."); }
    finally { setBusy(false); }
  }
  return <section className="internet-geofence" aria-label="Geocerca por internet">
    <div className="cloud-zone-heading"><MapPin size={20} /><h3>Zona de referencia por internet</h3>
      <button className="resident-button access-secondary" disabled={busy} onClick={() => withTeamDraftExit(() => { setDirty(false); setEditing(false); setRevision(n => n + 1); })}><RefreshCw size={17} />{dirty ? "Descartar cambios y recargar" : "Actualizar zona"}</button></div>
    {error && <p role="alert" className="cloud-warning">{error}</p>}
    {notice && <p role="status" className="cloud-zone-notice">{notice}</p>}
    {!context && !error && <p role="status">Consultando zona remota…</p>}
    <div className={context?.can_configure ? "cloud-zone-layout" : ""}><div className="cloud-zone-settings">
    {context && !context.can_configure && <p className="cloud-footnote">Solo lectura. Configurar la zona requiere administración o permiso de configuración para este residente.</p>}
    {context?.can_configure && <form className="cloud-zone-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy}><label className="cloud-zone-name">Nombre del lugar<input maxLength={100} required value={label} onChange={event => { setLabel(event.target.value); setDirty(true); }} /></label>
        <div className="cloud-zone-coordinates"><label>Latitud del centro<input type="number" step="any" min={-90} max={90} required value={lat} onChange={event => { setLat(event.target.value); setDirty(true); }} /></label>
          <label>Longitud del centro<input type="number" step="any" min={-180} max={180} required value={lng} onChange={event => { setLng(event.target.value); setDirty(true); }} /></label></div>
        <GeofenceRadius value={radius} onChange={value => { setRadius(value); setDirty(true); }} />
        <div className="cloud-zone-actions"><button type="button" className="resident-button access-secondary" disabled={!position || position.simulated === true} onClick={() => { if (position && !position.simulated) { setLat(String(position.latitude)); setLng(String(position.longitude)); setDirty(true); } }}><LocateFixed size={17} />Usar posición recibida como centro</button>
          <button type="button" className="resident-button access-secondary" aria-pressed={editing} onClick={() => setEditing(value => !value)}><Pencil size={17} />{editing ? "Terminar selección en mapa" : "Elegir centro en el mapa"}</button>
          <button type="submit" className="resident-button link-resident access-primary" disabled={!valid || !dirty || !label.trim()}><Save size={17} />Guardar zona remota</button></div>
      </fieldset>
    </form>}
    {dirty && <p className="cloud-zone-notice">Vista previa con cambios sin guardar. El celular conserva la última zona guardada.</p>}
    {editing && <p className="cloud-zone-notice">Selección activa: marca el centro en el mapa y guarda la zona.</p>}
    {!context?.geofence && context && !dirty && <p className="cloud-footnote">No hay una zona remota guardada para este residente.</p>}
    </div>
    <RemoteLocation position={position} clock={clock} geofence={preview} onSelectCenter={editing && !busy && context?.can_configure ? (latitude, longitude) => {
      setLat(latitude.toFixed(7)); setLng(longitude.toFixed(7)); setDirty(true);
    } : undefined} />
    </div>
      <p className="cloud-footnote">La zona remota es independiente de la guardada en la PC. La app evalúa su GPS con precisión y permanencia; este mapa no confirma una salida. Los incidentes confirmados se revisan en Incidentes y atención.</p>
  </section>;
}
