import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin } from "lucide-react";

export type RemotePosition = { latitude: number; longitude: number; accuracy_m: number; observed_at: string };
export type MapGeofence = { home_lat: number; home_lng: number; radius_m: number };
export function RemoteLocation({ position, clock, geofence = null, onSelectCenter }: {
  position: RemotePosition | null; clock: number; geofence?: MapGeofence | null;
  onSelectCenter?: (latitude: number, longitude: number) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const layers = useRef<{ map: L.Map; marker: L.CircleMarker | null; accuracy: L.Circle | null; zone: L.Circle | null } | null>(null);
  const selectCenter = useRef(onSelectCenter);
  selectCenter.current = onSelectCenter;
  const hasPosition = !!position && Number.isFinite(position.latitude) && Math.abs(position.latitude) <= 90
    && Number.isFinite(position.longitude) && Math.abs(position.longitude) <= 180;
  const hasZone = !!geofence && Number.isFinite(geofence.home_lat) && Math.abs(geofence.home_lat) <= 90
    && Number.isFinite(geofence.home_lng) && Math.abs(geofence.home_lng) <= 180 && geofence.radius_m >= 5 && geofence.radius_m <= 100000;
  const hasMap = hasPosition || hasZone;
  const age = position ? (clock - Date.parse(position.observed_at)) / 1000 : Infinity;
  const fresh = Number.isFinite(age) && age >= -30 && age <= 90;
  useEffect(() => {
    if (!element.current || !hasMap) return;
    const center: L.LatLngExpression = hasZone && geofence ? [geofence.home_lat, geofence.home_lng] : [position!.latitude, position!.longitude];
    const map = L.map(element.current, { scrollWheelZoom: false }).setView(center, 17);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      // Identify the site to the tile service without exposing the access URL or its parameters.
      referrerPolicy: "origin",
    }).addTo(map);
    layers.current = { map, marker: null, accuracy: null, zone: null };
    map.on("click", (event: L.LeafletMouseEvent) => selectCenter.current?.(event.latlng.lat, event.latlng.lng));
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(element.current);
    return () => { observer.disconnect(); layers.current = null; map.remove(); };
    // GPS polling updates layers below; it must not reset the operator's viewport.
  }, [hasMap]);
  useEffect(() => {
    const current = layers.current;
    if (!current) return;
    if (!hasPosition || !position) {
      current.marker?.remove(); current.accuracy?.remove(); current.marker = null; current.accuracy = null; return;
    }
    const center: L.LatLngExpression = [position.latitude, position.longitude];
    current.marker ??= L.circleMarker(center, { radius: 8, fillOpacity: 1 }).addTo(current.map);
    current.accuracy ??= L.circle(center, { color: "#0d9488", fillOpacity: .08, weight: 1 }).addTo(current.map);
    current.marker.setLatLng(center).setStyle({ color: fresh ? "#0d9488" : "#64748b" });
    current.accuracy.setLatLng(center).setRadius(Math.max(0, position.accuracy_m));
  }, [position, fresh, hasPosition, hasMap]);
  useEffect(() => {
    const current = layers.current;
    if (!current) return;
    if (!hasZone || !geofence) { current.zone?.remove(); current.zone = null; return; }
    const center: L.LatLngExpression = [geofence.home_lat, geofence.home_lng];
    current.zone ??= L.circle(center, { color: "#15803d", fillColor: "#10b981", fillOpacity: .14, weight: 2 }).addTo(current.map);
    current.zone.setLatLng(center).setRadius(geofence.radius_m);
  }, [geofence, hasZone, hasMap]);
  return <section className="cloud-location" aria-labelledby="cloud-location-title">
    <div className="cloud-section-title"><MapPin size={19} /><h3 id="cloud-location-title">Ubicación del celular</h3></div>
    {!hasPosition || !position ? <p className="cloud-footnote">Sin ubicación recibida. El celular puede compartir GPS sin cinturón, usando Wi-Fi o datos móviles.</p> : <p className={fresh ? "cloud-signal fresh" : "cloud-warning"}>{fresh ? "Posición reciente" : "Última posición conocida, no actual"} · precisión ±{Math.round(position.accuracy_m)} m</p>}
    {hasMap && <>
      <div className="cloud-map-toolbar">
        {hasZone && <button type="button" className="resident-button access-secondary" onClick={() => { const current = layers.current; if (current?.zone) current.map.fitBounds(current.zone.getBounds(), { maxZoom: 19, padding: [30,30] }); }}><MapPin size={17} />Ver zona</button>}
        {hasPosition && position && <button type="button" className="resident-button access-secondary" onClick={() => layers.current?.map.panTo([position.latitude, position.longitude])}><LocateFixed size={17} />Centrar en el celular</button>}
      </div>
      <div ref={element} className="cloud-location-map" data-editing={Boolean(onSelectCenter)} aria-label="Mapa de la última ubicación del celular" />
      <p className="cloud-footnote">{hasPosition && position ? `${new Date(position.observed_at).toLocaleString("es")} · ` : ""}{hasZone ? "Zona verde: perímetro configurado o en edición. Círculo celeste: precisión GPS, no confirma entrada ni salida." : "El círculo representa la precisión GPS, no una geocerca."}</p>
    </>}
  </section>;
}
