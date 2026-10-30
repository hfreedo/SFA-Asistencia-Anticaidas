// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("./LocalCareLink", () => ({ LocalCareLink: () => <p>Monitorear una ficha existente</p> }));

const mock = vi.hoisted(() => ({
  getSession: vi.fn(), getUser: vi.fn(), signIn: vi.fn(), reset: vi.fn(), from: vi.fn(),
  dataClient: vi.fn(), rpc: vi.fn(), signOut: vi.fn(),
}));
vi.mock("./accessClient", () => ({
  configurationProblem: null,
  accessDataClient: mock.dataClient,
  accessClient: {
    auth: {
      getSession: mock.getSession, getUser: mock.getUser,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: mock.signIn, resetPasswordForEmail: mock.reset,
      signOut: mock.signOut,
    },
    from: mock.from,
  },
}));
import { AccessApp } from "./AccessApp";

beforeEach(() => {
  vi.clearAllMocks();
  mock.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mock.signIn.mockResolvedValue({ error: { message: "INTERNAL_PROVIDER_DETAIL" } });
  mock.reset.mockResolvedValue({ error: null });
  mock.signOut.mockResolvedValue({ error: null });
  mock.rpc.mockResolvedValue({ data: { accepted: 0 }, error: null });
  mock.dataClient.mockReturnValue({ from: mock.from, rpc: mock.rpc });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("SFA access screen", () => {
  it("does not describe a resident as a caregiver or expose team administration", async () => {
    mock.getSession.mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
    mock.getUser.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
    mock.from.mockImplementation((table: string) => table === "sfa_memberships"
      ? { select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: [{ space_id: "space", role: "resident" }], error: null }) }) }) }
      : { select: () => ({ in: () => Promise.resolve({ data: [{ id: "space", name: "Pruebas" }], error: null }) }) });
    render(<AccessApp embedded activeResidentId={7} />);
    expect(await screen.findByText(/Tu cuenta corresponde a una persona cuidada/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Personas y equipo" })).toBeNull();
    expect(screen.queryByText(/Tu acceso permite cuidar/)).toBeNull();
  });
  it("shows an accessible login without public registration", async () => {
    render(<AccessApp />);
    expect(await screen.findByLabelText("Correo electrónico")).toBeTruthy();
    expect(screen.getByLabelText("Contraseña")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /registrar/i })).toBeNull();
  });
  it("embeds the same verified access flow without a second navigation shell", async () => {
    render(<AccessApp embedded activeResidentId={7} />);
    expect(await screen.findByLabelText("Correo electrónico")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Acceso por internet" })).toBeTruthy();
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("link", { name: /SFA Asistencia, inicio/ })).toBeNull();
  });
  it("a caregiver can monitor an existing ficha but cannot create a PC emitter", async () => {
    mock.getSession.mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
    mock.getUser.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
    mock.from.mockImplementation((table: string) => table === "sfa_memberships"
      ? { select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: [{ space_id: "space", role: "caregiver" }], error: null }) }) }) }
      : { select: () => ({ in: () => Promise.resolve({ data: [{ id: "space", name: "Pruebas" }], error: null }) }) });
    render(<AccessApp embedded activeResidentId={7} />);
    expect(await screen.findByText("Monitorear una ficha existente")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Vincular y sincronizar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Personas y equipo" })).toBeNull();
  });
  it("caregiver logout pauses monitoring without stopping the PC emitter", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetcher);
    mock.getSession.mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
    mock.getUser.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
    mock.from.mockImplementation((table: string) => table === "sfa_memberships"
      ? { select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: [{ space_id: "space", role: "caregiver" }], error: null }) }) }) }
      : { select: () => ({ in: () => Promise.resolve({ data: [{ id: "space", name: "Pruebas" }], error: null }) }) });
    render(<AccessApp embedded activeResidentId={7}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(mock.signOut).toHaveBeenCalled());
    expect(fetcher).toHaveBeenCalledWith("/api/cloud/monitor/pause", { method: "POST" });
    expect(fetcher.mock.calls.some(call => call[0] === "/api/cloud/pause")).toBe(false);
  });
  it("embedded recovery keeps the existing authorized portal return path", async () => {
    render(<AccessApp embedded />);
    fireEvent.click(await screen.findByRole("button", { name: "Olvidé mi contraseña" }));
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "test@example.invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
    await waitFor(() => expect(mock.reset).toHaveBeenCalledWith("test@example.invalid", {
      redirectTo: `${window.location.origin}/acceso/acceso.html?flow=recovery`,
    }));
  });
  it("an embedded admin binds the selected profile and pauses before logout without changing URL", async () => {
    const originalUrl = window.location.href;
    const fetcher = vi.fn(async (path: string) => ({ ok: true, json: async () => path === "/api/residents"
      ? [{ id: 7, full_name: "Perfil seleccionado", room: "Sala", is_active: 1 }]
      : { session_active: false, bindings: [], pending: 0, sent: 0, blocked: 0 } }));
    vi.stubGlobal("fetch", fetcher);
    mock.getSession.mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
    mock.getUser.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
    mock.from.mockImplementation((table: string) => table === "sfa_memberships"
      ? { select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: [{ space_id: "space", role: "admin" }], error: null }) }) }) }
      : { select: () => ({ in: () => Promise.resolve({ data: [{ id: "space", name: "Pruebas" }], error: null }) }) });
    render(<AccessApp embedded activeResidentId={7} />);
    await screen.findByRole("option", { name: /Perfil seleccionado/ });
    expect(screen.queryByText("Monitoreo remoto")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await screen.findByRole("button", { name: "Iniciar sesión" });
    expect(fetcher).toHaveBeenCalledWith("/api/cloud/pause", { method: "POST" });
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
    const pauseCall = fetcher.mock.calls.findIndex(call => call[0] === "/api/cloud/pause");
    expect(fetcher.mock.invocationCallOrder[pauseCall]).toBeLessThan(mock.signOut.mock.invocationCallOrder[0]);
    expect(window.location.href).toBe(originalUrl);
  });

  it("submits credentials only through the auth adapter and sanitizes errors", async () => {
    render(<AccessApp />);
    fireEvent.change(await screen.findByLabelText("Correo electrónico"), { target: { value: "test@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "test-password-value" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() => expect(mock.signIn).toHaveBeenCalledWith({ email: "test@example.invalid", password: "test-password-value" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("INTERNAL_PROVIDER_DETAIL")).toBeNull();
    expect((screen.getByLabelText("Contraseña") as HTMLInputElement).value).toBe("");
  });

  it("recovery feedback does not disclose whether an account exists", async () => {
    render(<AccessApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Olvidé mi contraseña" }));
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "test@example.invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText(/Si la cuenta está habilitada/)).toBeTruthy();
    expect(mock.reset.mock.calls[0][1].redirectTo).not.toContain("access_token");
  });

  it("a verified account without membership is not presented as an administrator", async () => {
    mock.getSession.mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
    mock.getUser.mockResolvedValue({ data: { user: { id: "test-user", email: "test@example.invalid" } }, error: null });
    mock.from.mockReturnValue({ select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: [], error: null }) }) }) });
    render(<AccessApp />);
    expect(await screen.findByText(/aún no tiene un espacio asignado/)).toBeTruthy();
    expect(mock.dataClient).toHaveBeenCalledWith("test-session");
    expect(screen.queryByText("Administrador")).toBeNull();
  });

  it("a permissions failure does not show an authorized account", async () => {
    mock.getSession.mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
    mock.getUser.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
    mock.from.mockReturnValue({ select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: null, error: {} }) }) }) });
    render(<AccessApp />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Identidad y permisos verificados.")).toBeNull();
  });

  it("a saved session is not trusted when identity verification is offline", async () => {
    mock.getSession.mockResolvedValue({ data: { session: { access_token: "old-session" } }, error: null });
    mock.getUser.mockRejectedValue(new TypeError("Network unavailable"));
    render(<AccessApp />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mock.from).not.toHaveBeenCalled();
    expect(mock.dataClient).not.toHaveBeenCalled();
    expect(screen.queryByText("Identidad y permisos verificados.")).toBeNull();
  });

  it("accepts pending invitations with the verified identity before reading memberships", async () => {
    mock.getSession.mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
    mock.getUser.mockResolvedValue({ data: { user: { id: "test-user", email: "test@example.invalid" } }, error: null });
    mock.from.mockReturnValue({ select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: [], error: null }) }) }) });
    render(<AccessApp />);
    await screen.findByText(/aún no tiene un espacio asignado/);
    expect(mock.rpc).toHaveBeenCalledWith("sfa_accept_team_invites");
    expect(mock.getUser.mock.invocationCallOrder[0]).toBeLessThan(mock.rpc.mock.invocationCallOrder[0]);
    expect(mock.rpc.mock.invocationCallOrder[0]).toBeLessThan(mock.from.mock.invocationCallOrder[0]);
  });

  it("does not break the previous portal when the team migration has not been applied", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    mock.getSession.mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
    mock.getUser.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
    mock.from.mockReturnValue({ select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: [], error: null }) }) }) });
    render(<AccessApp />); expect(await screen.findByText(/aún no tiene un espacio asignado/)).toBeTruthy();
  });

  it("session initialization failures leave a usable error instead of a loading loop", async () => {
    mock.getSession.mockRejectedValue(new TypeError("Network unavailable"));
    render(<AccessApp />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeTruthy();
  });
});
