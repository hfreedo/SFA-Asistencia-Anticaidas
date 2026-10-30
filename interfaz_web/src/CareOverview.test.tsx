// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CareLocationSummary, CareSignal, mergeCareActivity, recentPosition, validPosition, useRemoteHomePosition } from "./CareOverview";
import type { IncidentFeed } from "./IncidentWorkspace";
const now=Date.now();
const position={latitude:-25.3,longitude:-57.6,accuracy_m:8,observed_at:new Date(now).toISOString()};
const feed:IncidentFeed={events:[{id:"remote",event_type:"GEOCERCA_SALIDA",observed_at:position.observed_at,simulated:false,detail:{text:"Salida remota"},actor_id:null,outcome:null,updated_at:null}],zone:{state:"outside",last_confirmed:"outside",observed_at:position.observed_at},checkedAt:now,error:""};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe("person-first overview",()=>{
  it("removes the duplicate remedy only for remote GPS with a confirmed paused session",()=>{
    const props={residentId:7,source:"remote" as const,onSourceChange:vi.fn(),local:null,remote:{id:7,position:null,error:"Sin sesión"},feed,now,onMap:vi.fn(),onPrepare:vi.fn(),onRefresh:vi.fn()};
    const {rerender}=render(<CareLocationSummary {...props} connectionPaused/>);
    expect(screen.queryByRole("button",{name:"Revisar preparación"})).toBeNull();
    expect(screen.getByText("No se puede confirmar la ubicación actual.")).toBeTruthy();
    rerender(<CareLocationSummary {...props} connectionPaused={false}/>);
    expect(screen.getByRole("button",{name:"Revisar preparación"})).toBeTruthy();
  });
  it("validates GPS and never considers old or future coordinates live",()=>{
    expect(validPosition(position)).toBe(true);
    expect(validPosition({...position,latitude:100})).toBe(false);
    expect(validPosition({...position,accuracy_m:-1})).toBe(false);
    expect(recentPosition(position,now+91000)).toBe(false);
    expect(recentPosition(position,now-31000)).toBe(false);
  });
  it("merges only this resident's attributed local activity and remote events",()=>{
    const activity=mergeCareActivity([
      {id:"1",type:"SOS",detail:"Local",at:position.observed_at,residentId:7},
      {id:"2",type:"SOS",detail:"Otra persona",at:position.observed_at,residentId:9},
      {id:"3",type:"SOS",detail:"Sin identidad",at:position.observed_at},
      {id:"4",type:"SOS",detail:"Anterior",at:new Date(now-86400000).toISOString(),residentId:7},
    ],feed,7,now);
    expect(activity.map(e=>e.text).sort()).toEqual(["Local","Salida remota"]);
    expect(new Set(activity.map(e=>e.source))).toEqual(new Set(["PC local","Por internet"]));
    expect(mergeCareActivity([],feed,undefined,now)).toEqual([]);
  });
  it("uses remote GPS even when local GPS is absent and never announces global safety",()=>{
    const onSourceChange=vi.fn();
    render(<><CareLocationSummary residentId={7} source="remote" onSourceChange={onSourceChange} local={null} remote={{id:7,position,error:""}} feed={feed} now={now} onMap={vi.fn()} onPrepare={vi.fn()} onRefresh={vi.fn()}/><CareSignal connected fresh riskLabel="Movimiento estable" age={0} onPrepare={vi.fn()}/></>);
    expect(screen.getByText("Ubicación reciente recibida")).toBeTruthy();
    expect(screen.getByText("Fuera de la zona")).toBeTruthy();
    expect(screen.queryByText("Sin alertas activas")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Red local"}));
    expect(onSourceChange).toHaveBeenCalledWith("local");
  });
  it("does not use local GPS as a fallback for failed internet GPS",()=>{
    render(<CareLocationSummary residentId={7} source="remote" onSourceChange={vi.fn()} local={{resident_id:7,paired:true,status:"inside",age_seconds:0,position:{...position,distance_m:1,stable_state:"inside"},events:[]}} remote={{id:7,position:null,error:"Sin sesión"}} feed={feed} now={now} onMap={vi.fn()} onPrepare={vi.fn()} onRefresh={vi.fn()}/>);
    expect(screen.getByText("Ubicación sin verificar")).toBeTruthy();
    expect(screen.queryByText("Dentro de la zona")).toBeNull();
  });
  it("old zone evaluations are not shown as current even with fresh coordinates",()=>{
    render(<CareLocationSummary residentId={7} source="remote" onSourceChange={vi.fn()} local={null} remote={{id:7,position,error:""}} feed={{...feed,zone:{state:"inside",last_confirmed:"inside",observed_at:new Date(now-100000).toISOString()}}} now={now} onMap={vi.fn()} onPrepare={vi.fn()} onRefresh={vi.fn()}/>);
    expect(screen.getByText("Zona sin evaluación reciente")).toBeTruthy();
  });
  it("discards late GPS from the previous profile",async()=>{
    let resolveFirst!:(value:unknown)=>void;
    vi.stubGlobal("fetch",vi.fn((url:string)=> url.includes("/7/") ? new Promise(resolve=>{resolveFirst=resolve;}) : Promise.resolve({ok:true,json:async()=>({position:null})})));
    function Probe({id}:{id:number}){const {reading}=useRemoteHomePosition(id,true);return <span>{reading?.position ? String(reading.position.latitude) : "Sin coordenadas"}</span>;}
    const {rerender}=render(<Probe id={7}/>);
    rerender(<Probe id={9}/>);
    await act(async()=>resolveFirst({ok:true,json:async()=>({position})}));
    await waitFor(()=>expect(screen.getByText("Sin coordenadas")).toBeTruthy());
    expect(screen.queryByText(String(position.latitude))).toBeNull();
  });
});
