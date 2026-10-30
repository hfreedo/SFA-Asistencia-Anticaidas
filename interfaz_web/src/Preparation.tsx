import { useEffect } from "react";
import { ArrowRight, Bell, Cable, Cloud, MapPin, ShieldCheck, UserRound, CircleCheck, CircleAlert, CircleHelp, Minus } from "lucide-react";
import { isLoopback, usePreparationStatus, type PreparationCheck } from "./preparationStatus";
export { isLoopback } from "./preparationStatus";
import { AccessApp } from "./AccessApp";
import "./preparation.css";

export type SettingsEntry = "residents" | "notifications" | "geofence" | "mobile" | "hardware" | "backup";
export function Preparation({ profile, connected, onSettings, onMap, onMonitor, check, focusAccess = false }: {
  profile: { id?: number; full_name: string; room: string } | null;
  connected: boolean;
  onSettings: (tab: SettingsEntry) => void;
  onMap: () => void;
  onMonitor: () => void;
  check?: PreparationCheck;
  focusAccess?: boolean;
}) {
  const local = isLoopback(window.location.hostname);
  const ownCheck = usePreparationStatus(!check);
  const { status, failed } = check ?? ownCheck;
  const linked = status?.bindings.some(b => b.local_resident_id === profile?.id && Boolean(b.enabled));
  const unknown = !local ? "Solo desde esta PC" : failed ? "No se pudo verificar" : "Comprobando";
  const access = () => { const target = document.getElementById("preparation-access"); target?.focus(); target?.scrollIntoView?.({ block: "start", behavior: "smooth" }); };
  useEffect(() => { if (focusAccess) access(); }, [focusAccess]);
  const marker = (state: "ready" | "pending" | "optional" | "unknown") => <span className={`preparation-state is-${state}`}>{state === "ready" ? <CircleCheck size={15}/> : state === "pending" ? <CircleAlert size={15}/> : state === "optional" ? <Minus size={15}/> : <CircleHelp size={15}/>}</span>;
  return <section className="sfa-preparation" aria-labelledby="preparation-title">
    <div className="preparation-heading"><div><p>Conexiones y permisos</p><h1 id="preparation-title">Preparar la asistencia</h1></div>
      <button className="resident-button link-resident" onClick={onMonitor}>Ir al monitoreo<ArrowRight size={18} /></button></div>
    <div className="preparation-person"><UserRound size={24} /><div><strong>{profile?.full_name || "Sin persona seleccionada"}</strong><span>{profile?.room || "Selecciona o crea un perfil para continuar"}</span></div>
      <button className="resident-button" onClick={() => onSettings("residents")}>Gestionar perfiles</button></div>
    <dl className="preparation-status" aria-label="Estado de preparación">
      <div><dt><Cable size={17} />Cinturón</dt><dd>{marker(connected ? "ready" : "optional")}{connected ? "Conectado a esta PC" : "No conectado · opcional para GPS"}</dd><button onClick={() => onSettings("hardware")}>Revisar dispositivo<ArrowRight size={14}/></button></div>
      <div><dt><Cloud size={17} />Perfil por internet</dt><dd>{marker(!status ? "unknown" : linked ? "ready" : "pending")}{status ? linked ? "Vinculado" : "Sin vínculo habilitado" : unknown}</dd><button onClick={access}>Revisar vínculo<ArrowRight size={14}/></button></div>
      <div><dt><ShieldCheck size={17} />Sesión de esta PC</dt><dd>{marker(!status ? "unknown" : status.session_active ? "ready" : "pending")}{status ? status.session_active ? "Activa" : "Pausada" : unknown}</dd><button onClick={access}>Revisar sesión<ArrowRight size={14}/></button></div>
      <div><dt><Bell size={17} />Emisor FCM de esta PC</dt><dd>{marker(!status ? "unknown" : status.push?.last_error ? "pending" : status.push?.configured ? "ready" : "optional")}{status ? status.push?.last_error ? "Requiere revisión" : status.push?.configured ? "Configurado · entrega sin verificar" : "Sin configurar" : unknown}</dd><button onClick={() => onSettings("notifications")}>Revisar avisos<ArrowRight size={14}/></button></div>
    </dl>
    <div className="preparation-columns"><div className="preparation-access" id="preparation-access" tabIndex={-1}>
      {local ? <AccessApp embedded activeResidentId={profile?.id} /> : <section className="preparation-local-only"><ShieldCheck size={24} /><h2>Preparación desde la PC</h2><p>El vínculo y la sesión de envío se administran en localhost. No introduzcas credenciales en una conexión de red local sin confianza.</p><p>Abre «Preparar sistema» desde el Centro SFA en la PC del servidor.</p></section>}
    </div><nav className="preparation-actions" aria-label="Continuar la preparación">
      <h2>Conecta lo que vas a utilizar</h2>
      <button onClick={() => onSettings("hardware")}><Cable size={21} /><span><strong>Cinturón USB o Bluetooth</strong><small>Opcional. Aporta la detección de caídas.</small></span><ArrowRight size={18} /></button>
      <button onClick={onMap}><MapPin size={21} /><span><strong>Celular y geocerca</strong><small>GPS por internet, sin exigir la misma red.</small></span><ArrowRight size={18} /></button>
      <button onClick={() => onSettings("notifications")}><Bell size={21} /><span><strong>Avisos y pruebas</strong><small>Receptores, sonido y envío de prueba al celular.</small></span><ArrowRight size={18} /></button>
      <p>El acceso identifica tu cuenta; el perfil identifica a la persona cuidada. Vincular la PC no inicia el GPS del celular.</p>
      <p>Los avisos FCM emitidos por esta PC requieren el servidor encendido y una sesión de envío activa. «Configurado» no confirma recepción.</p>
    </nav></div>
  </section>;
}
