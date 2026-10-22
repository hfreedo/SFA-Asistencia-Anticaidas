// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), client: vi.fn() }));
vi.mock("./accessClient", () => ({ accessDataClient: mock.client }));
import { IncidentPanel } from "./IncidentPanel";
const session = { access_token: "PRIVATE_FIXTURE", user: { id: "caregiver" } } as Session;
const incident = { id: "event", event_type: "PRUEBA_SOS", observed_at: "2026-10-21T12:00:00Z", simulated: true,
  detail: {}, actor_id: null, outcome: null, updated_at: null };
beforeEach(() => {
  vi.clearAllMocks();
  mock.client.mockReturnValue({ rpc: mock.rpc });
  mock.rpc.mockResolvedValue({ data: { can_attend: true, events: [incident] }, error: null });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("labels tests explicitly and never exposes the session", async () => {
  const { container } = render(<IncidentPanel resident="person" session={session} />);
  await screen.findByText("PRUEBA · No es una emergencia");
  expect(container.innerHTML).not.toContain("PRIVATE_FIXTURE");
});
it("takes attention using the server revision", async () => {
  render(<IncidentPanel resident="person" session={session} />);
  fireEvent.click(await screen.findByRole("button", { name: "Tomar atención" }));
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("sfa_attend_incident", {
    p_event: "event", p_expected: null, p_outcome: "attending",
  }));
  expect(await screen.findByText(/Atención tomada/)).toBeTruthy();
});
it("read-only people have no attention commands", async () => {
  mock.rpc.mockResolvedValue({ data: { can_attend: false, events: [incident] }, error: null });
  render(<IncidentPanel resident="person" session={session} />);
  await screen.findByText("Prueba SOS entre dispositivos");
  expect(screen.queryByRole("button", { name: "Tomar atención" })).toBeNull();
});
it("only the attending owner can resolve, with confirmation", async () => {
  mock.rpc.mockResolvedValue({ data: { can_attend: true, events: [{ ...incident,
    actor_id: "caregiver", outcome: "attending", updated_at: "revision" }] }, error: null });
  render(<IncidentPanel resident="person" session={session} />);
  fireEvent.click(await screen.findByRole("button", { name: "Atención realizada" }));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  expect(mock.rpc.mock.calls.some(call => call[0] === "sfa_attend_incident")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar resolución" }));
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("sfa_attend_incident", {
    p_event: "event", p_expected: "revision", p_outcome: "attended",
  }));
});
it("another caregiver cannot resolve the owner's attention", async () => {
  mock.rpc.mockResolvedValue({ data: { can_attend: true, events: [{ ...incident,
    actor_id: "other", outcome: "attending" }] }, error: null });
  render(<IncidentPanel resident="person" session={session} />);
  await screen.findByText("En atención por otro cuidador");
  expect(screen.queryByRole("button", { name: "Atención realizada" })).toBeNull();
});
it("failed refresh clears old actionable data", async () => {
  render(<IncidentPanel resident="person" session={session} />);
  await screen.findByRole("button", { name: "Tomar atención" });
  mock.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  fireEvent.click(screen.getByRole("button", { name: "Actualizar incidentes" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Tomar atención" })).toBeNull();
});
it("real pending exits remain visibly actionable without browser notification support", async () => {
  vi.stubGlobal("Notification",undefined);
  mock.rpc.mockResolvedValue({data:{can_attend:true,events:[{...incident,event_type:"GEOCERCA_SALIDA",simulated:false}]},error:null});
  render(<IncidentPanel resident="person" session={session} />);
  expect(await screen.findByRole("alert",{name:"Atención pendiente"})).toBeTruthy();
  expect(screen.getByRole("button",{name:"Tomar atención"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Activar avisos en esta PC"})).toBeNull();
});
it("a transient connection failure cannot dismiss a previously received pending incident", async () => {
  mock.rpc.mockResolvedValue({data:{can_attend:true,events:[{...incident,event_type:"GEOCERCA_SALIDA",simulated:false}]},error:null});
  render(<IncidentPanel resident="person" session={session} />);
  await screen.findByRole("alert",{name:"Atención pendiente"});
  mock.rpc.mockResolvedValue({data:null,error:{code:"network"}});
  fireEvent.click(screen.getByRole("button",{name:"Actualizar incidentes"}));
  await screen.findByText(/No se pudieron actualizar/);
  expect(screen.getByRole("alert",{name:"Atención pendiente"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Tomar atención"})).toBeNull();
});
it("gives geofence exits the same priority treatment as real SOS and keeps tests secondary", async () => {
  mock.rpc.mockResolvedValue({data:{can_attend:true,events:[incident,
    {...incident,id:"exit",event_type:"GEOCERCA_SALIDA",simulated:false},
    {...incident,id:"sos",event_type:"SOS",simulated:false}]},error:null});
  const {container}=render(<IncidentPanel resident="person" session={session}/>);
  const alert=await screen.findByRole("alert",{name:"Atención pendiente"});
  expect(alert.textContent).toContain("Geocerca 1");
  expect(alert.textContent).toContain("SOS 1");
  expect(container.querySelectorAll(".incident-row.is-priority")).toHaveLength(2);
  expect(container.querySelector(".incident-row")?.classList.contains("is-priority")).toBe(true);
  expect(container.querySelectorAll(".incident-row.is-test")).toHaveLength(1);
});
it("refreshes immediately on focus instead of waiting for the next poll", async () => {
  render(<IncidentPanel resident="person" session={session}/>);
  await screen.findByText("Prueba SOS entre dispositivos");
  const before=mock.rpc.mock.calls.length;
  fireEvent.focus(window);
  await waitFor(()=>expect(mock.rpc.mock.calls.length).toBe(before+1));
});
it("uses existing browser consent for newly received geofence notifications", async () => {
  const deliver=vi.fn();
  class BrowserNotification {
    static permission="granted";
    constructor(title:string, options:unknown) {deliver(title,options);}
  }
  vi.stubGlobal("Notification",BrowserNotification);
  vi.stubGlobal("isSecureContext",true);
  mock.rpc.mockResolvedValue({data:{can_attend:true,events:[]},error:null});
  render(<IncidentPanel resident="person" session={session}/>);
  await screen.findByText(/No hay incidentes/);
  expect(screen.getByRole("button",{name:"Desactivar avisos en esta PC"})).toBeTruthy();
  mock.rpc.mockResolvedValue({data:{can_attend:true,events:[{...incident,event_type:"GEOCERCA_SALIDA",simulated:false,observed_at:new Date().toISOString()}]},error:null});
  fireEvent.focus(window);
  await waitFor(()=>expect(deliver).toHaveBeenCalledWith("SFA · Salida de geocerca",expect.objectContaining({tag:"event"})));
});
