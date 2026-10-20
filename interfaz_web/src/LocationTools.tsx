import { useEffect, useRef, useState } from "react";
import { Bell, Link2, Mail, MapPin, Pause, RefreshCw, Send, Unlink } from "lucide-react";
import QRCode from "qrcode";

export type LocationSnapshot = {
  resident_id: number;
  paired: boolean;
  status: string;
  age_seconds: number | null;
  position: null | {
    latitude: number; longitude: number; accuracy_m: number;
    distance_m: number; observed_at: string; stable_state: string;
  };
  events: { id: number; event_type: string; detail: string; received_at: string }[];
};

const labels: Record<string, string> = {
  no_fix: "Sin posición recibida", stale: "Ubicación desactualizada",
  inside: "Dentro de la zona", outside: "Fuera de la zona",
  pending: "Confirmando posición", uncertain: "Posición próxima al límite",
  imprecise: "Precisión insuficiente", zone_changed: "Zona modificada: esperando lectura",
  awaiting_device: "Esperando al nuevo celular", unlinked: "Celular desvinculado",
  error: "No se pudo consultar la ubicación",
};
export const locationLabel = (status: string) => labels[status] || "Estado no disponible";

async function jsonRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo completar la operación");
  return data;
}

export function useResidentLocation(id?: number) {
  const [current, setCurrent] = useState<{ id: number; value: LocationSnapshot } | null>(null);
  useEffect(() => {
    if (!id) return;
    let disposed = false;
    const reload = async () => {
      try {
        const value = await jsonRequest(`/api/residents/${id}/location`);
        if (!disposed) setCurrent({ id, value });
      } catch {
        if (!disposed) setCurrent({ id, value: { resident_id: id, paired: false, status: "error", age_seconds: null, position: null, events: [] } });
      }
    };
    void reload();
    const interval = window.setInterval(reload, 5000);
    window.addEventListener("sfa-location-refresh", reload);
    return () => { disposed = true; clearInterval(interval); window.removeEventListener("sfa-location-refresh", reload); };
  }, [id]);
  return current && current.id === id ? current.value : null;
}

export function showBrowserAlert(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body, tag: "sfa-care-alert" }); } catch { /* Not available in every mobile browser. */ }
  }
}

export function LocationPanel({ residentId, snapshot }: { residentId?: number; snapshot: LocationSnapshot | null }) {
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [network, setNetwork] = useState<{ url: string; port: number; addresses: string[] } | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState("");
  useEffect(() => {
    let disposed = false;
    jsonRequest("/api/network-info").then(data => { if (!disposed) setNetwork(data); }).catch(() => {});
    return () => { disposed = true; };
  }, []);
  async function pair() {
    setBusy(true); setQr(""); setMessage("");
    try {
      if (window.location.protocol !== "https:") throw new Error("Inicia el modo HTTPS para vincular un celular");
      const network = await jsonRequest("/api/network-info");
      const result = await jsonRequest(`/api/residents/${residentId}/location-device`, { method: "POST" });
      const url = new URL("/compartir-ubicacion", selectedOrigin || network.url);
      url.hash = new URLSearchParams({ token: result.token }).toString();
      setQr(await QRCode.toDataURL(url.href, { width: 224, margin: 4, errorCorrectionLevel: "M" }));
      setMessage("Vínculo nuevo creado; el anterior dejó de funcionar");
      window.dispatchEvent(new Event("sfa-location-refresh"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo vincular"); }
    finally { setBusy(false); }
  }
  async function revoke() {
    setBusy(true);
    try {
      await jsonRequest(`/api/residents/${residentId}/location-device`, { method: "DELETE" });
      setQr(""); setMessage("Vínculo revocado");
      window.dispatchEvent(new Event("sfa-location-refresh"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo desvincular"); }
    finally { setBusy(false); }
  }
  const position = snapshot?.position;
  return <section className="geo-tracking" aria-label="Seguimiento del residente">
    <div className="geo-tracking-status"><MapPin size={22} /><div>
      <strong>{locationLabel(snapshot?.status || "no_fix")}</strong>
      {position && <p>Precisión ±{Math.round(position.accuracy_m)} m · {Math.round(snapshot?.age_seconds || 0)} s desde la lectura · {Math.round(position.distance_m)} m del centro</p>}
    </div><span className="care-status">{snapshot?.paired ? "Celular vinculado" : "Sin vínculo"}</span></div>
    {network && network.addresses.length > 1 && <label className="geo-network">Red del celular<select value={selectedOrigin || network.url} onChange={event => { setSelectedOrigin(event.target.value); setQr(""); }}>{network.addresses.map(address => <option key={address} value={`${window.location.protocol}//${address}:${network.port}`}>{address.startsWith("192.168.137.") ? "Hotspot de Windows" : "Red local"} · {address}</option>)}</select></label>}
    <div className="geo-actions">
      <button className="resident-button link-resident" disabled={!residentId || busy} onClick={pair}><Link2 size={17} />{busy ? "Procesando…" : "Vincular celular por QR"}</button>
      <button className="resident-button" disabled={!snapshot?.paired || busy} onClick={revoke}><Unlink size={17} />Desvincular</button>
    </div>
    {message && <p role="status" className="geo-message">{message}</p>}
    {qr && <div className="geo-pairing"><img src={qr} width={224} height={224} alt="QR privado para compartir ubicación" /><p>Vínculo privado de ubicación</p></div>}
    {!!snapshot?.events.length && <div className="geo-event-list">{snapshot.events.slice(0, 4).map(event => <div key={event.id}><span>{event.detail}</span><time dateTime={event.received_at}>{new Date(event.received_at).toLocaleTimeString("es")}</time></div>)}</div>}
  </section>;
}

export function EmailSettings() {
  const [status, setStatus] = useState<{ configured: boolean; deliveries: { id: number; status: string; created_at: string; event_type: string }[] } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = async () => {
    try { setStatus(await jsonRequest("/api/notifications/email")); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo consultar correo"); }
  };
  useEffect(() => { void reload(); }, []);
  async function test() {
    setBusy(true);
    try {
      const result = await jsonRequest("/api/notifications/test-email", { method: "POST" });
      setMessage(result.sent ? "Aceptado por SMTP; comprueba el buzón y spam" : "No se confirmó el envío. Revisa la configuración SMTP");
      await reload();
    } catch { setMessage("No se pudo completar la prueba"); }
    finally { setBusy(false); }
  }
  async function browser() {
    if (!("Notification" in window) || !window.isSecureContext) { setMessage("Los avisos del navegador requieren HTTPS y soporte del navegador"); return; }
    const permission = await Notification.requestPermission();
    setMessage(permission === "granted" ? "Avisos habilitados mientras el panel permanezca abierto" : "Permiso de avisos no concedido");
  }
  return <section className="geo-email-section">
    <div className="geo-tracking-status"><Mail size={23} /><div><h3>Correo y avisos del navegador</h3><p>{status?.configured ? "SMTP configurado" : "SMTP sin configurar"}</p></div></div>
    <div className="geo-actions"><button className="resident-button link-resident" disabled={!status?.configured || busy} onClick={test}><Send size={17} />{busy ? "Enviando…" : "Probar correo"}</button><button className="resident-button" onClick={browser}><Bell size={17} />Permitir avisos</button><button className="resident-button" onClick={reload} title="Actualizar estado SMTP" aria-label="Actualizar estado SMTP"><RefreshCw size={17} /></button></div>
    {message && <p role="status" className="geo-message">{message}</p>}
    {!!status?.deliveries.length && <ul className="geo-deliveries">{status.deliveries.slice(0, 5).map(row => <li key={row.id}><span>{row.event_type}</span><strong>{row.status === "accepted" ? "Aceptado por SMTP" : "Envío no confirmado"}</strong><time>{new Date(row.created_at).toLocaleTimeString("es")}</time></li>)}</ul>}
  </section>;
}

export function PhoneLocationSender() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ubicación no compartida");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const pending = useRef<GeolocationPosition | null>(null);
  useEffect(() => { window.history.replaceState(null, "", window.location.pathname); }, []);
  useEffect(() => {
    if (!running) return;
    let disposed = false, sending = false, sentTimestamp = 0;
    const send = async () => {
      const fix = pending.current;
      if (sending || !fix || fix.timestamp <= sentTimestamp || disposed) return;
      sending = true;
      try {
        await jsonRequest("/api/location", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy_m: fix.coords.accuracy, observed_at: new Date(fix.timestamp).toISOString() }) });
        sentTimestamp = fix.timestamp;
        if (!disposed) { setStatus("Ubicación enviada"); setLastSent(new Date().toLocaleTimeString("es")); }
      } catch (error) { if (!disposed) { setStatus(error instanceof Error ? error.message : "Sin comunicación; se reintentará"); if (error instanceof Error && /revocado|no válido/i.test(error.message)) setRunning(false); } }
      finally { sending = false; }
    };
    const watch = navigator.geolocation.watchPosition(position => {
      if (!disposed) { pending.current = position; setAccuracy(position.coords.accuracy); }
    }, error => { if (!disposed) { setStatus(error.code === 1 ? "Permiso de ubicación denegado" : "No se puede obtener una posición"); if (error.code === 1) setRunning(false); } }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    const timer = window.setInterval(send, 10000);
    return () => { disposed = true; clearInterval(timer); navigator.geolocation.clearWatch(watch); pending.current = null; };
  }, [running, token]);
  const available = window.isSecureContext && "geolocation" in navigator && Boolean(token);
  return <main className="phone-location-page"><header><MapPin size={30} /><span>SFA Asistencia</span></header>
    <section><h1>Compartir mi ubicación</h1><p role="status">{!token ? "Vínculo ausente: escanea un QR nuevo" : !window.isSecureContext ? "Se requiere una conexión HTTPS de confianza" : status}</p>
      <dl><div><dt>Precisión</dt><dd>{accuracy === null ? "Sin lectura" : `±${Math.round(accuracy)} m`}</dd></div><div><dt>Último envío</dt><dd>{lastSent || "Sin envíos"}</dd></div></dl>
      <button className="care-action" disabled={!available} onClick={() => { setRunning(!running); setStatus(running ? "Ubicación detenida" : "Obteniendo posición…"); }}>{running ? <Pause size={20} /> : <MapPin size={20} />}{running ? "Dejar de compartir" : "Comenzar a compartir"}</button>
      <p className="phone-location-limit">Modo de demostración con la página abierta. El navegador puede detener las lecturas al bloquear la pantalla.</p>
    </section></main>;
}
