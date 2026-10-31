import { useEffect, useState } from "react";
import { ArrowRight, Bell, Cable, ChevronRight, Cloud, MapPin, ShieldCheck, UserRound, CircleCheck, CircleAlert, CircleHelp, Minus } from "lucide-react";
import { isLoopback, monitoringState, usePreparationStatus, type PreparationCheck } from "./preparationStatus";
export { isLoopback } from "./preparationStatus";
import { AccessApp } from "./AccessApp";
import "./preparation.css";
import { enableBrowserNotices, setBrowserNotices, useBrowserNotices } from "./browserNotices";

export type SettingsEntry = "residents" | "notifications" | "geofence" | "mobile" | "hardware" | "backup";
export function Preparation({ profile, connected, onSettings, onMap, onMonitor, onPeople, check, focusAccess = false }: {
  profile: { id?: number; full_name: string; room: string } | null;
  connected: boolean;
  onSettings: (tab: SettingsEntry) => void;
  onMap: () => void;
  onMonitor: () => void;
  onPeople?: () => void;
  check?: PreparationCheck;
  focusAccess?: boolean;
}) {
  const local = isLoopback(window.location.hostname);
  const ownCheck = usePreparationStatus(!check);
  const { status, failed } = check ?? ownCheck;
  const [account,setAccount]=useState<string|null>(null);
  const [noticeFeedback,setNoticeFeedback]=useState("");
  const browserNotices=useBrowserNotices();
  const noticePermission=browserNotices.permission;
  const monitoring = status ? monitoringState(status,profile?.id) : null;
  const linked = monitoring?.linked;
  const differentAccount=!!account && !!status?.monitor_viewer_id && status.monitor_viewer_id !== account;
  const sessionTone=!monitoring ? "unknown" : !monitoring.active || differentAccount ? "pending" : !account || !status?.monitor_viewer_id ? "unknown" : "ready";
  const sessionLabel=!monitoring ? null : !monitoring.active ? "Sin sesión" : !account ? "Activa en la PC · verifica tu cuenta" : differentAccount ? "Otra cuenta en el puesto" : !status?.monitor_viewer_id ? "Activa · identidad del puesto sin verificar" : "Activa";
  const unknown = !local ? "Solo desde esta PC" : failed ? "No se pudo verificar" : "Comprobando";
  const access = () => { const target = document.getElementById("preparation-access"); target?.focus(); target?.scrollIntoView?.({ block: "start", behavior: "smooth" }); };
  useEffect(() => { if (focusAccess) access(); }, [focusAccess]);
  const marker = (state: "ready" | "pending" | "optional" | "unknown") => <span className={`preparation-state is-${state}`}>{state === "ready" ? <CircleCheck size={15}/> : state === "pending" ? <CircleAlert size={15}/> : state === "optional" ? <Minus size={15}/> : <CircleHelp size={15}/>}</span>;
  return <section className="sfa-preparation" aria-labelledby="preparation-title">
    <div className="preparation-heading"><div><p>Acceso y conexiones de esta PC</p><h1 id="preparation-title">Preparar la asistencia</h1></div>
      <button className="resident-button link-resident" onClick={onMonitor}>Ir al monitoreo<ArrowRight size={18} /></button></div>
    <dl className="preparation-status" aria-label="Estado de preparación">
      <div><dt><Cloud size={17} />Perfil por internet</dt><dd>{marker(!status ? "unknown" : linked ? "ready" : "pending")}{status ? linked ? "Vinculado" : "Sin vínculo habilitado" : unknown}</dd><button onClick={access}>Revisar vínculo<ArrowRight size={14}/></button></div>
      <div><dt><ShieldCheck size={17} />Sesión de consulta del puesto</dt><dd>{marker(sessionTone)}{sessionLabel ?? unknown}</dd><button onClick={access}>Revisar acceso<ArrowRight size={14}/></button></div>
      <div><dt><Bell size={17} />Avisos del navegador</dt><dd>{marker(browserNotices.enabled ? "ready" : "optional")}{browserNotices.enabled ? "Permiso concedido" : noticePermission === "granted" ? "Desactivados en este navegador" : noticePermission === "denied" ? "Bloqueados en el navegador" : noticePermission === "unsupported" ? "No disponibles" : "Sin permiso concedido"}</dd><button disabled={!browserNotices.supported} onClick={() => {if(browserNotices.enabled){setBrowserNotices(false);setNoticeFeedback("Avisos desactivados. Los incidentes siguen visibles en el panel.");}else void enableBrowserNotices().then(ok=>setNoticeFeedback(ok ? "Avisos habilitados mientras el panel permanezca abierto." : "Permiso no concedido; los incidentes siguen visibles.")).catch(()=>setNoticeFeedback("No se pudo solicitar el permiso del navegador."));}}>{browserNotices.enabled ? "Desactivar avisos en esta PC" : "Activar avisos en esta PC"}<Bell size={14}/></button></div>
    </dl>
    <div className="preparation-columns"><div className="preparation-access" id="preparation-access" tabIndex={-1}>
      {noticeFeedback && <p className="cloud-footnote" role="status">{noticeFeedback}</p>}
      {local ? <AccessApp embedded activeResidentId={profile?.id} onAccountChange={setAccount} onManagePeople={onPeople} /> : <section className="preparation-local-only"><ShieldCheck size={24} /><h2>Preparación desde la PC</h2><p>El vínculo y la sesión de envío se administran en localhost. No introduzcas credenciales en una conexión de red local sin confianza.</p><p>Abre «Preparar sistema» desde el Centro SFA en la PC del servidor.</p></section>}
    </div><nav className="preparation-actions" aria-label="Continuar la preparación">
      <h2>Continuar el cuidado</h2>
      <button onClick={onMap}><MapPin size={21} /><span><strong>Mapa y geocerca</strong><small>Consulta el GPS que comparte la persona desde Android.</small></span><ArrowRight size={18} /></button>
      <button onClick={onMonitor}><Bell size={21} /><span><strong>Incidentes y avisos de esta PC</strong><small>Revisa y atiende los incidentes en el panel principal.</small></span><ArrowRight size={18} /></button>
      <p>Consultar no comparte tu ubicación ni requiere «Reanudar envíos». La persona cuidada inicia su GPS desde Android.</p>
      <p>Los incidentes permanecen visibles en el panel aunque no concedas el permiso de notificaciones del navegador.</p>
      <details className="preparation-optional sfa-disclosure"><summary><Cable size={16}/><span>Emisión y dispositivos · opcional</span><ChevronRight className="disclosure-chevron" size={16}/></summary>
        <div><UserRound size={18}/><span><strong>Perfil local de esta PC</strong><small>{profile?.full_name || "Sin perfil seleccionado"} · {profile?.room}</small></span><button onClick={() => onSettings("residents")}>Gestionar</button></div>
        <div><Cable size={18}/><span><strong>Cinturón de esta PC</strong><small>{connected ? "Conectado" : "No conectado"} · independiente del GPS por internet</small></span><button onClick={() => onSettings("hardware")}>Revisar</button></div>
        <div><Cloud size={18}/><span><strong>Emisor FCM de esta PC</strong><small>{!status ? unknown : status.push?.last_error ? "Requiere revisión" : status.push?.configured ? "Configurado · recepción sin comprobar" : "Sin configurar"}</small></span><button onClick={() => onSettings("notifications")}>Revisar</button></div>
        <p>Un administrador prepara el emisor. Esto no es necesario para consultar el mapa o los incidentes con una cuenta de cuidador.</p>
      </details>
    </nav></div>
  </section>;
}
