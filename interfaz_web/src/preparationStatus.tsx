import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";

export type PreparationStatus = {
  session_active: boolean;
  monitor_session_active?: boolean;
  monitor_viewer_id?: string|null;
  monitor_links?: { local_resident_id: number; resident_id: string }[];
  bindings: { local_resident_id: number; enabled: number | boolean }[];
  push?: { configured: boolean; last_error: string | null };
};
export type PreparationCheck = { status: PreparationStatus | null; failed: boolean };
export const isLoopback = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
export function monitoringState(status: PreparationStatus, id?: number) {
  const active=status.monitor_session_active ?? status.session_active;
  const linked=status.monitor_links !== undefined
    ? status.monitor_links.some(link=>link.local_resident_id===id)
    : status.bindings.some(link=>link.local_resident_id===id && Boolean(link.enabled));
  return {active,linked};
}
export function usePreparationStatus(enabled = true): PreparationCheck {
  const [check, setCheck] = useState<PreparationCheck>({ status: null, failed: false });
  useEffect(() => {
    if (!enabled || !isLoopback(window.location.hostname)) return;
    let active = true, pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch("/api/cloud/status", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const status: PreparationStatus = await response.json();
        if (!Array.isArray(status.bindings) || typeof status.session_active !== "boolean") throw new Error();
        if (active) setCheck({ status, failed: false });
      } catch { if (active) setCheck({ status: null, failed: true }); }
      finally { pending = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    window.addEventListener("focus", load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", load); };
  }, [enabled]);
  return check;
}
export function preparationIssues(check: PreparationCheck, id?: number) {
  const { status, failed } = check;
  if (!status) return { count: 0, unknown: true, label: failed ? "Preparación sin verificar" : "Comprobando preparación" };
  const {active,linked}=monitoringState(status,id);
  const count = Number(!id || !linked) + Number(!active);
  return { count, unknown: false, label: count ? `${count} acciones necesarias para consultar por internet` : "Consulta por internet preparada; entrega de avisos sin verificar" };
}
export function PreparationIndicator({ check, id }: { check: PreparationCheck; id?: number }) {
  const issue = preparationIssues(check, id);
  return <span className={`preparation-indicator ${issue.unknown ? "is-unknown" : issue.count ? "is-pending" : "is-ready"}`} role="status" aria-label={issue.label} title={issue.label}>
    {issue.unknown ? <CircleHelp size={15}/> : issue.count ? <CircleAlert size={15}/> : <CircleCheck size={15}/>}{issue.count > 0 && <b>{issue.count}</b>}
  </span>;
}
