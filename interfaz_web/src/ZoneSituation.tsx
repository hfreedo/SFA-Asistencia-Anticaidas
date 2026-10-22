import { MapPin } from "lucide-react";

export type ZoneStatus = { state:"inside"|"outside"|"uncertain"|"imprecise"|"stale"|"unknown"|"unconfigured";
  last_confirmed:"inside"|"outside"|"unknown"; observed_at:string|null };

export function zoneNeedsFollowup(zone:ZoneStatus|null, now:number, connected:boolean) {
  if (!zone || zone.state === "unconfigured") return false;
  const age=zone.observed_at ? now-Date.parse(zone.observed_at) : Infinity;
  const recent=connected && Number.isFinite(age) && age>=-30000 && age<=90000;
  return recent && zone.state === "outside" || zone.last_confirmed === "outside" && !(recent && zone.state === "inside");
}

export function ZoneSituation({ zone, now, connected, closedExit }: { zone:ZoneStatus|null; now:number; connected:boolean; closedExit:boolean }) {
  if (!zone || zone.state === "unconfigured") return null;
  const age = zone.observed_at ? now-Date.parse(zone.observed_at) : Infinity;
  const recent = connected && Number.isFinite(age) && age >= -30000 && age <= 90000;
  const outside = recent && zone.state === "outside";
  const lastOutside = zone.last_confirmed === "outside";
  const inside = recent && zone.state === "inside";
  const title = outside ? closedExit ? "Atención cerrada, pero continúa fuera de la geocerca" : "La persona continúa fuera de la geocerca"
    : lastOutside ? "Última salida confirmada; reingreso no confirmado"
    : inside ? "Reingreso o permanencia dentro de la zona confirmados" : "No se puede confirmar la situación de la zona";
  return <div className={`zone-situation ${outside || lastOutside && !inside ? "needs-followup" : inside ? "is-inside" : "is-uncertain"}`}
    role={outside || lastOutside && !inside ? "alert" : "status"} aria-label="Situación de geocerca">
    <MapPin size={24}/><div><strong>{title}</strong><p>{outside ? "Cerrar un incidente registra la atención, no el regreso. El seguimiento continúa sin repetir avisos por cada posición."
      : inside ? "La posición y la permanencia permiten confirmar la zona. Esto no cierra incidentes pendientes."
      : !recent ? "Sin posición reciente verificada. No se considera que haya vuelto a la zona."
      : "GPS incierto o impreciso: todavía no se puede confirmar un reingreso."}</p>
      {zone.observed_at && <time dateTime={zone.observed_at}>Última evaluación GPS: {new Date(zone.observed_at).toLocaleTimeString("es")}</time>}</div>
  </div>;
}
