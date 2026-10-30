// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ rows: vi.fn(), fetch: vi.fn() }));
vi.mock("./accessClient", () => ({ accessDataClient: () => ({ from: () => ({ select: () => ({ is: () => ({ order: mocks.rows }) }) }) }) }));
import { LocalCareLink } from "./LocalCareLink";
const session = { access_token: "PRIVATE_JWT" } as Session;
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.clearAllMocks(); vi.stubGlobal("fetch", mocks.fetch);
  mocks.rows.mockResolvedValue({ data: [{ id: "remote-person", full_name: "Persona autorizada", room: "Sala" }], error: null });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ linked: true, remote_resident_id: "remote-person" }) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("restores only the saved authorized identity without confirming or writing again", async () => {
  mocks.fetch.mockImplementation(async (url:string) => ({ok:true,json:async()=>url==="/api/cloud/status" ? {monitor_session_active:true,monitor_links:[{local_resident_id:9,resident_id:"remote-person"}]} : {}}));
  render(<LocalCareLink session={session} localId={9}/>);
  expect(await screen.findByText("Ficha que consultas con esta cuenta")).toBeTruthy();
  expect(screen.getByText("Persona autorizada")).toBeTruthy();
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Cambiar ficha"}));
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole("button",{name:"Vincular monitoreo"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"Conservar vínculo actual"}));
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(mocks.fetch.mock.calls.some(call=>call[0]==="/api/cloud/monitor")).toBe(false);
});
it.each(["unauthorized-person", "other-account-person"])("does not restore a saved identity absent from authorized rows: %s", async resident_id => {
  mocks.fetch.mockImplementation(async (url:string) => ({ok:true,json:async()=>url==="/api/cloud/status" ? {monitor_session_active:true,monitor_links:[{local_resident_id:9,resident_id}]} : {}}));
  render(<LocalCareLink session={session} localId={9}/>);
  await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledWith("/api/cloud/status",expect.anything()));
  expect(screen.queryByText("Ficha que consultas con esta cuenta")).toBeNull();
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
});
it("requires explicit selection and confirmation without creating a remote profile", async () => {
  const { container } = render(<LocalCareLink session={session} localId={9}/>);
  await waitFor(() => expect(mocks.rows).toHaveBeenCalled());
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: /Persona autorizada/ }));
  expect(mocks.fetch.mock.calls.some(call => call[0] === "/api/cloud/monitor")).toBe(false);
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith("/api/cloud/monitor", expect.objectContaining({ body: JSON.stringify({ local_resident_id: 9, remote_resident_id: "remote-person" }) })));
  expect((await screen.findByRole("status")).textContent).toContain("Monitoreo vinculado");
  expect(container.innerHTML).not.toContain("PRIVATE_JWT");
});
it("does not present a rejected authorization as connected", async () => {
  mocks.fetch.mockResolvedValue({ ok: false });
  render(<LocalCareLink session={session} localId={9}/>);
  await waitFor(() => expect(mocks.rows).toHaveBeenCalled());
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: /Persona autorizada/ }));
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button"));
  expect((await screen.findByRole("alert")).textContent).toContain("No se pudo verificar");
  expect(screen.queryByText(/Monitoreo vinculado/)).toBeNull();
});
it("puts a failed consultation before the controls and never describes it as success", async () => {
  mocks.fetch.mockResolvedValue({ ok: false });
  render(<LocalCareLink session={session} localId={9}/>);
  const warning=await screen.findByRole("alert");
  expect(warning.textContent).toContain("No se pudo habilitar la consulta");
  expect(warning.compareDocumentPosition(screen.getByRole("combobox")) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  expect(screen.queryByRole("status")).toBeNull();
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
});
it("changing the selected person resets confirmation without saving a link", async () => {
  mocks.rows.mockResolvedValue({data:[{id:"one",full_name:"Persona Uno",room:"A"},{id:"two",full_name:"Persona Dos",room:"B"}],error:null});
  render(<LocalCareLink session={session} localId={9}/>);
  fireEvent.keyDown(screen.getByRole("combobox"),{key:"Enter"});
  fireEvent.click(await screen.findByRole("option",{name:/Persona Uno/}));
  fireEvent.click(screen.getByRole("checkbox"));
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  fireEvent.keyDown(screen.getByRole("combobox"),{key:"Enter"});
  fireEvent.click(await screen.findByRole("option",{name:/Persona Dos/}));
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.fetch.mock.calls.some(call=>call[0]==="/api/cloud/monitor")).toBe(false);
});
it("blocks linking to an older server without blaming caregiver permissions",async()=>{
  mocks.fetch.mockResolvedValue({ok:false,status:404});
  render(<LocalCareLink session={session} localId={9}/>);
  expect((await screen.findByRole("alert")).textContent).toContain("servidor activo no incluye");
  fireEvent.keyDown(screen.getByRole("combobox"),{key:"Enter"});
  fireEvent.click(await screen.findByRole("option",{name:/Persona autorizada/}));
  fireEvent.click(screen.getByRole("checkbox"));
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.fetch.mock.calls.some(call=>call[0]==="/api/cloud/monitor")).toBe(false);
});
