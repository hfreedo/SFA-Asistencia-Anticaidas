import { useMemo } from "react";
import { IncidentWorkspace, type IncidentApi, type IncidentAttention } from "./IncidentWorkspace";

export function LocalIncidentPanel({ residentId, visible=true, onAttentionChange }: { residentId?: number; visible?:boolean; onAttentionChange?:(summary:IncidentAttention)=>void }) {
  const api = useMemo<IncidentApi>(() => {
    const request = async (path: string, body?: object) => {
      const response = await fetch(`/api/cloud/residents/${residentId}/incidents${path}`, { cache:"no-store", ...(body ? {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
      } : {}) });
      if (!response.ok) throw {status:response.status};
      return response.json();
    };
    return {load:()=>request(""), attend:async(id, expected, outcome)=> { await request(`/${id}/attention`,{p_expected:expected,p_outcome:outcome}); }};
  }, [residentId]);
  if (!residentId) return null;
  return <div hidden={!visible} style={!visible ? {display:"none"} : undefined}><div className="local-incident-access"><span>Incidentes por internet del perfil seleccionado</span><a href="/acceso/acceso.html" target="_blank" rel="noopener noreferrer">Acceso y sincronización de esta PC</a></div>
    <IncidentWorkspace key={residentId} api={api} compact onAttentionChange={onAttentionChange}/></div>;
}
