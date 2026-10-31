// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,render,screen} from "@testing-library/react";
import type {GpsReading} from "./CareOverview";
const access=vi.hoisted(()=>vi.fn());
vi.mock("./AccessApp",()=>({AccessApp:(props:unknown)=>{access(props);return <div>Acceso autorizado</div>;}}));
import {CloudPeople} from "./CloudPeople";
afterEach(()=>{cleanup();access.mockClear();});
it("shows the monitored identity without restricting the management directory to that ficha",()=>{
  render(<CloudPeople localId={7} reading={{remoteId:"remote-123456",remoteName:"Persona remota",remoteRoom:"Sala 2",remoteSpace:"space-B"} as GpsReading} onMap={vi.fn()}/>);
  expect(screen.getByText(/Sala 2 · Ref. remote-1/)).toBeTruthy();
  expect(screen.getByText("Persona monitoreada en esta PC")).toBeTruthy();
  expect(access.mock.lastCall?.[0]).toMatchObject({initialView:"people"});
  expect(access.mock.lastCall?.[0].suggestedPerson).toEqual({resident_id:"remote-123456",space_id:"space-B"});
  expect(access.mock.lastCall?.[0].personContext).toBeUndefined();
});
it("does not invent a remote context from incomplete or failed responses",()=>{
  const view=render(<CloudPeople localId={7} reading={{remoteId:"remote-123456",remoteName:"Persona remota"} as GpsReading} onMap={vi.fn()}/>);
  expect(access.mock.lastCall?.[0].personContext).toBeUndefined();
  view.rerender(<CloudPeople localId={7} reading={{remoteId:"remote-123456",remoteSpace:"space-B",error:"forbidden"} as GpsReading} onMap={vi.fn()}/>);
  expect(access.mock.lastCall?.[0].personContext).toBeUndefined();
  expect(screen.queryByRole("button",{name:"Ver su mapa y geocerca"})).toBeNull();
});
it("a transient GPS error only affects the monitoring preview, not the management directory",()=>{
  const identity={id:7,position:null,error:"",remoteId:"remote-123456",remoteName:"Persona remota",remoteSpace:"space-B"} as GpsReading;
  const view=render(<CloudPeople localId={7} reading={identity} onMap={vi.fn()}/>);
  view.rerender(<CloudPeople localId={7} reading={{id:7,position:null,error:"network"} as GpsReading} onMap={vi.fn()}/>);
  expect(access.mock.lastCall?.[0].personContext).toBeUndefined();
  expect(screen.getByText("Identidad previa · conexión por verificar")).toBeTruthy();
  expect((screen.getByRole("button",{name:"Ver su mapa y geocerca"}) as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<CloudPeople localId={9} reading={null} onMap={vi.fn()}/>);
  expect(access.mock.lastCall?.[0].personContext).toBeUndefined();
});
