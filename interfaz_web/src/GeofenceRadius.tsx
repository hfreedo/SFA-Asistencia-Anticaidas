import { useId } from "react";
import { AlertTriangle } from "lucide-react";

export function GeofenceRadius({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="geofence-radius-control">
    <label id={`${id}-label`} htmlFor={id}>Radio de la zona</label>
    <div className="radius-options" role="group" aria-labelledby={`${id}-label`}>
      {[5, 10, 25, 50, 100, 200, 500].map(radius => <button type="button" key={radius} aria-pressed={value === radius} onClick={() => onChange(radius)}>{radius} m</button>)}
    </div>
    <div className="geofence-custom-radius"><label htmlFor={id}>Otro radio</label><input id={id} type="number" min={5} max={100000} step={1} required value={Number.isFinite(value) ? value : ""} onChange={e => onChange(e.target.valueAsNumber)} /><span>metros</span></div>
    {value >= 5 && value < 25 && <p className="geofence-precision-note"><AlertTriangle size={16} /><span>Radio de demostración. El intervalo de incertidumbre debe quedar completamente fuera o dentro de la zona durante al menos 10 segundos.</span></p>}
  </div>;
}
