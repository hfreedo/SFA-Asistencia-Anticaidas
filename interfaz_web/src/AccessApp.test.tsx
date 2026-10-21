// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mock = vi.hoisted(() => ({
  getSession: vi.fn(), getUser: vi.fn(), signIn: vi.fn(), reset: vi.fn(), from: vi.fn(),
  dataClient: vi.fn(),
}));
vi.mock("./accessClient", () => ({
  configurationProblem: null,
  accessDataClient: mock.dataClient,
  accessClient: {
    auth: {
      getSession: mock.getSession, getUser: mock.getUser,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: mock.signIn, resetPasswordForEmail: mock.reset,
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
  mock.dataClient.mockReturnValue({ from: mock.from });
});
afterEach(cleanup);

describe("SFA access screen", () => {
  it("shows an accessible login without public registration", async () => {
    render(<AccessApp />);
    expect(await screen.findByLabelText("Correo electrónico")).toBeTruthy();
    expect(screen.getByLabelText("Contraseña")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /registrar/i })).toBeNull();
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

  it("session initialization failures leave a usable error instead of a loading loop", async () => {
    mock.getSession.mockRejectedValue(new TypeError("Network unavailable"));
    render(<AccessApp />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeTruthy();
  });
});
