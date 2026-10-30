import { useEffect, useState } from "react";
import { ArrowRight, Cable, Clock3, MapPin, RefreshCw } from "lucide-react";
import type { IncidentFeed } from "./IncidentWorkspace";
import { locationLabel, type LocationSnapshot } from "./LocationTools";
import type { RemotePosition } from "./RemoteLocation";
import "./careOverview.css";
import { relativeAge } from "./timeLabels";

export type LocationSource = "remote" | "local";
type GpsReading = { id:number; position:RemotePosition|null; error:string };
class PositionReadError extends Error {}
export function validPosition(value: unknown): value is RemotePosition {
  const p = value as RemotePosition | null;
  return !!p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180
    && Number.isFinite(p.accuracy_m) && p.accuracy_m > 0 && p.accuracy_m <= 10000 && Number.isFinite(Date.parse(p.observed_at));
}
export function positionAge(position: RemotePosition|null, now:number) {
  return position ? (now - Date.parse(position.observed_at)) / 1000 : Infinity;
}
export function recentPosition(position:RemotePosition|null, now:number) {
  const age = positionAge(position,now);
  return Number.isFinite(age) && age >= -30 && age <= 90;
}
function recentStamp(stamp:string|null|undefined,now:number) {
  const age = stamp ? (now-Date.parse(stamp))/1000 : Infinity;
  return Number.isFinite(age) && age>=-30 && age<=90;
}
export function useRemoteHomePosition(id:number|undefined, enabled:boolean) {
  const [reading,setReading] = useState<GpsReading|null>(null);
  const [revision,setRevision] = useState(0);
  useEffect(() => {
    if (!id || !enabled) return;
    let active = true, pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(`/api/cloud/residents/${id}/location`,{cache:"no-store"});
        const data = await response.json();
        if (!response.ok) throw new PositionReadError(response.status === 401 ? "Reanuda la sesión de esta PC desde Preparación."
          : response.status === 404 ? "Este perfil todavía no tiene un vínculo remoto disponible."
          : response.status === 403 ? "No se pudo verificar el permiso de consulta de esta PC." : "No se pudo consultar el GPS por internet.");
        if (data.position != null && !validPosition(data.position)) throw new PositionReadError("La posición recibida no es válida.");
        if (active) setReading({id,position:data.position ?? null,error:""});
      } catch (error) { if (active) setReading({id,position:null,error:error instanceof PositionReadError ? error.message : "No se pudo consultar el GPS por internet."}); }
      finally { pending = false; }
    };
    void load(); const timer = window.setInterval(() => void load(),10000);
    return () => { active = false; window.clearInterval(timer); };
  },[id,enabled,revision]);
  return { reading: enabled && reading?.id === id ? reading : null, refresh: () => setRevision(n=>n+1) };
}

export type LocalActivity = { id:string; type:string; detail:string; at:string; residentId?:number };
export type CareActivityEntry = { id:string; type:string; text:string; at:string; source:string; simulated:boolean };
export function mergeCareActivity(local:LocalActivity[], remote:IncidentFeed|null, id:number|undefined, now:number):CareActivityEntry[] {
  if (!id) return [];
  const sameDay = (stamp:string) => Number.isFinite(Date.parse(stamp)) && Date.parse(stamp) <= now+30000 && new Date(stamp).toDateString() === new Date(now).toDateString();
  const entries:CareActivityEntry[] = local.filter(e=>e.residentId === id && sameDay(e.at)).map(e=>({id:`local:${e.id}`,type:e.type,text:e.detail,at:e.at,source:"PC local",simulated:false}));
  for (const e of remote?.events ?? []) if (sameDay(e.observed_at)) entries.push({id:`remote:${e.id}`,type:e.event_type,text:e.detail.text || "Evento registrado por internet",at:e.observed_at,source:"Por internet",simulated:e.simulated});
  return [...new Map(entries.map(e=>[e.id,e])).values()].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,6);
}
const eventLabels:Record<string,string> = { SOS:"Solicitud SOS", GEOCERCA_SALIDA:"Salida de geocerca", GEOCERCA_REINGRESO:"Reingreso a geocerca", CAIDA_CONFIRMADA:"Caída informada", PRUEBA_SOS:"Prueba SOS", PRUEBA_NOTIFICACION:"Prueba de notificación" };

export function CareLocationSummary({ residentId,source,onSourceChange,local,remote,feed,now,onMap,onPrepare,onRefresh,connectionPaused=false }: {
  residentId?:number; source:LocationSource; onSourceChange:(source:LocationSource)=>void; local:LocationSnapshot|null;
  remote:GpsReading|null; feed:IncidentFeed|null; now:number; onMap:()=>void; onPrepare:()=>void; onRefresh:()=>void; connectionPaused?:boolean;
}) {
  const position = source === "remote" ? remote?.position ?? null : local?.position ?? null;
  const simulated = source === "remote" && remote?.position?.simulated === true;
  const fresh = recentPosition(position,now);
  const age = positionAge(position,now);
  const zoneFresh = !!feed && !feed.error && recentStamp(feed.zone?.observed_at,now);
  const zone = source === "remote" ? zoneFresh && feed?.zone ? locationLabel(feed.zone.state) : "Zona sin evaluación reciente"
    : local && fresh ? locationLabel(local.status) : "Zona sin evaluación reciente";
  const error = source === "remote" ? remote?.error : local?.status === "error" ? "No se pudo consultar el GPS local." : "";
  const title = !residentId ? "Selecciona a la persona cuidada" : error ? "Ubicación sin verificar" : simulated ? "PRUEBA · GPS del celular administrador" : !position ? "Sin posición recibida" : !fresh ? "Ubicación desactualizada" : position.accuracy_m > 100 ? "GPS recibido con baja precisión" : "Ubicación reciente recibida";
  const warning=simulated || !!error || !!position && (!fresh || position.accuracy_m>100);
  return <section className={`care-location-overview${warning ? " is-warning" : ""}`} aria-labelledby="care-location-title">
    <div className="care-overview-heading"><h2 id="care-location-title"><MapPin size={21}/>Ubicación y zona</h2>
      {source === "remote" && <button className="care-icon-action" title="Consultar ubicación por internet" aria-label="Consultar ubicación por internet" disabled={!residentId} onClick={onRefresh}><RefreshCw size={17}/></button>}</div>
    <div className="geo-source-selector" role="group" aria-label="Fuente de ubicación del resumen">
      <button aria-pressed={source==="remote"} onClick={()=>onSourceChange("remote")}>Por internet</button><button aria-pressed={source==="local"} onClick={()=>onSourceChange("local")}>Red local</button></div>
    <div className="care-location-body"><div><strong>{title}</strong><p>{simulated ? "No es la ubicación real de la persona ni evalúa su geocerca." : error && connectionPaused && source === "remote" ? "No se puede confirmar la ubicación actual." : error || zone}</p>
      {position && <div className="care-position-meta"><span>Precisión ±{Math.round(position.accuracy_m)} m{fresh ? "" : " · última lectura"}</span><span>Última posición {relativeAge(age)}</span></div>}
      {source === "remote" && !position && !error && <p>{remote ? "Esperando un envío desde el celular vinculado." : "Consultando el GPS por internet…"}</p>}</div>
      <div className="care-overview-actions"><button className="resident-button link-resident" disabled={!residentId} onClick={onMap}>Ver mapa y geocerca<ArrowRight size={17}/></button>
        {error && !(connectionPaused && source === "remote") && <button className="resident-button" onClick={onPrepare}>Revisar preparación</button>}</div></div>
  </section>;
}
export function CareSignal({ connected,fresh,riskLabel,age,onPrepare }: { connected:boolean; fresh:boolean; riskLabel:string; age:number|null; onPrepare:()=>void }) {
  return <section className="care-signal-row" aria-label="Estado del cinturón"><Cable size={20}/><div><strong>Cinturón · {fresh ? riskLabel : connected ? "Sin señal reciente" : "No conectado"}</strong><span>{fresh ? `Lectura recibida hace ${age} s` : "El seguimiento GPS del celular funciona de forma independiente."}</span></div><button className="resident-button" onClick={onPrepare}>{connected ? "Revisar dispositivo" : "Conectar cinturón"}</button></section>;
}
export function CareActivity({entries,feed}:{entries:CareActivityEntry[];feed:IncidentFeed|null}) {
  return <section className="care-unified-activity" aria-labelledby="care-activity-title"><div className="care-overview-heading"><h2 id="care-activity-title"><Clock3 size={21}/>Actividad reciente de hoy</h2></div>
    {feed?.error ? <p className="care-activity-warning" role="status">El historial por internet no está actualizado. Los registros anteriores no confirman la situación actual.</p>
      : !feed?.checkedAt && <p className="care-activity-note">El canal por internet todavía no se ha verificado.</p>}
    {entries.length ? <ol>{entries.map(e=><li key={e.id}><time dateTime={e.at}>{new Date(e.at).toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"})}</time><div><strong>{eventLabels[e.type] || e.type.replaceAll("_"," ")}</strong><p>{e.text}</p></div><span className="care-source-tag">{e.simulated ? "Prueba · " : ""}{e.source}</span></li>)}</ol>
      : <p className="care-activity-note">Aún no hay eventos recibidos para este perfil. Esto no confirma ausencia de incidentes.</p>}</section>;
}
