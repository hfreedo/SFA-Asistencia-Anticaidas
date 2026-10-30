// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
vi.mock("./accessClient", () => ({ accessDataClient: vi.fn() }));
import { LocalSync } from "./RemoteMonitor";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const session = { access_token: "TEST_SESSION_NOT_FOR_DISPLAY" } as Session;
const spaces = [{ space_id: "space", name: "Pruebas", role: "admin" }];
describe("local profile binding", () => {
  function fixture(bindings: object[], sessionActive = true) {
    const fetcher = vi.fn(async (path: string) => ({ ok: true, json: async () => path === "/api/residents"
      ? [{ id: 9, full_name: "Persona seleccionada", room: "B", is_active: 1 }]
      : { session_active: sessionActive, bindings, pending: 0, sent: 12, blocked: 0 } }));
    vi.stubGlobal("fetch", fetcher);
    return fetcher;
  }
  it("restores a saved enabled binding on every visit without asking for new consent", async () => {
    const fetcher = fixture([{ local_resident_id: 9, space_id: "space", enabled: 1 }]);
    const first = render(<LocalSync session={session} spaces={spaces} activeResidentId={9} />);
    await screen.findByText("Vínculo de este perfil guardado");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Vincular y sincronizar" })).toBeNull();
    expect((screen.getByRole("button", { name: "Reanudar envíos" }) as HTMLButtonElement).disabled).toBe(false);
    first.unmount();
    render(<LocalSync session={session} spaces={spaces} activeResidentId={9} />);
    await screen.findByText("Vínculo de este perfil guardado");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(fetcher.mock.calls.every(call => !call[0].endsWith("/connect"))).toBe(true);
  });
  it("does not treat a disabled binding as authorized", async () => {
    fixture([{ local_resident_id: 9, space_id: "space", enabled: 0 }]);
    render(<LocalSync session={session} spaces={spaces} activeResidentId={9} />);
    expect((await screen.findByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByText("Vínculo de este perfil guardado")).toBeNull();
    expect((screen.getByRole("button", { name: "Reanudar envíos" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("does not carry a saved binding or draft consent to a different space", async () => {
    fixture([{ local_resident_id: 9, space_id: "space", enabled: 1 }]);
    render(<LocalSync session={session} spaces={[...spaces, { space_id: "other", name: "Otro espacio", role: "admin" }, { space_id: "third", name: "Tercer espacio", role: "admin" }]} activeResidentId={9} />);
    await screen.findByText("Vínculo de este perfil guardado");
    fireEvent.change(screen.getByLabelText("Espacio autorizado"), { target: { value: "other" } });
    expect(screen.queryByText("Vínculo de este perfil guardado")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByLabelText("Espacio autorizado"), { target: { value: "third" } });
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    fireEvent.change(screen.getByLabelText("Espacio autorizado"), { target: { value: "other" } });
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });
  it("does not infer consent when the saved state cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async (path: string) => ({ ok: path === "/api/residents", status: 503, json: async () => path === "/api/residents" ? [{ id: 9, full_name: "Prueba", is_active: 1 }] : {} })));
    render(<LocalSync session={session} spaces={spaces} activeResidentId={9} />);
    await screen.findByText("No se pudo consultar la sincronización local.");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText("Vínculo de este perfil guardado")).toBeNull();
  });
  it("requires explicit consent and only binds the selected active person", async () => {
    const fetcher = vi.fn(async (path: string) => ({ ok: true, json: async () => path === "/api/residents" ? [
      { id: 7, full_name: "Primera persona", room: "A", is_active: 1 },
      { id: 9, full_name: "Persona seleccionada", room: "B", is_active: 1 },
    ] : { session_active: false, bindings: [{ local_resident_id: 7 }], pending: 0, sent: 0, blocked: 0 } }));
    vi.stubGlobal("fetch", fetcher);
    const { container } = render(<LocalSync session={session} spaces={spaces} activeResidentId={9} />);
    await screen.findByRole("option", { name: /Persona seleccionada/ });
    expect(screen.queryByRole("option", { name: /Primera persona/ })).toBeNull();
    const connect = screen.getByRole("button", { name: "Vincular y sincronizar" }) as HTMLButtonElement;
    expect(connect.disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Reanudar envíos" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(connect);
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith("/api/cloud/connect", expect.objectContaining({ body: JSON.stringify({ resident_id: 9, space_id: "space", consent: true }) })));
    expect(container.textContent).not.toContain(session.access_token);
  });
});
