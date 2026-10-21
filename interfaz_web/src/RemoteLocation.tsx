import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";

export type RemotePosition = { latitude: number; longitude: number; accuracy_m: number; observed_at: string };
export function RemoteLocation({ position, clock }: { position: RemotePosition | null; clock: number }) {
  const element = useRef<HTMLDivElement>(null);
  const age = position ? (clock - Date.parse(position.observed_at)) / 1000 : Infinity;
  const fresh = Number.isFinite(age) && age >= -30 && age <= 90;
  useEffect(() => {
    if (!element.current || !position || !Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) return;
    const center: L.LatLngExpression = [position.latitude, position.longitude];
    const map = L.map(element.current, { scrollWheelZoom: false }).setView(center, 17);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>', maxZoom: 20,
    }).addTo(map);
    L.circleMarker(center, { radius: 8, color: fresh ? "#0d9488" : "#64748b", fillOpacity: 1 }).addTo(map);
    L.circle(center, { radius: position.accuracy_m, color: "#0d9488", fillOpacity: .08, weight: 1 }).addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(element.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [position, fresh]);
  return <section className="cloud-location" aria-labelledby="cloud-location-title">
    <div className="cloud-section-title"><MapPin size={19} /><h3 id="cloud-location-title">Ubicación del celular</h3></div>
    {!position ? <p className="cloud-footnote">Sin ubicación recibida. El celular puede compartir GPS sin cinturón, usando Wi-Fi o datos móviles.</p> : <>
      <p className={fresh ? "cloud-signal fresh" : "cloud-warning"}>{fresh ? "Posición reciente" : "Última posición conocida, no actual"} · precisión ±{Math.round(position.accuracy_m)} m</p>
      <div ref={element} className="cloud-location-map" aria-label="Mapa de la última ubicación del celular" />
      <p className="cloud-footnote">{new Date(position.observed_at).toLocaleString("es")} · El círculo representa la precisión GPS, no una geocerca.</p>
    </>}
  </section>;
}
