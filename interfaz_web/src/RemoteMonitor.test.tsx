// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";

const mock = vi.hoisted(() => ({ responses: {} as Record<string, unknown> }));
function builder(value: unknown) {
  type Query = { select: () => Query; is: () => Query; order: () => Query; eq: () => Query; limit: () => Query; then: (resolve: (value: unknown) => unknown) => Promise<unknown> };
  const chain: Query = { select: () => chain, is: () => chain, order: () => chain, eq: () => chain, limit: () => chain,
    then: resolve => Promise.resolve(value).then(resolve) };
  return chain;
}
vi.mock("./accessClient", () => ({ accessDataClient: () => ({ from: (table: string) => builder(mock.responses[table]), rpc: () => Promise.resolve({ data: null, error: { code: "PGRST202" } }) }) }));
vi.mock("./IncidentPanel", () => ({ IncidentPanel: () => null }));
vi.mock("./RemoteGeofence", () => ({ RemoteGeofence: () => null }));
import { RemoteMonitor } from "./RemoteMonitor";

const session = { access_token: "PRIVATE_TEST_SESSION" } as Session;
beforeEach(() => {
  mock.responses = {
    sfa_residents: { data: [{ id: "fixture", full_name: "Residente de prueba", room: "Sala" }], error: null },
    sfa_pc_samples: { data: [], error: null },
    sfa_events: { data: [], error: null },
    sfa_positions: { data: [], error: null },
  };
});
afterEach(cleanup);
describe("remote monitoring", () => {
  it("never presents missing samples as a safe or connected device", async () => {
    const { container } = render(<RemoteMonitor session={session} spaces={[]} />);
    expect(await screen.findByText("Sin lecturas recientes")).toBeTruthy();
    expect(screen.queryByText("Movimiento estable")).toBeNull();
    expect(container.innerHTML).not.toContain("PRIVATE_TEST_SESSION");
  });
  it("delayed data is historical even if the upload arrived recently", async () => {
    mock.responses.sfa_pc_samples = { data: [{ id: "sample", observed_at: "2020-01-01T00:00:00Z", received_at: new Date().toISOString(), payload: { state: "NORMAL", accel_g: 1 } }], error: null };
    render(<RemoteMonitor session={session} spaces={[]} />);
    expect(await screen.findByText(/Última muestra:/)).toBeTruthy();
    expect(screen.getByText("Sin lecturas recientes")).toBeTruthy();
    expect(screen.queryByText("Movimiento estable")).toBeNull();
  });
  it("fresh critical states receive the emergency treatment", async () => {
    mock.responses.sfa_pc_samples = { data: [{ id: "sample", observed_at: new Date().toISOString(), received_at: new Date().toISOString(), payload: { state: "CAIDA_CONFIRMADA", accel_g: 3 } }], error: null };
    render(<RemoteMonitor session={session} spaces={[]} />);
    expect((await screen.findByText("Caída informada")).className).toContain("critical");
  });
  it("empty cloud directory does not manufacture a resident", async () => {
    mock.responses.sfa_residents = { data: [], error: null };
    render(<RemoteMonitor session={session} spaces={[]} />);
    expect(await screen.findByText("Aún no hay un perfil sincronizado")).toBeTruthy();
    expect(screen.queryByText("Residente de prueba")).toBeNull();
  });
  it("requires choosing the ficha instead of silently displaying the first of several", async () => {
    mock.responses.sfa_residents = { data: [{ id: "first", full_name: "Persona uno", room: "A" }, { id: "second", full_name: "Persona dos", room: "B" }], error: null };
    render(<RemoteMonitor session={session} spaces={[]} />);
    expect(await screen.findByText("Selecciona a quién quieres monitorear")).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByText("Aún no hay un perfil sincronizado")).toBeNull();
  });
});
