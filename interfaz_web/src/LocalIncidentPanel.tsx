import { useCallback, useMemo } from "react";
import { IncidentWorkspace, type IncidentApi, type IncidentAttention, type IncidentFeed } from "./IncidentWorkspace";

export function LocalIncidentPanel({ residentId, visible=true, connectionPaused=false, onAttentionChange, onPrepare, onSnapshotChange }: { residentId?: number; visible?:boolean; connectionPaused?:boolean; onAttentionChange?:(summary:IncidentAttention)=>void; onPrepare?:()=>void; onSnapshotChange?:(id:number,value:IncidentFeed)=>void }) {
  const reportSnapshot = useCallback((value:IncidentFeed) => { if (residentId) onSnapshotChange?.(residentId,value); },[residentId,onSnapshotChange]);
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
  if (!residentId) return visible ? <section className="care-attention-zone"><h3>Incidentes y atención</h3><p>Selecciona a la persona cuidada para consultar sus incidentes.</p>{onPrepare && <button className="resident-button" onClick={onPrepare}>Preparar asistencia</button>}</section> : null;
  return <div className="care-attention-zone" hidden={!visible} style={!visible ? {display:"none"} : undefined}>
    <IncidentWorkspace key={residentId} api={api} compact connectionPaused={connectionPaused} onAttentionChange={onAttentionChange} onSnapshotChange={reportSnapshot} onPrepare={onPrepare}/></div>;
}
