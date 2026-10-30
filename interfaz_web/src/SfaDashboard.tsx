import L from "leaflet";
import QRCode from "qrcode";
import { GeofenceRadius } from "./GeofenceRadius";
import { EmailSettings, LocationHistory, LocationPanel, locationLabel, showBrowserAlert, useResidentLocation, type LocationSnapshot } from "./LocationTools";
import { LocalRemoteLocation } from "./LocalRemoteLocation";
import { LocalIncidentPanel } from "./LocalIncidentPanel";
import { IncidentNavIndicator } from "./IncidentNavIndicator";
import type { IncidentAttention, IncidentFeed } from "./IncidentWorkspace";
import { CareActivity, CareLocationSummary, CareSignal, mergeCareActivity, useRemoteHomePosition, type LocationSource } from "./CareOverview";
import { PushTestSettings } from "./PushTestSettings";
import { Preparation, type SettingsEntry } from "./Preparation";
import { PreparationIndicator, usePreparationStatus, type PreparationCheck } from "./preparationStatus";
import { LocalPersonAccess } from "./LocalPersonAccess";
import { icons } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type View = "home" | "map" | "settings" | "setup" | "people";
type RiskState =
  | "NORMAL"
  | "EVENTO_INERCIAL"
  | "POSIBLE_CAIDA"
  | "CAIDA_CONFIRMADA"
  | "ALERTA_SILENCIADA";

type Telemetry = {
  type: "telemetry";
  state: RiskState;
  ax: number | null;
  ay: number | null;
  az: number | null;
  accel_g: number | null;
  tilt_deg: number | null;
  motion: number | null;
  fall_count: number | null;
  received_at: string;
  simulated?: boolean;
  battery_percent?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_m?: number | null;
};

type SystemEvent = { id: string; type: string; detail: string; at: string; residentId?: number };

export function isNewConfirmedFall(previous: Telemetry | null, next: Telemetry) {
  return next.state === "CAIDA_CONFIRMADA" &&
    (previous?.state !== "CAIDA_CONFIRMADA" || previous.fall_count !== next.fall_count);
}
type Port = { device: string; description: string };

type ResidentProfile = {
  id?: number;
  full_name: string;
  room: string;
  phone: string;
  emergency_phone: string;
  medical_notes: string;
  photo_url?: string | null;
  is_active?: number;
};

type GeofenceConfig = {
  home_lat: number;
  home_lng: number;
  radius_m: number;
  address_name: string;
};

type NotificationConfig = {
  sound_enabled: boolean;
  telegram_token: string;
  telegram_chat_id: string;
  notify_fall: boolean;
  notify_sos: boolean;
  notify_battery: boolean;
  notify_first_motion: boolean;
  notify_geofence: boolean;
};

type NetworkInfo = {
  local_ip: string;
  port: number;
  url: string;
  lan_available?: boolean;
  addresses?: string[];
};

const STATE_TITLES: Record<RiskState, string> = {
  NORMAL: "estable",
  EVENTO_INERCIAL: "en movimiento brusco",
  POSIBLE_CAIDA: "en posible caída",
  CAIDA_CONFIRMADA: "en caída confirmada",
  ALERTA_SILENCIADA: "en alerta silenciada",
};

// Generador de audio de emergencia con Web Audio API
class EmergencyAlarmAudio {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private intervalId: number | null = null;

  start() {
    if (this.ctx) { void this.ctx.resume().catch(() => {}); return; }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
      void this.ctx.resume().catch(() => {});
      this.gain = this.ctx.createGain();
      this.gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      this.gain.connect(this.ctx.destination);

      this.osc = this.ctx.createOscillator();
      this.osc.type = "sawtooth";
      this.osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      this.osc.connect(this.gain);
      this.osc.start();

      let toggle = false;
      this.intervalId = window.setInterval(() => {
        if (!this.osc || !this.ctx) return;
        toggle = !toggle;
        this.osc.frequency.setValueAtTime(
          toggle ? 980 : 660,
          this.ctx.currentTime,
        );
      }, 350);
    } catch {}
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.osc) {
      try {
        this.osc.stop();
      } catch {}
      this.osc.disconnect();
      this.osc = null;
    }
    if (this.gain) {
      this.gain.disconnect();
      this.gain = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
    }
  }
}

const emergencyAlarm = new EmergencyAlarmAudio();

type ToastMessage = { message: string; tone: "success" | "error" | "info"; id: number };
function notify(message: string, tone: ToastMessage["tone"] = "success") {
  window.dispatchEvent(new CustomEvent<ToastMessage>("sfa-toast", {
    detail: { message, tone, id: performance.now() },
  }));
}
export function ToastHost() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  useEffect(() => {
    const receive = (event: Event) => setToast((event as CustomEvent<ToastMessage>).detail);
    window.addEventListener("sfa-toast", receive);
    return () => window.removeEventListener("sfa-toast", receive);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.tone === "error" ? 7000 : 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return <div className="toast-region" aria-live="polite" aria-atomic="true">
    {toast && <div key={toast.id} className={`sfa-toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
      <span className="toast-symbol"><Icon name={toast.tone === "error" ? "circle-alert" : toast.tone === "info" ? "info" : "circle-check"} size={21} /></span>
      <p>{toast.message}</p>
      <button type="button" aria-label="Cerrar notificación" title="Cerrar" onClick={() => setToast(null)}><Icon name="x" size={17} /></button>
    </div>}
  </div>;
}
async function actionRequest<T = Record<string, unknown>>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo completar la acción.");
  return data as T;
}

function pascalCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Component = icons[pascalCase(name) as keyof typeof icons] || icons.Circle;
  return <Component size={size} className={`shrink-0 ${className}`} aria-hidden="true" />;
}

function isRealPayload(payload: {
  simulated?: boolean;
  detail?: string;
  raw?: string;
}) {
  const content = `${payload.detail ?? ""} ${payload.raw ?? ""}`.toLowerCase();
  return !payload.simulated && !content.includes("simulacion");
}

export function SfaDashboardApp() {
  const preparationCheck = usePreparationStatus();
  const [focusPreparationAccess, setFocusPreparationAccess] = useState(false);
  const openPreparationAccess = () => { setFocusPreparationAccess(true); setView("setup"); };
  const [view, setView] = useState<View>(() => window.location.hash === "#preparacion" ? "setup" : "home");
  const [settingsEntry, setSettingsEntry] = useState<SettingsEntry>("residents");
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectedPort, setConnectedPort] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [firstMotion, setFirstMotion] = useState<Date | null>(null);
  const [emergencyStartedAt, setEmergencyStartedAt] = useState<Date | null>(
    null,
  );
  const lastFallReading = useRef<Telemetry | null>(null);
  const [confirmingAttention, setConfirmingAttention] = useState(false);
  const [attentionError, setAttentionError] = useState("");

  // Historial de aceleración para la línea de pulso en vivo
  const [accelHistory, setAccelHistory] = useState<number[]>(
    () => Array.from({ length: 48 }, () => 1.0),
  );

  // Lista de residentes registrados y residente activo
  const [residents, setResidents] = useState<ResidentProfile[]>([]);
  const [profile, setProfile] = useState<ResidentProfile | null>(null);
  const [cloudAttention,setCloudAttention]=useState<IncidentAttention>({pending:0,followup:false});
  const [cloudFeed,setCloudFeed]=useState<{id:number;value:IncidentFeed}|null>(null);
  const reportFeed=useCallback((id:number,value:IncidentFeed)=>setCloudFeed({id,value}),[]);
  const currentFeed = cloudFeed?.id === profile?.id ? cloudFeed?.value ?? null : null;
  const [locationSources,setLocationSources]=useState<Record<number,LocationSource>>({});
  const locationSource = profile?.id ? locationSources[profile.id] ?? "remote" : "remote";
  const chooseLocationSource = (source:LocationSource) => { const id=profile?.id; if (id) setLocationSources(current=>({...current,[id]:source})); };
  const reportAttention=useCallback((value:IncidentAttention)=>setCloudAttention(value),[]);
  useEffect(()=>setCloudAttention({pending:0,followup:false}),[profile?.id]);
  useEffect(()=>{ setFirstMotion(null); setTelemetry(null); lastFallReading.current=null; },[profile?.id]);
  const locationSnapshot = useResidentLocation(profile?.id);
  const [mutedGeofence, setMutedGeofence] = useState("");
  const geofenceIncident = locationSnapshot?.status === "outside" ? `${profile?.id}:${locationSnapshot.events.find(event => event.event_type === "GEOCERCA_SALIDA")?.id ?? "outside"}` : "";

  const [geofence, setGeofence] = useState<GeofenceConfig>({
    home_lat: -34.6037,
    home_lng: -58.3816,
    radius_m: 200,
    address_name: "Residencia / Hogar Central",
  });

  const [notificationConfig, setNotificationConfig] =
    useState<NotificationConfig>({
      sound_enabled: true,
      telegram_token: "",
      telegram_chat_id: "",
      notify_fall: true,
      notify_sos: true,
      notify_battery: true,
      notify_first_motion: true,
      notify_geofence: true,
    });

  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  // Cargar residentes
  const loadResidents = useCallback(async () => {
    try {
      const res = await fetch("/api/residents");
      if (res.ok) {
        const list: ResidentProfile[] = await res.json();
        setResidents(list);
        const active = list.find((r) => r.is_active === 1) || list[0] || null;
        setProfile(active);
      }
    } catch {}
  }, []);

  const selectResident = async (id: number) => {
    try {
      await actionRequest(`/api/residents/${id}/activate`, { method: "POST" });
      await loadResidents(); notify("Residente vinculado");
    } catch { notify("No se pudo vincular el residente.", "error"); }
  };
  const deleteResident = async (id: number) => {
    try {
      await actionRequest(`/api/residents/${id}`, { method: "DELETE" });
      await loadResidents(); notify("Residente eliminado");
    } catch { notify("No se pudo eliminar el residente.", "error"); }
  };
  const createResident = async (newResident: ResidentProfile) => {
    try {
      await actionRequest("/api/residents", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newResident),
      });
      await loadResidents(); notify("Residente añadido");
    } catch (e) { notify("No se pudo registrar el residente.", "error"); throw e; }
  };

  useEffect(() => {
    loadResidents();

    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setNotificationConfig(data);
      })
      .catch(() => {});

    fetch("/api/network-info")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.url) setNetworkInfo(data);
      })
      .catch(() => {});
  }, [loadResidents]);

  useEffect(() => {
    if (!profile?.id) return;
    let disposed = false;
    fetch(`/api/residents/${profile.id}/geofence`).then(res => res.ok ? res.json() : null).then(data => {
      if (data && !disposed) setGeofence(data);
    }).catch(() => {});
    return () => { disposed = true; };
  }, [profile?.id]);

  const addEvent = useCallback((type: string, detail: string, at: string, residentId?: number) => {
    setEvents((current) =>
      [
        { id: `${type}-${at}-${Math.random()}`, type, detail, at, residentId },
        ...current,
      ].slice(0, 30),
    );
  }, []);

  const applyTelemetry = useCallback((payload: Telemetry) => {
    if (!isRealPayload(payload)) return;
    setTelemetry(payload);

    // Actualizar historial del acelerómetro
    const val = payload.accel_g != null ? payload.accel_g : 1.0;
    setAccelHistory((prev) => [...prev.slice(1), val]);

    if ((payload.motion ?? 0) >= 0.08)
      setFirstMotion((current) => current ?? new Date(payload.received_at));
    const previous = lastFallReading.current;
    lastFallReading.current = payload;
    if (isNewConfirmedFall(previous, payload))
      setEmergencyStartedAt(
        (current) => current ?? new Date(payload.received_at),
      );
  }, []);

  // Alarma sonora
  useEffect(() => {
    if ((emergencyStartedAt || (geofenceIncident && mutedGeofence !== geofenceIncident && notificationConfig.notify_geofence)) && notificationConfig.sound_enabled) {
      emergencyAlarm.start();
    } else {
      emergencyAlarm.stop();
    }
    return () => emergencyAlarm.stop();
  }, [emergencyStartedAt, notificationConfig.sound_enabled, notificationConfig.notify_geofence, geofenceIncident, mutedGeofence]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryId: number | undefined;
    let disposed = false;
    const open = () => {
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${location.host}/ws`);
      socket.addEventListener("message", (message) => {
        const payload = JSON.parse(message.data);
        if (payload.type === "status") {
          setConnected(Boolean(payload.connected));
          setConnectedPort(payload.port ?? null);
          setConnectionError(payload.error ?? null);
          if (payload.connected && payload.latest)
            applyTelemetry(payload.latest);
        } else if (payload.type === "telemetry") {
          applyTelemetry(payload);
        } else if (payload.type === "location") {
          window.dispatchEvent(new Event("sfa-location-refresh"));
        } else if (payload.type === "event" && isRealPayload(payload)) {
          if (payload.resident_id && payload.resident_id !== profile?.id) return;
          addEvent(
            payload.event_type,
            payload.detail || "Evento registrado",
            payload.received_at || new Date().toISOString(),
            payload.resident_id,
          );
          if (payload.operator_action && ["ALERTA_ATENDIDA", "FALSA_ALARMA"].includes(payload.event_type)) {
            setEmergencyStartedAt(null);
            setAttentionError("");
          }
          if (payload.event_type === "CAIDA_CONFIRMADA")
            setEmergencyStartedAt(
              (current) => current ?? new Date(payload.received_at),
            );
          if (["GEOCERCA_SALIDA", "GEOCERCA_REINGRESO", "UBICACION_PERDIDA"].includes(payload.event_type)) {
            notify(payload.detail, payload.event_type === "GEOCERCA_REINGRESO" ? "success" : "error");
            showBrowserAlert("SFA Asistencia", payload.detail);
            window.dispatchEvent(new Event("sfa-location-refresh"));
          } else if (payload.event_type === "CAIDA_CONFIRMADA") {
            showBrowserAlert("SFA Asistencia: caída detectada", payload.detail || "Requiere atención");
          }
        } else if (payload.type === "boot") {
          lastFallReading.current = null;
        } else if (payload.type === "serial_error") {
          setConnected(false);
          setConnectionError(payload.message);
        }
      });
      socket.addEventListener("close", () => {
        if (!disposed) retryId = window.setTimeout(open, 1500);
      });
    };
    open();
    return () => {
      disposed = true;
      if (retryId) window.clearTimeout(retryId);
      socket?.close();
    };
  }, [addEvent, applyTelemetry, profile?.id]);

  async function confirmAttention() {
    if (confirmingAttention) return;
    setConfirmingAttention(true);
    setAttentionError("");
    try {
      const response = await fetch("/api/alert-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attended" }),
      });
      const payload = await response.json();
      if (!response.ok || payload.type === "error") throw new Error(payload.detail || payload.message || "No se pudo confirmar la atencion");
      addEvent(
        "ALERTA_ATENDIDA",
        payload.detail ?? "Atención confirmada",
        payload.received_at ?? new Date().toISOString(),
      );
      emergencyAlarm.stop();
      setEmergencyStartedAt(null);
      setView("home");
    } catch (error) {
      setAttentionError(error instanceof Error ? error.message : "No se pudo confirmar la atencion. Vuelve a intentar.");
    } finally {
      setConfirmingAttention(false);
    }
  }

  if (emergencyStartedAt) {
    return (
      <FallAlertScreen
        profile={profile}
        startedAt={emergencyStartedAt}
        onConfirm={confirmAttention}
        confirming={confirmingAttention}
        error={attentionError}
      />
    );
  }

  return (
    <AppShell
      preparationCheck={preparationCheck}
      view={view}
      onViewChange={next => { setFocusPreparationAccess(false); if (next === "settings") setSettingsEntry("notifications"); setView(next); }}
      connected={connected}
      attention={{pending:cloudAttention.pending,followup:cloudAttention.followup || Boolean(geofenceIncident && notificationConfig.notify_geofence)}}
      residents={residents}
      activeProfile={profile}
      onSelectResident={selectResident}
      onOpenNewResidentModal={() => setView("people")}
    >
      {view === "home" && <ResidentIdentity profile={profile}/>}
      {view === "home" && profile?.id && preparationCheck.status?.session_active === false && <section className="care-connection-notice" role="status" aria-label="Conexión de esta PC"><Icon name="cloud-off" size={20}/><div><strong>Sesión de esta PC pausada</strong><p>Reanuda el acceso para consultar información por internet.</p></div><button className="resident-button" onClick={openPreparationAccess}>Revisar conexión<Icon name="arrow-right" size={17}/></button></section>}
      {view === "home" && geofenceIncident && notificationConfig.notify_geofence && <section className="geofence-incident" role="alert" aria-label="Alerta de salida de geocerca">
        <Icon name="map-pin-off" size={24} /><div><strong>{profile?.full_name || "Residente"} está fuera de la zona local</strong><p>Salida confirmada por el seguimiento local. Requiere comprobar su situación.</p></div>
        <button type="button" onClick={() => { chooseLocationSource("local"); setView("map"); }}><Icon name="map" size={17} />Ver ubicación</button>
        {notificationConfig.sound_enabled && <button type="button" onClick={() => { if (mutedGeofence === geofenceIncident) { setMutedGeofence(""); emergencyAlarm.start(); } else setMutedGeofence(geofenceIncident); }}><Icon name={mutedGeofence === geofenceIncident ? "volume-2" : "volume-x"} size={17} />{mutedGeofence === geofenceIncident ? "Activar sonido" : "Silenciar aviso"}</button>}
      </section>}
      <LocalIncidentPanel key={profile?.id} residentId={profile?.id} visible={view === "home"} connectionPaused={preparationCheck.status?.session_active === false} onAttentionChange={reportAttention} onSnapshotChange={reportFeed} onPrepare={openPreparationAccess}/>
      {view === "setup" && <Preparation profile={profile} connected={connected} check={preparationCheck} focusAccess={focusPreparationAccess}
        onSettings={tab => { setSettingsEntry(tab); setView(tab === "residents" ? "people" : "settings"); }}
        onMap={() => setView("map")} onMonitor={() => setView("home")} />}
      {view === "home" && (
        <HomeScreen
          connectionPaused={preparationCheck.status?.session_active === false}
          profile={profile}
          locationSnapshot={locationSnapshot}
          telemetry={telemetry}
          connected={connected}
          firstMotion={firstMotion}
          events={events}
          accelHistory={accelHistory}
          geofence={geofence}
          locationSource={locationSource}
          onLocationSourceChange={chooseLocationSource}
          remoteFeed={currentFeed}
          onOpenSettings={openPreparationAccess}
          onOpenDevice={() => { setSettingsEntry("hardware"); setView("settings"); }}
          onOpenMap={() => setView("map")}
        />
      )}
      {view === "map" && (
        <MapScreen
          geofence={geofence}
          profile={profile}
          locationSnapshot={locationSnapshot}
          onUpdateGeofence={(updated) => setGeofence(updated)}
          onPrepare={() => setView("setup")}
          source={locationSource}
          onSourceChange={chooseLocationSource}
        />
      )}
      {(view === "settings" || view === "people") && (
        <SettingsScreen
          key={view}
          peopleOnly={view === "people"}
          initialTab={view === "people" ? "residents" : settingsEntry}
          onPrepare={() => setView("setup")}
          onTriggerFallSimulation={() => setEmergencyStartedAt(new Date())}
          residents={residents}
          profile={profile}
          geofence={geofence}
          notificationConfig={notificationConfig}
          networkInfo={networkInfo}
          connected={connected}
          connectedPort={connectedPort}
          connectionError={connectionError}
          onSelectResident={selectResident}
          onCreateResident={createResident}
          onDeleteResident={deleteResident}
          onUpdateProfile={(updated) => {
            setProfile(updated);
            setResidents(current => current.map(r => r.id === updated.id ? updated : r));
          }}
          onPhotoChange={(id, url) => {
            setResidents(current => current.map(r => r.id === id ? { ...r, photo_url: url } : r));
            setProfile(current => current?.id === id ? { ...current, photo_url: url } : current);
          }}
          onOpenMap={() => setView("map")}
          onUpdateNotifications={(updated) => setNotificationConfig(updated)}
        />
      )}
    </AppShell>
  );
}

function AppShell({
  preparationCheck,
  view,
  attention,
  onViewChange,
  connected,
  residents,
  activeProfile,
  onSelectResident,
  onOpenNewResidentModal,
  children,
}: {
  preparationCheck: PreparationCheck;
  view: View;
  attention: IncidentAttention;
  onViewChange: (view: View) => void;
  connected: boolean;
  residents: ResidentProfile[];
  activeProfile: ResidentProfile | null;
  onSelectResident: (id: number) => void;
  onOpenNewResidentModal: () => void;
  children: React.ReactNode;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems: { id: View; icon: string; label: string }[] = [
    { id: "home", icon: "layout-dashboard", label: "Panel principal" },
    { id: "map", icon: "map-pin", label: "Ubicación" },
    { id: "people", icon: "users-round", label: "Personas" },
    { id: "setup", icon: "list-checks", label: "Preparación" },
    { id: "settings", icon: "settings-2", label: "Ajustes" },
  ];

  // Fecha y hora en vivo estilo editorial
  const [nowText, setNowText] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const day = now.toLocaleDateString("es-ES", { weekday: "short" }).toUpperCase();
      const date = now.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase();
      const time = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      setNowText(`${day} ${date} — ${time}`);
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F2EC] text-[#14201D] sfa-paper-texture flex flex-col font-sans selection:bg-[#0F766E]/20">
      {/* Sidebar Escritorio: Índice Editorial Suizo */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[#DED8CC] bg-[#F5F2EC] lg:flex lg:flex-col">
        {/* Cabecera del Sidebar */}
        <div className="sidebar-brand p-7 border-b border-[#DED8CC]">
          <div className="flex items-center gap-3">
            <div className="project-logo-frame">
              <img src="/static/assets/sfa-asistencia-logo.png" alt="Logo SFA Asistencia" className="project-logo" />
            </div>
            <div className="project-wordmark" aria-label="SFA Asistencia">
              <span className="project-wordmark-initials">SFA</span>
              <span className="project-wordmark-name">Asistencia</span>
            </div>
          </div>
        </div>

        {/* Índice Numerado */}
        <div className="py-6 flex-1 flex flex-col">
          <p className="sidebar-section-label px-7 pb-3">
            Tu espacio de cuidado
          </p>
          <nav className="divide-y divide-[#DED8CC]/60 border-y border-[#DED8CC]/60">
            {navItems.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onViewChange(item.id)}
                  className={`group relative flex w-full items-baseline justify-between px-7 py-4 text-left transition-all cursor-pointer ${
                    active ? "bg-[#FBFAF7]" : "hover:bg-[#EFECE6]/50"
                  }`}
                >
                  <div className="flex items-baseline gap-3">
                    <Icon name={item.icon} size={21} className={active ? "text-[#0F766E]" : "text-[#64748B]"} />
                    <span
                      className={`font-serif text-2xl transition-all ${
                        active
                          ? "italic text-[#14201D] font-normal"
                          : "text-[#55625E] group-hover:text-[#14201D] font-light"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  {item.id === "home" && <IncidentNavIndicator attention={attention}/>}
                  {item.id === "setup" && <PreparationIndicator check={preparationCheck} id={activeProfile?.id}/>}
                  {active && !(item.id === "home" && (attention.pending || attention.followup)) && (
                    <span className="size-1.5 rounded-full bg-[#0F766E]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Pie del Sidebar: Diagnóstico de Enlace */}
        <div className="p-6 border-t border-[#DED8CC] font-mono-data text-[11px] text-[#55625E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                connected ? "bg-[#2F8F5B]" : "bg-[#B7791F]"
              }`}
            />
            <div><p className="font-semibold">Perfil de cuidado</p><p>{activeProfile?.full_name || "Sin residente vinculado"}</p></div>
          </div>
        </div>
      </aside>

      {/* Contenido Principal */}
      <div className="sfa-shell-content pb-24 lg:pb-10 lg:pl-64 flex-1 flex flex-col">
        {/* Cabecera Limpia de Una Línea */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#DED8CC] bg-[#F5F2EC]/95 backdrop-blur-xs px-6 sm:px-10">
          <div className="min-w-0">
            <p className="care-eyebrow hidden sm:block">SFA · Plataforma de teleasistencia</p>
            <p className="font-semibold text-lg"><img src="/static/assets/sfa-asistencia-logo.png" alt="" className="mobile-project-logo lg:hidden" />{view === "people" ? "Personas y equipo" : view === "map" ? "Ubicación y geocerca" : view === "settings" ? "Ajustes de asistencia" : view === "setup" ? "Preparar la asistencia" : "Centro de monitoreo"}</p>
            <span className="sr-only">{nowText}</span>
          </div>

          <div className="flex items-center gap-3">
            {view !== "home" && <span className={`shell-connection ${connected ? "connected" : ""}`}><Icon name={connected ? "plug" : "unplug"} size={16} />{connected ? "Cinturón conectado" : "Cinturón no conectado"}</span>}
            {/* Selector de Residente */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-expanded={dropdownOpen}
                aria-controls="resident-picker-options"
                className="resident-picker-trigger flex items-center gap-2.5 px-3.5 py-1.5 transition cursor-pointer"
              >
                <Icon name="user-round" size={17} className="text-[#0F766E] shrink-0" />
                <span className="font-medium truncate max-w-[150px] sm:max-w-[200px]">
                  {activeProfile?.full_name ? (
                    <>
                      {activeProfile.full_name}{" "}
                      <span className="text-[#55625E] font-normal">
                        ({activeProfile.room})
                      </span>
                    </>
                  ) : (
                    "Seleccionar Residente"
                  )}
                </span>
                <Icon name="chevron-down" size={13} className="text-[#55625E]" />
              </button>

              {dropdownOpen && (
                <div id="resident-picker-options" className="resident-picker absolute right-0 mt-2 z-50">
                  <div className="px-3 py-1.5 border-b border-[#DED8CC]/60">
                    <p className="font-mono-data text-[10px] uppercase tracking-wider text-[#55625E]">
                      Residentes
                    </p>
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1 divide-y divide-[#DED8CC]/40">
                    {residents.map((r) => {
                      const isSelected = r.id === activeProfile?.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            if (r.id) onSelectResident(r.id);
                            setDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-xs transition cursor-pointer ${
                            isSelected
                              ? "bg-[#0F766E]/10 text-[#0F766E] font-bold"
                              : "hover:bg-[#EFECE6]/50 text-[#14201D]"
                          }`}
                        >
                          <span className="picker-avatar">{r.photo_url ? <img src={r.photo_url} alt="" /> : <Icon name="user-round" size={20} />}</span>
                          <div className="picker-details min-w-0">
                            <p className="font-medium truncate">{r.full_name}</p>
                            <p className="font-mono-data text-[10px] text-[#55625E]">
                              {r.room}
                            </p>
                          </div>
                          {isSelected && (
                            <Icon name="circle-check" size={18} className="text-[#0F766E] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="pt-2 border-t border-[#DED8CC]/60">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenNewResidentModal();
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#EFECE6] p-2 text-xs font-medium text-[#0F766E] hover:bg-[#0F766E]/10 transition cursor-pointer"
                    >
                      <Icon name="plus" size={13} />
                      <span>Registrar residente</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`sfa-workspace mx-auto w-full max-w-[1600px] p-6 sm:p-10 flex-1${view === "home" ? " home-composition" : ""}`}>
          {children}
        </main>
      </div>

      {/* Navegación Móvil Flotante */}
      <nav className="mobile-app-navigation fixed inset-x-4 bottom-4 z-30 flex items-center justify-around rounded-full border border-[#DED8CC] bg-[#14201D] text-white p-2.5 lg:hidden shadow-xl">
        {navItems.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              aria-current={active ? "page" : undefined}
              onClick={() => onViewChange(item.id)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition cursor-pointer ${
                active ? "bg-white text-[#14201D]" : "text-white/70"
              }`}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.id === "home" ? "Panel" : item.label}</span>
              {item.id === "home" && <IncidentNavIndicator attention={attention}/>}
              {item.id === "setup" && <PreparationIndicator check={preparationCheck} id={activeProfile?.id}/>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function ResidentIdentity({profile}:{profile:ResidentProfile|null}) {
  return <section aria-labelledby="resident-heading" className="focus-profile resident-identity">
    <div className="resident-avatar">{profile?.photo_url ? <img src={profile.photo_url} alt={`Foto de ${profile.full_name}`} /> : <Icon name="user-round" size={32}/>}</div>
    <div className="focus-identity"><h1 id="resident-heading" className="font-serif">{profile?.full_name || "Tu puesto de monitoreo"}</h1><p>{profile?.room || "Selecciona a la persona que vas a cuidar."}</p>{profile?.medical_notes && <p className="focus-care-note">Nota de cuidado: {profile.medical_notes}</p>}</div>
    {profile?.phone && <a href={`tel:${profile.phone.replace(/\s+/g, "")}`} className="resident-button link-resident"><Icon name="phone" size={17}/>Llamar a {profile.full_name.split(" ")[0]}</a>}
  </section>;
}

function HomeScreen({
  profile, telemetry, connected, firstMotion, events, accelHistory,
  onOpenMap, onOpenSettings, onOpenDevice, locationSnapshot, locationSource, onLocationSourceChange, remoteFeed, connectionPaused,
}: {
  profile: ResidentProfile | null;
  telemetry: Telemetry | null;
  connected: boolean;
  firstMotion: Date | null;
  events: SystemEvent[];
  accelHistory: number[];
  onOpenMap: () => void;
  onOpenSettings: () => void;
  onOpenDevice: () => void;
  connectionPaused: boolean;
  geofence: GeofenceConfig;
  locationSnapshot: LocationSnapshot | null;
  locationSource: LocationSource;
  onLocationSourceChange: (source:LocationSource)=>void;
  remoteFeed: IncidentFeed|null;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const received = telemetry ? new Date(telemetry.received_at).getTime() : NaN;
  const age = Number.isFinite(received) ? Math.max(0, Math.floor((now - received) / 1000)) : null;
  const live = connected && age != null && age <= 5 && !telemetry?.simulated;
  const state = telemetry?.state ?? "NORMAL";
  const status = state === "NORMAL" ? "Movimiento estable" : STATE_TITLES[state];
  const time = (date: Date) => date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const today = new Date(now).toDateString();
  const motionToday = firstMotion?.toDateString() === today ? firstMotion : null;
  const activity = mergeCareActivity(events,remoteFeed,profile?.id,now);
  const remoteGps = useRemoteHomePosition(profile?.id,locationSource === "remote");
  const battery = telemetry?.battery_percent;
  const points = accelHistory.map((value, i) =>
    `${i * 480 / Math.max(1, accelHistory.length - 1)},${Math.max(8, Math.min(72, 40 - (value - 1) * 30))}`).join(" ");

  return (
    <div className={`care-home care-focused ${live ? "monitoring-live" : "monitoring-waiting"}`}>
      <CareLocationSummary residentId={profile?.id} source={locationSource} onSourceChange={onLocationSourceChange} local={locationSnapshot} remote={remoteGps.reading} feed={remoteFeed} now={now} onMap={onOpenMap} onPrepare={onOpenSettings} onRefresh={remoteGps.refresh} connectionPaused={connectionPaused}/>
      <CareSignal connected={connected} fresh={live} riskLabel={status} age={age} onPrepare={onOpenDevice}/>
      {motionToday && <section className="care-first-motion"><Icon name="sunrise" size={20}/><strong>Primera actividad · {time(motionToday)}</strong><span>Registrada por el cinturón</span></section>}
      <CareActivity entries={activity} feed={remoteFeed}/>

      {telemetry && <details className="focus-telemetry" open={live}>
        <summary><span><Icon name="activity" size={20} /><strong>{live ? "Mediciones del cinturón" : "Consultar la última lectura"}</strong></span><span className="measurement-state">{live ? "En vivo" : "Sin actualizar"}<Icon name="chevron-down" size={17} /></span></summary>
        <div className="focus-measurements">
          <div className="care-metrics">
            <div><p className="care-metric-label">Batería</p><p className="care-metric-value">{battery != null ? battery + "%" : "—"}</p><p className={battery != null && battery < 15 ? "text-sm text-[#C2410C]" : "text-sm text-[#55625E]"}>{battery == null ? "Dato no disponible" : battery < 15 ? "Requiere carga" : "Carga disponible"}</p>{battery != null && <progress className="care-battery" value={battery} max={100} aria-label="Carga de batería" />}</div>
            <div><p className="care-metric-label">Aceleración</p><p className="care-metric-value">{telemetry.accel_g != null ? telemetry.accel_g.toFixed(2) : "—"} <span>g</span></p><p className="text-sm text-[#55625E]">Magnitud del movimiento</p></div>
            <div><p className="care-metric-label">Inclinación</p><p className="care-metric-value">{telemetry.tilt_deg != null ? telemetry.tilt_deg.toFixed(1) + "°" : "—"}</p><p className="text-sm text-[#55625E]">Ángulo del cinturón</p></div>
          </div>
          <div className="focus-waveform"><svg viewBox="0 0 480 80" preserveAspectRatio="none" role="img" aria-label="Historial de aceleración recibido"><line x1="0" y1="40" x2="480" y2="40" stroke="#E2E8F0" strokeDasharray="4 4" /><polyline points={points} fill="none" stroke="#0D9488" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><p>{live ? "Lecturas recientes" : "Evidencia de la última señal recibida"}</p></div>
        </div>
      </details>}

    </div>
  );
}

export function FallAlertScreen({
  profile,
  startedAt,
  onConfirm,
  confirming = false,
  error = "",
}: {
  profile: ResidentProfile | null;
  startedAt: Date;
  onConfirm: () => Promise<void>;
  confirming?: boolean;
  error?: string;
}) {
  const [now, setNow] = useState(Date.now());
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(id);
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    };
  }, []);

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - startedAt.getTime()) / 1000),
  );
  const timer = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(
    elapsedSeconds % 60,
  ).padStart(2, "0")}`;

  // Lógica de mantener presionado 1.2 segundos para confirmar
  const startHold = () => {
    if (confirming || holdTimerRef.current) return;
    const startTime = Date.now();
    holdTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / 1200) * 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(holdTimerRef.current!);
        holdTimerRef.current = null;
        onConfirm();
      }
    }, 20);
  };

  const endHold = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  };

  const name = profile?.full_name || "Residente";
  const room = profile?.room || "Habitación";
  const emergencyPhone = profile?.emergency_phone || "112";

  return (
    <main className="grid min-h-screen place-items-center bg-[#E4572E] p-6 text-white relative">
      <section className="relative z-10 w-full max-w-lg text-center space-y-8">
        <div>
          <p className="font-mono-data text-xs uppercase tracking-widest text-white/80">
            SFA · PROTOCOLO DE ASISTENCIA
          </p>
          <h1 className="font-serif text-5xl sm:text-6xl font-light text-white mt-3">
            Caída detectada
          </h1>
          <p className="font-serif text-xl italic text-white/90 mt-1">
            {name} · {room}
          </p>
        </div>

        {/* Cronómetro Dominante */}
        <div className="py-4 border-y border-white/20">
          <div className="font-mono-data text-7xl sm:text-8xl font-light tabular-nums text-white">
            {timer}
          </div>
          <p className="font-mono-data text-xs uppercase tracking-widest text-white/70 mt-1">
            desde el impacto
          </p>
        </div>

        {/* Botón Mantener Presionado para Confirmar */}
        <div className="space-y-4 pt-2">
          <div className="relative overflow-hidden rounded-full bg-white text-[#E4572E]">
            {/* Barra de progreso de pulsación */}
            <div
              className="absolute inset-0 bg-[#14201D]/15 transition-all"
              style={{ width: `${holdProgress}%` }}
            />
            <button
              type="button"
              disabled={confirming}
              onPointerDown={startHold}
              onPointerUp={endHold}
              onPointerCancel={endHold}
              onPointerLeave={endHold}
              onBlur={endHold}
              onKeyDown={event => { if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); startHold(); } }}
              onKeyUp={event => { if ([" ", "Enter"].includes(event.key)) endHold(); }}
              className="relative w-full py-5 px-8 text-base font-medium tracking-wide select-none cursor-pointer"
            >
              {confirming ? "Confirmando con el cinturón..." : holdProgress > 0
                ? "Mantén presionado..."
                : "Mantener para confirmar atención"}
            </button>
          </div>
          {error && <p role="alert" className="rounded-lg border border-white/40 bg-black/10 p-3 text-sm text-white">{error}</p>}

          <a
            href={`tel:${emergencyPhone}`}
            className="inline-block font-mono-data text-xs text-white/80 hover:text-white underline underline-offset-4"
          >
            Llamar a emergencias ({emergencyPhone})
          </a>
        </div>
      </section>
    </main>
  );
}

export function MapScreen({
  geofence,
  profile,
  locationSnapshot,
  onUpdateGeofence,
  onPrepare,
  source,
  onSourceChange,
}: {
  geofence: GeofenceConfig;
  profile: ResidentProfile | null;
  locationSnapshot: LocationSnapshot | null;
  onUpdateGeofence: (updated: GeofenceConfig) => void;
  onPrepare?: () => void;
  source?: LocationSource;
  onSourceChange?: (source:LocationSource)=>void;
}) {
  const [selectedRadius, setSelectedRadius] = useState<number>(geofence.radius_m);
  const [tempLat, setTempLat] = useState<number>(geofence.home_lat);
  const [tempLng, setTempLng] = useState<number>(geofence.home_lng);
  const [tempName, setTempName] = useState(geofence.address_name);
  const [saving, setSaving] = useState(false);
  const [internalSource, setInternalSource] = useState<LocationSource>("remote");
  const locationSource = source ?? internalSource;
  const setLocationSource = (next:LocationSource) => { setInternalSource(next); onSourceChange?.(next); };

  useEffect(() => {
    setSelectedRadius(geofence.radius_m);
    setTempLat(geofence.home_lat);
    setTempLng(geofence.home_lng);
    setTempName(geofence.address_name);
  }, [geofence]);

  async function saveGeofence() {
    setSaving(true);
    try {
      const payload: GeofenceConfig = {
        home_lat: tempLat,
        home_lng: tempLng,
        radius_m: selectedRadius,
        address_name: tempName.trim(),
      };
      await actionRequest(`/api/residents/${profile?.id}/geofence`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      onUpdateGeofence(payload);
      notify("Geocerca guardada");
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se pudo guardar la geocerca.", "error");
    } finally {
      setSaving(false);
    }
  }

  const hasGps = Boolean(locationSnapshot?.position);
  const residentName = profile?.full_name || "Residente";

  return (
    <div className="location-workspace">
      <div className="page-heading"><div><p className="care-eyebrow">Ubicación y seguridad</p><h1 className="font-serif">Un entorno de cuidado</h1><p>Seguimiento de {residentName}.</p></div>{locationSource === "local" && <span className={`care-status ${locationSnapshot?.status === "inside" ? "is-safe" : "is-waiting"}`}><Icon name="map-pin" size={17} />{locationLabel(locationSnapshot?.status || "no_fix")}</span>}</div>
      <div className="geo-source-selector" role="group" aria-label="Fuente de ubicación"><button type="button" aria-pressed={locationSource === "remote"} onClick={() => setLocationSource("remote")}><Icon name="cloud" size={18} />Por internet</button><button type="button" aria-pressed={locationSource === "local"} onClick={() => setLocationSource("local")}><Icon name="wifi" size={18} />Red local y geocerca</button></div>
      {locationSource === "remote" ? <LocalRemoteLocation key={profile?.id || "none"} residentId={profile?.id} residentName={residentName} onPrepare={onPrepare} /> : <>
      <LocationPanel key={profile?.id || "none"} residentId={profile?.id} snapshot={locationSnapshot} />
      <div className="location-layout">
        <section className="location-controls">
          <div className="location-section"><Icon name="scan-line" size={25} className="text-[#0D9488]" /><h2>Zona de referencia</h2><label className="geofence-name">Nombre de la zona<input value={tempName} maxLength={160} onChange={e => setTempName(e.target.value)} /></label></div>
          <div className="location-section"><GeofenceRadius value={selectedRadius} onChange={setSelectedRadius} /></div>
          <div className="location-section"><h3>Centro de la zona</h3><dl className="location-coordinates"><div><dt>Latitud</dt><dd>{tempLat.toFixed(5)}</dd></div><div><dt>Longitud</dt><dd>{tempLng.toFixed(5)}</dd></div></dl>
            <button type="button" className="resident-button link-resident" disabled={!locationSnapshot?.position || ["stale", "unlinked", "awaiting_device"].includes(locationSnapshot.status)} onClick={() => { if (locationSnapshot?.position) { setTempLat(locationSnapshot.position.latitude); setTempLng(locationSnapshot.position.longitude); } }}><Icon name="locate-fixed" size={17} />Usar posición del celular</button>
          </div>
          <button className="care-action" onClick={saveGeofence} disabled={saving || !profile?.id || !tempName.trim() || !Number.isInteger(selectedRadius) || selectedRadius < 5 || selectedRadius > 100000}><Icon name="save" size={18} />{saving ? "Guardando…" : "Guardar geocerca"}</button>
          <div className="location-note"><Icon name="info" size={20} /><p>{hasGps ? "Última posición del celular vinculado, no del cinturón." : "Sin posición del celular. Se muestra solo la zona configurada."}</p></div>
        </section>
        <LocationMap
          homeLat={tempLat}
          homeLng={tempLng}
          radiusM={Number.isFinite(selectedRadius) && selectedRadius >= 5 ? selectedRadius : geofence.radius_m}
          residentLat={locationSnapshot?.position?.latitude ?? tempLat}
          residentLng={locationSnapshot?.position?.longitude ?? tempLng}
          residentName={residentName}
          hasGps={hasGps}
          fresh={!locationSnapshot || !["stale", "unlinked", "zone_changed", "awaiting_device"].includes(locationSnapshot.status)}
          onMapClick={(lat, lng) => { setTempLat(lat); setTempLng(lng); }}
        />
      </div>
      <LocationHistory events={locationSnapshot?.events ?? []} />
      </>}
    </div>
  );
}

export function LocationMap({
  homeLat,
  homeLng,
  radiusM,
  residentLat,
  residentLng,
  residentName,
  hasGps,
  fresh,
  onMapClick,
}: {
  homeLat: number;
  homeLng: number;
  radiusM: number;
  residentLat: number;
  residentLng: number;
  residentName: string;
  hasGps: boolean;
  fresh: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const map = L.map(elementRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([homeLat, homeLng], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.remove();
    circleRef.current?.remove();

    const icon = L.divIcon({
      className: "",
      html: fresh ? '<div class="sfa-pulse-marker"></div>' : '<div class="sfa-position-static"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    if (hasGps) {
      const popup = document.createElement("div");
      popup.textContent = `${residentName} · Última posición recibida`;
      markerRef.current = L.marker([residentLat, residentLng], { icon })
        .bindPopup(popup)
        .addTo(map);
    }

    circleRef.current = L.circle([homeLat, homeLng], {
      radius: radiusM,
      color: "#0F766E",
      weight: 1.5,
      fillColor: "#0F766E",
      fillOpacity: 0.08,
    }).addTo(map);
  }, [homeLat, homeLng, radiusM, residentLat, residentLng, residentName, hasGps, fresh]);

  useEffect(() => {
    // Circle bounds require the projection of the map it has been added to.
    if (mapRef.current && circleRef.current) {
      mapRef.current.fitBounds(circleRef.current.getBounds(), { padding: [32, 32], maxZoom: 19, animate: false });
    }
  }, [homeLat, homeLng, radiusM]);

  return (
    <div className="location-map-frame relative overflow-hidden">
      <div ref={elementRef} className="location-map-canvas w-full cursor-crosshair" />
      {hasGps && <button className="geo-center-map" title="Centrar zona y última posición" aria-label="Centrar zona y última posición" onClick={() => mapRef.current?.fitBounds(L.latLngBounds([homeLat, homeLng], [residentLat, residentLng]).pad(.25), { maxZoom: 16 })}><Icon name="locate-fixed" size={20} /></button>}
      <div className="map-legend"><span className="legend-zone" />Zona de referencia · {radiusM} m{hasGps && <><span className="legend-position" />Última posición</>}</div>
    </div>
  );
}

function MobileAccess({ initialInfo }: { initialInfo: NetworkInfo | null }) {
  const [info, setInfo] = useState(initialInfo);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [qrError, setQrError] = useState(false);
  const [qrRevision, setQrRevision] = useState(0);
  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/network-info");
      if (!response.ok) throw new Error("No se pudo consultar la red.");
      setInfo(await response.json());
      setQrRevision(revision => revision + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo consultar la red."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const targetUrl = customAddress || info?.url || window.location.origin;
  const usable = (() => {
    try {
      const url = new URL(targetUrl);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
        !["localhost", "0.0.0.0", "[::1]"].includes(url.hostname) && !url.hostname.startsWith("127.");
    } catch { return false; }
  })();
  useEffect(() => {
    let cancelled = false;
    setQr("");
    setQrError(false);
    if (usable) {
      QRCode.toDataURL(targetUrl, { width: 224, margin: 4, errorCorrectionLevel: "M" })
        .then(image => { if (!cancelled) setQr(image); })
        .catch(() => { if (!cancelled) { setQrError(true); setError("No se pudo generar el código QR. Pulsa Actualizar para reintentar."); } });
    }
    return () => { cancelled = true; };
  }, [targetUrl, usable, qrRevision]);
  async function copy() {
    try { await navigator.clipboard.writeText(targetUrl); notify("Dirección copiada"); }
    catch { notify("Selecciona la dirección y cópiala manualmente.", "info"); }
  }
  return <section className="mobile-access mobile-access-refined">
    <div className="mobile-access-heading">
      <div><h3>Acceso web por red local</h3><p>Conecta el celular a la misma red de esta PC y escanea el QR con su cámara.
      <span className="connection-help"><button type="button" className="connection-help-button" aria-label="Cómo conectar el celular a la red local" aria-describedby="local-network-help"><Icon name="circle-help" size={18} /></button>
        <span id="local-network-help" role="tooltip" className="connection-help-tooltip"><strong>Conectar ambos equipos</strong><span><b>Mismo Wi-Fi:</b> conecta la PC y el celular al mismo router. Evita la red de invitados, que puede aislar los dispositivos.</span><span><b>Hotspot del celular:</b> activa Compartir Internet o Zona Wi-Fi en el teléfono y conecta la PC a esa red.</span><span><b>Hotspot de la PC:</b> activa Zona con cobertura inalámbrica móvil en Windows y conecta el celular a la red creada.</span><span>Después de cambiar de red, vuelve a iniciar el acceso móvil y pulsa Actualizar para generar el QR con la nueva dirección.</span><span>El panel funciona por red local. Si no abre, revisa el firewall de la PC y el aislamiento de dispositivos de la red.</span></span>
      </span>
      </p></div>
      <button type="button" className="resident-button link-resident" disabled={busy} onClick={refresh}><Icon name="refresh-cw" size={17} />Actualizar</button>
    </div>
    <div className="mobile-qr-column">
      <div className="mobile-qr">{qr ? <img src={qr} alt="Código QR para abrir SFA Asistencia en el celular" width={224} height={224} /> : <div><Icon name="qr-code" size={40} /><p>{busy ? "Consultando red…" : usable && !qrError ? "Generando QR…" : "Revisa la red y pulsa Actualizar"}</p></div>}</div>
      <p>{qr ? "Escanea con la cámara para abrir el panel" : "El código aparecerá al detectar la red local"}</p>
    </div>
    <div className="mobile-access-copy">
      <div className={`care-status ${info?.lan_available ? "is-safe" : "is-waiting"}`}><Icon name={info?.lan_available ? "wifi" : "unplug"} size={17} />{info?.lan_available ? "Acceso local disponible" : "Acceso local pendiente"}</div>
      {info?.addresses && info.addresses.length > 1 && <label className="mobile-interface">Red del celular<select aria-label="Seleccionar red de acceso móvil" value={targetUrl} onChange={e => setCustomAddress(e.target.value)}>{info.addresses.map(address => <option key={address} value={`http://${address}:${info.port}`}>{address.startsWith("192.168.137.") ? "Hotspot de Windows" : "Red local"} · {address}</option>)}{!info.addresses.some(address => targetUrl === `http://${address}:${info.port}`) && <option value={targetUrl}>Dirección manual</option>}</select></label>}
      <div className="mobile-address"><span>Dirección incluida en el QR</span><div><input aria-label="Dirección de acceso móvil" type="url" value={targetUrl} onChange={e => setCustomAddress(e.target.value)} spellCheck={false} /><button type="button" aria-label="Copiar dirección del panel" title="Copiar dirección" onClick={copy}><Icon name="copy" size={18} /></button></div><p className="mobile-manual-hint">No necesitas escribirla: el QR abre esta dirección.{!usable && " Elige la red del celular para generar un código válido."}</p></div>
      <div className="mobile-connection-steps">
        {!info?.lan_available && <div><Icon name="monitor" size={20} /><div><strong>En la PC</strong><p>Detén el servidor y ejecuta <code>iniciar_acceso_movil.bat</code>. Luego pulsa Actualizar.</p></div></div>}
        <div><Icon name="smartphone" size={20} /><div><strong>En el celular</strong><p>Conéctalo al mismo Wi-Fi o hotspot. Abre la cámara, apunta al QR y toca el enlace que aparezca.</p></div></div>
      </div>
      <details className="mobile-troubleshooting"><summary>Si la página no abre<Icon name="chevron-down" size={16} /></summary><p>Comprueba que ambos equipos estén en la misma red y que el firewall permita Python en redes privadas. Evita redes de invitados que aíslen dispositivos.</p></details>
      {error && <p role="alert" className="photo-error">{error}</p>}
    </div>
    <p className="mobile-network-footnote"><Icon name="shield-check" size={16} />Usa una red de confianza. El acceso local permite abrir el panel desde sus equipos.</p>
  </section>;
}

function ResidentPhotoEditor({ profile, onPhotoChange }: {
  profile: ResidentProfile;
  onPhotoChange: (id: number, url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file: File) {
    if (!profile.id) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Selecciona una imagen JPG, PNG o WebP."); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("La imagen debe pesar menos de 10 MB."); return;
    }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo preparar la imagen.");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const response = await fetch(`/api/residents/${profile.id}/photo`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_base64: canvas.toDataURL("image/jpeg", .88).split(",")[1] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "No se pudo guardar la foto.");
      onPhotoChange(profile.id, result.photo_url);
      notify("Foto del residente guardada");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la foto.");
    } finally { setBusy(false); }
  }
  async function remove() {
    if (!profile.id) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/residents/${profile.id}/photo`, { method: "DELETE" });
      if (!response.ok) throw new Error("No se pudo quitar la foto.");
      onPhotoChange(profile.id, null);
      notify("Foto del residente eliminada");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo quitar la foto."); }
    finally { setBusy(false); }
  }
  return (
    <div className="photo-editor">
      <div className="photo-preview">{profile.photo_url ? <img src={profile.photo_url} alt={`Foto de ${profile.full_name}`} /> : <Icon name="user-round" size={32} />}</div>
      <div><p className="font-semibold">Foto del residente</p><div className="photo-actions">
        <button type="button" disabled={busy} className="resident-button link-resident" onClick={() => input.current?.click()}><Icon name="camera" size={17} />{busy ? "Guardando…" : profile.photo_url ? "Cambiar foto" : "Agregar foto"}</button>
        {profile.photo_url && <button type="button" disabled={busy} className="resident-button delete-resident" onClick={remove}><Icon name="image-minus" size={17} />Quitar foto</button>}
      </div><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Seleccionar foto del residente" disabled={busy} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) void upload(file); }} />
      {error && <p role="alert" className="photo-error">{error}</p>}
      </div>
    </div>
  );
}

function ConfigurationCopies() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function exportCopy() {
    setBusy(true);
    try {
      const response = await fetch("/api/configuration/export");
      if (!response.ok) throw new Error("No se pudo exportar la copia.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = "SFA-configuracion.json"; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Copia de perfiles y ajustes exportada");
    } catch (e) { notify(e instanceof Error ? e.message : "No se pudo exportar.", "error"); }
    finally { setBusy(false); }
  }
  async function restore(file: File) {
    if (file.size > 20 * 1024 * 1024) { notify("La copia supera el límite de 20 MB.", "error"); return; }
    if (!window.confirm("Esta copia reemplazará los perfiles, fotos y ajustes actuales. El historial de eventos y las credenciales de Telegram no se modificarán. ¿Continuar?")) return;
    setBusy(true);
    try {
      await actionRequest("/api/configuration/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(JSON.parse(await file.text())),
      });
      notify("Copia restaurada. Actualizando el panel…");
      window.setTimeout(() => window.location.reload(), 1000);
    } catch (e) { notify(e instanceof Error ? e.message : "No se pudo restaurar.", "error"); setBusy(false); }
  }
  return <section className="configuration-copies"><h3>Copias de configuración</h3><p>Traslada los perfiles, sus fotos, la geocerca y las preferencias a otra PC.</p>
    <div className="photo-actions"><button className="resident-button link-resident" disabled={busy} onClick={exportCopy}><Icon name="download" size={18} />Exportar copia</button><button className="resident-button link-resident" disabled={busy} onClick={() => input.current?.click()}><Icon name="upload" size={18} />Importar copia</button></div>
    <input ref={input} className="sr-only" type="file" accept=".json,application/json" aria-label="Seleccionar copia de configuración" disabled={busy} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) void restore(file); }} />
    <p>La copia contiene datos de los residentes: guárdala en un lugar privado. No incluye el historial ni el token o Chat ID de Telegram.</p>
    <p>Para conservar también el historial y las credenciales, cierra el programa y respalda la carpeta <code>data</code> del portable.</p>
  </section>;
}

function SettingsScreen({
  peopleOnly = false,
  initialTab,
  onPrepare,
  onTriggerFallSimulation,
  residents,
  profile,
  geofence,
  notificationConfig,
  networkInfo,
  connected,
  connectedPort,
  connectionError,
  onSelectResident,
  onCreateResident,
  onDeleteResident,
  onUpdateProfile,
  onPhotoChange,
  onOpenMap,
  onUpdateNotifications,
}: {
  peopleOnly?: boolean;
  initialTab: SettingsEntry;
  onPrepare: () => void;
  onTriggerFallSimulation: () => void;
  residents: ResidentProfile[];
  profile: ResidentProfile | null;
  geofence: GeofenceConfig;
  notificationConfig: NotificationConfig;
  networkInfo: NetworkInfo | null;
  connected: boolean;
  connectedPort: string | null;
  connectionError: string | null;
  onSelectResident: (id: number) => void;
  onCreateResident: (newResident: ResidentProfile) => void;
  onDeleteResident: (id: number) => void;
  onUpdateProfile: (p: ResidentProfile) => void;
  onPhotoChange: (id: number, url: string | null) => void;
  onOpenMap: () => void;
  onUpdateNotifications: (n: NotificationConfig) => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "residents" | "notifications" | "geofence" | "mobile" | "hardware" | "backup"
  >(initialTab);
  const [personTab, setPersonTab] = useState<"data" | "access">("data");

  const [profileForm, setProfileForm] = useState<ResidentProfile>(
    profile || {
      full_name: "",
      room: "",
      phone: "",
      emergency_phone: "112",
      medical_notes: "",
    },
  );

  const [newResidentForm, setNewResidentForm] = useState<ResidentProfile>({
    full_name: "",
    room: "",
    phone: "",
    emergency_phone: "112",
    medical_notes: "",
  });

  const [showNewModal, setShowNewModal] = useState(false);
  const [notifForm, setNotifForm] =
    useState<NotificationConfig>(notificationConfig);
  const [testingTelegram, setTestingTelegram] = useState(false);

  const [ports, setPorts] = useState<Port[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [baudrate, setBaudrate] = useState(115200);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (profile) setProfileForm(current => current.id === profile.id
      ? { ...current, photo_url: profile.photo_url }
      : profile);
  }, [profile]);


  useEffect(() => {
    setNotifForm(notificationConfig);
  }, [notificationConfig]);

  const loadPorts = useCallback(async () => {
    try {
      const response = await fetch("/api/ports");
      const result: Port[] = await response.json();
      setPorts(result);
      setSelectedPort((current) => current || result[0]?.device || "");
    } catch {
      setPorts([
        { device: "COM3", description: "Arduino Uno / Sensor MPU6050" },
      ]);
      setSelectedPort("COM3");
    }
  }, []);

  useEffect(() => {
    void loadPorts();
  }, [loadPorts]);

  const [saving, setSaving] = useState(false);
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = await actionRequest<{ resident: ResidentProfile }>("/api/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileForm),
      });
      setProfileForm(result.resident);
      onUpdateProfile(result.resident);
      notify("Ficha del residente actualizada");
    } catch (e) { notify(e instanceof Error ? e.message : "No se pudo guardar la ficha.", "error"); }
    finally { setSaving(false); }
  }
  async function handleCreateNewResident(e: React.FormEvent) {
    e.preventDefault();
    if (!newResidentForm.full_name) return;
    try {
      await onCreateResident(newResidentForm);
      setNewResidentForm({ full_name: "", room: "", phone: "", emergency_phone: "112", medical_notes: "" });
      setShowNewModal(false);
    } catch { /* The parent reports the failed action and keeps this form open. */ }
  }
  async function handleSaveNotifications() {
    try {
      await actionRequest("/api/notifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notifForm) });
      onUpdateNotifications(notifForm);
      notify("Preferencias de notificación guardadas");
    } catch (e) { notify(e instanceof Error ? e.message : "No se pudo guardar la configuración.", "error"); }
  }
  async function handleTestTelegram() {
    setTestingTelegram(true);
    try {
      const result = await actionRequest<{ sent: boolean }>("/api/notifications/test-telegram", { method: "POST" });
      notify(result.sent ? "Notificación de prueba enviada" : "No se pudo enviar. Revisa el token y el Chat ID.", result.sent ? "success" : "error");
    } catch (e) { notify(e instanceof Error ? e.message : "No se pudo enviar la prueba.", "error"); }
    finally { setTestingTelegram(false); }
  }
  async function connect() {
    if (!selectedPort) return;
    setConnecting(true);
    try {
      const result = await actionRequest<{ connected?: boolean; error?: string }>("/api/connect", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port: selectedPort, baudrate }),
      });
      if (result.connected) notify("Puerto conectado");
      else notify(result.error || "No se pudo abrir el puerto seleccionado.", "error");
    } catch (e) { notify(e instanceof Error ? e.message : "No se pudo conectar.", "error"); }
    finally { setConnecting(false); }
  }

  const subtabs = [
    { id: "residents", icon: "users-round", label: "Residentes" },
    { id: "notifications", icon: "bell", label: "Notificaciones" },
    { id: "geofence", icon: "scan-line", label: "Geocerca" },
    { id: "mobile", icon: "smartphone", label: "Acceso móvil" },
    { id: "hardware", icon: "cable", label: "Dispositivo" },
    { id: "backup", icon: "archive", label: "Copias" },
  ] as const;

  return (
    <div className={`settings-workspace${peopleOnly ? " people-workspace" : ""}`}>
      {/* Sub-índice editorial vertical */}
      {!peopleOnly && <div className="settings-navigation">
        <h1 className="sr-only">Configuración de asistencia</h1>
        <nav className="settings-tabs" aria-label="Apartados de ajustes">
          {subtabs.filter(tab => tab.id !== "residents").map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                aria-current={active ? "page" : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-baseline justify-between py-3 text-left transition cursor-pointer ${
                  active ? "font-serif italic text-[#14201D] text-lg" : "font-sans text-xs text-[#55625E] hover:text-[#14201D]"
                }`}
              >
                <Icon name={tab.icon} size={19} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>}

      {/* Contenido según pestaña */}
      <div className="min-w-0">
        {activeTab === "backup" && <ConfigurationCopies />}
        {activeTab === "residents" && (
          <div className="residents-layout space-y-8">
            <div className="flex items-baseline justify-between border-b border-[#DED8CC] pb-4">
              <div>
                <h3 className="font-serif text-3xl font-light text-[#14201D]">
                  Personas cuidadas
                </h3>
                <p className="text-xs text-[#55625E] mt-1">
                  Personas registradas para el monitoreo de caídas y teleasistencia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="rounded-full bg-[#14201D] px-4 py-2 text-xs font-medium text-white hover:bg-[#0F766E] transition cursor-pointer"
              >
                <Icon name="user-round-plus" size={18} /> Añadir residente
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {residents.map((r) => {
                const isSelected = r.id === profile?.id;
                return (
                  <div
                    key={r.id}
                    className={`sfa-editorial-card p-5 space-y-3 ${
                      isSelected ? "border-[#0F766E] bg-[#FBFAF7]" : ""
                    }`}
                  >
                    <div className="flex items-baseline justify-between">
                      <div className="directory-photo">{r.photo_url ? <img src={r.photo_url} alt={`Foto de ${r.full_name}`} /> : <Icon name="user-round" size={24} />}</div>
                      <p className="font-serif text-xl font-normal text-[#14201D]">
                        {r.full_name}
                      </p>
                      {isSelected ? (
                        <span className="resident-active-badge">
                          <Icon name="circle-check" size={17} /> Perfil activo
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => r.id && onSelectResident(r.id)}
                          className="resident-button link-resident"
                        >
                          <Icon name="user-round" size={16} /> Abrir ficha
                        </button>
                      )}
                    </div>
                    <div className="font-mono-data text-xs text-[#55625E] space-y-0.5">
                      <p>{r.room}</p>
                      <p>{r.phone}</p>
                    </div>
                    {residents.length > 1 && (
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => r.id && onDeleteResident(r.id)}
                          className="resident-button delete-resident"
                        >
                          <Icon name="trash-2" size={16} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <section className="person-detail" aria-label="Ficha y relaciones de la persona">
            {profile && <nav className="people-team-tabs local-person-tabs" aria-label="Ficha seleccionada"><button aria-label={`Datos de ${profile.full_name}`} aria-pressed={personTab === "data"} onClick={() => setPersonTab("data")}><Icon name="user-round" size={17}/>Datos</button><button aria-pressed={personTab === "access"} onClick={() => setPersonTab("access")}><Icon name="users-round" size={17}/>Cuidadores y acceso</button></nav>}
            {profile?.id && personTab === "access" && <div className="preparation-access"><LocalPersonAccess key={profile.id} localId={profile.id} onPrepare={onPrepare}/></div>}
            {profile && personTab === "data" && (
              <form onSubmit={handleSaveProfile} className="sfa-editorial-card p-6 space-y-4">
                {profile.id && <ResidentPhotoEditor profile={profile} onPhotoChange={onPhotoChange} />}
                <p className="font-serif text-lg font-normal text-[#14201D]">
                  Editar datos de {profile.full_name}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs text-[#55625E]">
                    Nombre
                    <input
                      type="text"
                      value={profileForm.full_name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, full_name: e.target.value })
                      }
                      className="mt-1 w-full border-b border-[#DED8CC] bg-transparent py-1.5 text-sm text-[#14201D] outline-none focus:border-[#0F766E]"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#55625E]">
                    Habitación
                    <input
                      type="text"
                      value={profileForm.room}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, room: e.target.value })
                      }
                      className="mt-1 w-full border-b border-[#DED8CC] bg-transparent py-1.5 text-sm text-[#14201D] outline-none focus:border-[#0F766E]"
                      required
                    />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs text-[#55625E]">
                    Teléfono directo
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, phone: e.target.value })
                      }
                      className="mt-1 w-full border-b border-[#DED8CC] bg-transparent py-1.5 text-sm text-[#14201D] outline-none focus:border-[#0F766E]"
                      required
                    />
                  </label>
                  <label className="text-xs text-[#55625E]">
                    Teléfono de emergencia
                    <input
                      type="tel"
                      value={profileForm.emergency_phone}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          emergency_phone: e.target.value,
                        })
                      }
                      className="mt-1 w-full border-b border-[#DED8CC] bg-transparent py-1.5 text-sm text-[#14201D] outline-none focus:border-[#0F766E]"
                      required
                    />
                  </label>
                </div>
                <label className="block text-xs text-[#55625E]">
                  Notas médicas
                  <textarea
                    rows={2}
                    value={profileForm.medical_notes}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        medical_notes: e.target.value,
                      })
                    }
                    className="mt-1 w-full border-b border-[#DED8CC] bg-transparent py-1.5 text-sm text-[#14201D] outline-none focus:border-[#0F766E]"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-[#14201D] text-white px-5 py-2 text-xs font-medium hover:bg-[#0F766E] transition cursor-pointer"
                >
                  {saving ? "Guardando…" : "Guardar ficha"}
                </button>
              </form>
            )}

            </section>
            {/* Modal de alta */}
            {showNewModal && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-[#14201D]/40 p-4">
                <form
                  onSubmit={handleCreateNewResident}
                  className="w-full max-w-md rounded-2xl bg-[#FBFAF7] p-6 border border-[#DED8CC] space-y-4"
                >
                  <div className="flex items-baseline justify-between border-b border-[#DED8CC] pb-3">
                    <h4 className="font-serif text-xl font-normal text-[#14201D]">
                      Alta de Residente
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowNewModal(false)}
                      className="text-xs text-[#55625E] hover:text-[#14201D]"
                    >
                      cerrar
                    </button>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs text-[#55625E]">
                      Nombre completo
                      <input
                        type="text"
                        value={newResidentForm.full_name}
                        onChange={(e) =>
                          setNewResidentForm({
                            ...newResidentForm,
                            full_name: e.target.value,
                          })
                        }
                        className="mt-1 w-full border-b border-[#DED8CC] bg-transparent py-1.5 text-sm outline-none focus:border-[#0F766E]"
                        required
                      />
                    </label>
                    <label className="block text-xs text-[#55625E]">
                      Habitación o sector
                      <input
                        type="text"
                        value={newResidentForm.room}
                        onChange={(e) =>
                          setNewResidentForm({
                            ...newResidentForm,
                            room: e.target.value,
                          })
                        }
                        className="mt-1 w-full border-b border-[#DED8CC] bg-transparent py-1.5 text-sm outline-none focus:border-[#0F766E]"
                        required
                      />
                    </label>
                    <label className="block text-xs text-[#55625E]">
                      Teléfono personal
                      <input
                        type="tel"
                        value={newResidentForm.phone}
                        onChange={(e) =>
                          setNewResidentForm({
                            ...newResidentForm,
                            phone: e.target.value,
                          })
                        }
                        className="mt-1 w-full border-b border-[#DED8CC] bg-transparent py-1.5 text-sm outline-none focus:border-[#0F766E]"
                        required
                      />
                    </label>
                  </div>
                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowNewModal(false)}
                      className="text-xs text-[#55625E] px-4 py-2"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded-full bg-[#14201D] text-white px-5 py-2 text-xs font-medium hover:bg-[#0F766E]"
                    >
                      Registrar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

{activeTab === "notifications" && (
          <div className="notifications-panel">
            <div>
              <h3 className="font-serif text-2xl font-light text-[#14201D]">
                Reglas y Canales de Notificación
              </h3>
              <p className="text-xs text-[#55625E] mt-1">
                Alertas locales, avisos al celular, correo electrónico y Telegram opcional.
              </p>
            </div>

            <div className="notification-rules">
              <div className="flex items-baseline justify-between pt-3"><div><p className="text-sm text-[#14201D]">Geocerca y pérdida de ubicación</p><p className="text-xs text-[#55625E]">Salida, reingreso y falta de señal reciente</p></div><button type="button" role="switch" aria-checked={notifForm.notify_geofence} className="settings-switch" onClick={() => setNotifForm({ ...notifForm, notify_geofence: !notifForm.notify_geofence })}><span className="switch-track" aria-hidden="true" /><span className="sr-only">Avisos de geocerca</span></button></div>
              <div className="flex items-baseline justify-between pt-3">
                <div>
                  <p className="text-sm text-[#14201D]">Sirena web audible</p>
                  <p className="text-xs text-[#55625E]">Reproducir sonido durante una alerta de caída</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNotifForm({
                      ...notifForm,
                      sound_enabled: !notifForm.sound_enabled,
                    })
                  }
                  role="switch"
                  aria-checked={notifForm.sound_enabled}
                  className="settings-switch"
                >
                  <span className="switch-track" aria-hidden="true" /><span className="sr-only">Sirena web audible</span>
                </button>
              </div>

              <div className="flex items-baseline justify-between pt-3">
                <div>
                  <p className="text-sm text-[#14201D]">Avisos de caída confirmada</p>
                  <p className="text-xs text-[#55625E]">Disparo prioritario ante impacto inercial</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNotifForm({
                      ...notifForm,
                      notify_fall: !notifForm.notify_fall,
                    })
                  }
                  role="switch"
                  aria-checked={notifForm.notify_fall}
                  className="settings-switch"
                >
                  <span className="switch-track" aria-hidden="true" /><span className="sr-only">Avisos de caída confirmada</span>
                </button>
              </div>

              <div className="flex items-baseline justify-between pt-3">
                <div>
                  <p className="text-sm text-[#14201D]">Avisos de pánico manual (SOS)</p>
                  <p className="text-xs text-[#55625E]">Disparo inmediato al pulsar el botón del cinturón</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNotifForm({
                      ...notifForm,
                      notify_sos: !notifForm.notify_sos,
                    })
                  }
                  role="switch"
                  aria-checked={notifForm.notify_sos}
                  className="settings-switch"
                >
                  <span className="switch-track" aria-hidden="true" /><span className="sr-only">Avisos de pánico manual</span>
                </button>
              </div>
            </div>

            <PushTestSettings residentId={profile?.id} onPrepare={onPrepare}/>
            <section className="notification-channel"><h3>Pruebas de esta PC</h3><button type="button" className="resident-button" onClick={onTriggerFallSimulation}><Icon name="flask-conical" size={17}/>Simular alerta de caída en esta PC</button></section>
            <EmailSettings />
            {/* Telegram */}
            <div className="notification-channel space-y-4">
              <p className="font-serif text-lg font-normal text-[#14201D]">
                Canal de Telegram
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-[#55625E]">
                  Bot Token (@BotFather)
                  <input
                    type="password"
                    value={notifForm.telegram_token}
                    onChange={(e) =>
                      setNotifForm({ ...notifForm, telegram_token: e.target.value })
                    }
                    className="mt-1 w-full border-b border-[#DED8CC] bg-transparent py-1 text-xs font-mono outline-none focus:border-[#0F766E]"
                  />
                </label>
                <label className="text-xs text-[#55625E]">
                  Chat ID (@userinfobot)
                  <input
                    type="text"
                    value={notifForm.telegram_chat_id}
                    onChange={(e) =>
                      setNotifForm({
                        ...notifForm,
                        telegram_chat_id: e.target.value,
                      })
                    }
                    className="mt-1 w-full border-b border-[#DED8CC] bg-transparent py-1 text-xs font-mono outline-none focus:border-[#0F766E]"
                  />
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={
                    testingTelegram ||
                    !notifForm.telegram_token ||
                    !notifForm.telegram_chat_id
                  }
                  className="font-mono-data text-xs rounded-full border border-[#DED8CC] px-4 py-1.5 text-[#14201D] hover:bg-[#EFECE6] disabled:opacity-50 cursor-pointer"
                >
                  {testingTelegram ? "enviando..." : "probar envío"}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveNotifications}
              className="rounded-full bg-[#14201D] text-white px-5 py-2 text-xs font-medium hover:bg-[#0F766E] transition cursor-pointer"
            >
              Guardar configuración
            </button>
          </div>
        )}

        {activeTab === "geofence" && (
          <section className="geofence-settings-summary">
            <div className="geo-section-heading"><Icon name="scan-line" size={21} /><h3>Zona de referencia</h3></div>
            <div className="geofence-summary-main"><div><span className="care-eyebrow">{profile?.full_name || "Sin residente seleccionado"}</span><h2>{geofence.address_name || "Zona sin nombre"}</h2></div><strong className="geofence-summary-radius">{geofence.radius_m}<span>m de radio</span></strong></div>
            <dl className="geofence-summary-coordinates"><div><dt>Centro de la zona</dt><dd>{geofence.home_lat.toFixed(5)}, {geofence.home_lng.toFixed(5)}</dd></div><div><dt>Origen de la posición</dt><dd>Celular vinculado</dd></div></dl>
            <button type="button" className="care-action" disabled={!profile?.id} onClick={onOpenMap}><Icon name="map" size={18} />Editar zona en el mapa<Icon name="arrow-right" size={17} /></button>
          </section>
        )}

        {activeTab === "mobile" && (
          <>
            <section className="sfa-account-access">
              <div><h3>Cuenta SFA</h3><p>Autenticación y datos remotos requieren internet.</p></div>
              <div>
                <a href="https://hfreedo.github.io/SFA-Asistencia-Anticaidas/acceso.html" target="_blank" rel="noopener noreferrer"><Icon name="external-link" size={18} />Acceso HTTPS</a>
                <button className="resident-button" onClick={onPrepare}><Icon name="laptop" size={18} />Preparar acceso de esta PC</button>
              </div>
            </section>
            <MobileAccess initialInfo={networkInfo} />
          </>
        )}

        {activeTab === "hardware" && (
          <div className="sfa-editorial-card p-6 space-y-4">
            <div className="flex items-baseline justify-between border-b border-[#DED8CC] pb-3">
              <h3 className="font-serif text-2xl font-light text-[#14201D]">
                Puerto Serie del Sensor
              </h3>
              <span className={`device-state-badge ${connected ? "device-connected" : "device-waiting"}`}>
                <Icon name={connected ? "circle-check" : "clock-3"} size={17} />
                {connected ? "Puerto conectado" : "En espera"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-[#55625E]">
                Dispositivo
                <select
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(e.target.value)}
                  className="mt-1 w-full border-b border-[#DED8CC] bg-transparent py-1.5 text-xs outline-none"
                >
                  <option value="">Seleccionar puerto</option>
                  {ports.map((p) => (
                    <option key={p.device} value={p.device}>
                      {p.device} · {p.description}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[#55625E]">
                Baudrate
                <select
                  value={baudrate}
                  onChange={(e) => setBaudrate(Number(e.target.value))}
                  className="mt-1 w-full border-b border-[#DED8CC] bg-transparent py-1.5 text-xs outline-none"
                >
                  <option value={115200}>115200 (USB MPU6050)</option>
                  <option value={9600}>9600 (Bluetooth HC-06)</option>
                </select>
              </label>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={connect}
                disabled={!selectedPort || connecting}
                className="rounded-full bg-[#14201D] text-white px-5 py-2 text-xs font-medium hover:bg-[#0F766E] disabled:opacity-50 cursor-pointer"
              >
                {connecting ? "Conectando..." : connected ? `Conectado a ${connectedPort}` : "Conectar"}
              </button>
              <button
                onClick={loadPorts}
                className="resident-button link-resident"
              >
                <Icon name="refresh-cw" size={17} /> Actualizar puertos
              </button>
            </div>
            {connectionError && (
              <p className="font-mono-data text-xs text-[#E4572E] pt-2">{connectionError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
