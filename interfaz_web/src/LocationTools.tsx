import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock3, Link2, Mail, MapPin, Pause, QrCode, RefreshCw, Send, ShieldCheck, Unlink, X } from "lucide-react";
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
  evaluation?: { radius_m: number; distance_min_m: number; distance_max_m: number; samples: number; remaining_seconds: number | null; candidate: string | null; maximum_accuracy_m: number } | null;
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

export function locationExplanation(snapshot: LocationSnapshot | null) {
  const evaluation = snapshot?.evaluation;
  if (!evaluation) return "Aún no hay una evaluación disponible.";
  if (snapshot?.status === "stale") return "No llegan posiciones recientes. No se puede confirmar si permanece en la zona.";
  if (snapshot?.status === "imprecise") return `El GPS supera el límite de ±${evaluation.maximum_accuracy_m} m. No se confirma una entrada ni una salida.`;
  const interval = `${evaluation.distance_min_m.toFixed(1)}–${evaluation.distance_max_m.toFixed(1)} m`;
  if (snapshot?.status === "uncertain") return `Distancia estimada con incertidumbre: ${interval}; el intervalo cruza el límite de ${evaluation.radius_m} m.`;
  if (snapshot?.status === "pending") return `${evaluation.candidate === "outside" ? "Posible salida" : "Posible entrada"}: ${evaluation.samples} lectura(s), ${Math.ceil(evaluation.remaining_seconds ?? 0)} s de permanencia pendientes. Intervalo: ${interval}.`;
  return `Intervalo estimado: ${interval} desde el centro. Radio guardado: ${evaluation.radius_m} m.`;
}

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
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const operation = useRef(0);
  const [confirmRenew, setConfirmRenew] = useState(false);
  const [network, setNetwork] = useState<{ url: string; port: number; addresses: string[] } | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState("");
  useEffect(() => {
    operation.current += 1;
    setQr(""); setMessage(""); setBusy(false); setConfirmRenew(false);
    return () => { operation.current += 1; };
  }, [residentId]);
  useEffect(() => {
    let disposed = false;
    jsonRequest("/api/network-info").then(data => { if (!disposed) setNetwork(data); }).catch(() => {});
    return () => { disposed = true; };
  }, []);
  async function pair() {
    const requestId = ++operation.current;
    setBusy(true); setQr(""); setMessage("");
    try {
      if (window.location.protocol !== "https:") throw new Error("Inicia el modo HTTPS para vincular un celular");
      const network = await jsonRequest("/api/network-info");
      if (requestId !== operation.current) return;
      const url = new URL("/compartir-ubicacion", selectedOrigin || network.url);
      if (!network.lan_available || url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
        throw new Error("El celular no puede acceder a este modo. Detén el servidor desde SFA Asistencia y activa Celular y ubicación: HTTPS en red local.");
      }
      const result = await jsonRequest(`/api/residents/${residentId}/location-device`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replace_existing: confirmRenew }) });
      url.hash = new URLSearchParams({ token: result.token }).toString();
      const image = await QRCode.toDataURL(url.href, { width: 224, margin: 4, errorCorrectionLevel: "M" });
      if (requestId !== operation.current) return;
      setQr(image);
      setConfirmRenew(false);
      setMessageKind("success");
      setMessage("Vínculo nuevo creado; el anterior dejó de funcionar");
      window.dispatchEvent(new Event("sfa-location-refresh"));
    } catch (error) { if (requestId === operation.current) { setMessageKind("error"); setMessage(error instanceof Error ? error.message : "No se pudo vincular"); } }
    finally { if (requestId === operation.current) setBusy(false); }
  }
  async function revoke() {
    setBusy(true);
    try {
      await jsonRequest(`/api/residents/${residentId}/location-device`, { method: "DELETE" });
      setQr(""); setMessageKind("success"); setMessage("Vínculo revocado");
      window.dispatchEvent(new Event("sfa-location-refresh"));
    } catch (error) { setMessageKind("error"); setMessage(error instanceof Error ? error.message : "No se pudo desvincular"); }
    finally { setBusy(false); }
  }
  const position = snapshot?.position;
  return <section className="geo-tracking" aria-label="Seguimiento del residente">
    <div className={`geo-tracking-status${["outside", "stale", "imprecise", "error"].includes(snapshot?.status || "") ? " is-warning" : ""}`}><MapPin size={22} /><div>
      <strong>{locationLabel(snapshot?.status || "no_fix")}</strong>
      {position && <p>Precisión ±{Math.round(position.accuracy_m)} m · {Math.round(snapshot?.age_seconds || 0)} s desde la lectura · {Math.round(position.distance_m)} m del centro</p>}
      {snapshot?.evaluation && <p className="geo-evaluation">{locationExplanation(snapshot)}</p>}
    </div><span className="care-status">{snapshot?.paired ? "Celular vinculado" : "Sin vínculo"}</span></div>
    {network && network.addresses.length > 1 && <label className="geo-network">Red del celular<select value={selectedOrigin || network.url} onChange={event => { setSelectedOrigin(event.target.value); setQr(""); }}>{network.addresses.map(address => <option key={address} value={`${window.location.protocol}//${address}:${network.port}`}>{address.startsWith("192.168.137.") ? "Hotspot de Windows" : "Red local"} · {address}</option>)}</select></label>}
    <div className="geo-actions">
      <button className="resident-button link-resident" disabled={!residentId || busy} onClick={() => { if (snapshot?.paired || qr) setConfirmRenew(true); else void pair(); }}><QrCode size={17} />{busy ? "Procesando…" : snapshot?.paired || qr ? "Reemplazar vínculo del celular" : "Vincular celular por QR"}</button>
      <button className="resident-button" disabled={!snapshot?.paired || busy} onClick={revoke}><Unlink size={17} />Desvincular</button>
    </div>
    {confirmRenew && <div className="geo-renew-confirm" role="group" aria-label="Confirmar reemplazo del vínculo">
      <AlertTriangle size={20} /><div><strong>¿Reemplazar el vínculo actual?</strong><p>El celular dejará de enviar ubicación hasta que escanee el nuevo QR.</p></div>
      <div className="geo-renew-actions"><button type="button" disabled={busy} onClick={() => setConfirmRenew(false)}>Cancelar</button><button type="button" disabled={busy} onClick={() => void pair()}>Reemplazar vínculo</button></div>
    </div>}
    {message && <div role={messageKind === "error" ? "alert" : "status"} className={`geo-feedback ${messageKind}`}>
      {messageKind === "error" ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}<span>{message}</span>
    </div>}
    {qr && <div className="geo-support-grid">
      <section className="geo-pairing" aria-label="Vínculo privado del celular">
        <div className="geo-section-heading"><QrCode size={18} /><h3>Vínculo del celular</h3><button type="button" className="geo-dismiss" aria-label="Ocultar código QR" title="Ocultar código QR, sin desvincular el celular" onClick={() => setQr("")}><X size={18} /></button></div>
        <div className="geo-pairing-body"><img src={qr} width={224} height={224} alt="QR privado para compartir ubicación" />
          <div className="geo-pairing-meta"><span className="geo-private-label"><ShieldCheck size={16} />Acceso privado</span><strong>Ubicación del residente</strong><span>Red local · HTTPS</span><p>El vínculo anterior ya no es válido.</p></div>
        </div>
      </section>
    </div>}
  </section>;
}

export function LocationHistory({ events }: { events: LocationSnapshot["events"] }) {
  if (!events.length) return null;
  return <section className="geo-history" aria-label="Actividad reciente de ubicación">
        <div className="geo-section-heading"><Clock3 size={18} /><h3>Actividad reciente</h3><span className="geo-history-count">Últimos {Math.min(events.length, 4)}</span></div>
        <ol className="geo-event-list">{events.slice(0, 4).map(event => {
          const warning = event.event_type === "GEOCERCA_SALIDA" || event.event_type === "UBICACION_PERDIDA";
          return <li key={event.id} className={warning ? "is-warning" : ""}>
            <span className="geo-event-icon">{warning ? <AlertTriangle size={16} /> : <MapPin size={16} />}</span>
            <span className="geo-event-detail">{event.detail}</span><time dateTime={event.received_at} title={new Date(event.received_at).toLocaleString("es")}>{new Date(event.received_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
          </li>;
        })}</ol>
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
      } catch (error) { if (!disposed) {
        const revoked = error instanceof Error && /revocado|no válido/i.test(error.message);
        setStatus(revoked ? "Este vínculo fue reemplazado, revocado o no corresponde a este servidor. Escanea el último QR del residente." : error instanceof Error ? error.message : "Sin comunicación; se reintentará");
        if (revoked) setRunning(false);
      } }
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
