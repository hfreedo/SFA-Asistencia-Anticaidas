// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), client: vi.fn() }));
vi.mock("./accessClient", () => ({ accessDataClient: mock.client }));
import { TeamPanel } from "./TeamPanel";
const session = { access_token: "PRIVATE_SESSION_FIXTURE", user: { id: "admin" } } as Session;
const spaces = [{ space_id: "space-a", name: "Equipo A", role: "admin" }];
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.clearAllMocks();
  mock.rpc.mockImplementation(async (name: string) => name === "sfa_team" ? { data: { members: [
    { user_id: "admin", email: "admin@example.invalid", role: "admin", access: [] },
    { user_id: "caregiver", email: "care@example.invalid", role: "caregiver", access: [{ resident_id: "person-a", can_configure: false, can_share_location: false }] },
  ], invitations: [] }, error: null } : { data: { updated: true }, error: null });
  mock.invoke.mockResolvedValue({ data: { invitation_id: "invite", mail_sent: true }, error: null });
  mock.client.mockReturnValue({ rpc: mock.rpc, functions: { invoke: mock.invoke }, from: () => ({ select: () => ({ eq: () => ({ is: () => ({ order: () => Promise.resolve({ data: [{ id: "person-a", full_name: "Persona A" }, { id: "person-b", full_name: "Persona B" }], error: null }) }) }) }) }) });
});
afterEach(cleanup);
it("caregivers cannot open team administration or cause data requests", () => {
  render(<TeamPanel session={session} spaces={[{ ...spaces[0], role: "caregiver" }]} onAccessChanged={() => {}} />);
  expect(screen.getByRole("alert")).toBeTruthy(); expect(mock.client).not.toHaveBeenCalled();
});
it("administrator sees assigned members without exposing session and cannot revoke self through UI", async () => {
  const { container } = render(<TeamPanel session={session} spaces={spaces} onAccessChanged={() => {}} />);
  await screen.findByText("admin@example.invalid");
  expect(container.innerHTML).not.toContain("PRIVATE_SESSION_FIXTURE");
  expect((screen.getAllByRole("button", { name: "Revocar" })[0] as HTMLButtonElement).disabled).toBe(true);
});
it("invites carry explicit role, space, resident and independent GPS capability", async () => {
  render(<TeamPanel session={session} spaces={spaces} onAccessChanged={() => {}} />);
  await screen.findByLabelText("Persona A");
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "new@example.invalid" } });
  fireEvent.click(screen.getByLabelText("Persona A"));
  fireEvent.click(screen.getByLabelText("Permitir vincular un celular de esta cuenta como emisor GPS"));
  fireEvent.click(screen.getByRole("button", { name: "Crear invitación" }));
  await waitFor(() => expect(mock.invoke).toHaveBeenCalledWith("sfa-team-invite", {
    headers: { Authorization: "Bearer PRIVATE_SESSION_FIXTURE" },
    body: { space_id: "space-a", email: "new@example.invalid", role: "caregiver", resident_ids: ["person-a"], can_configure: false, can_share_location: true },
  }));
  expect(await screen.findByText(/Invitación guardada y correo enviado/)).toBeTruthy();
});
it("administrator invitation requires explicit confirmation", async () => {
  render(<TeamPanel session={session} spaces={spaces} onAccessChanged={() => {}} />);
  await screen.findByLabelText("Persona A");
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "new@example.invalid" } });
  fireEvent.keyDown(screen.getByLabelText("Rol"), { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: "Administrador" }));
  fireEvent.click(screen.getByRole("button", { name: "Crear invitación" }));
  expect(await screen.findByRole("alertdialog")).toBeTruthy(); expect(mock.invoke).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(mock.invoke).toHaveBeenCalled());
  expect(mock.invoke.mock.calls[0][1].body).toMatchObject({ role: "admin", resident_ids: [], can_configure: false, can_share_location: false });
});
it("mail service failure is shown separately from a stored invitation", async () => {
  mock.invoke.mockResolvedValue({ data: { invitation_id: "invite", mail_sent: false }, error: null });
  render(<TeamPanel session={session} spaces={spaces} onAccessChanged={() => {}} />);
  await screen.findByLabelText("Persona A");
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "new@example.invalid" } });
  fireEvent.click(screen.getByLabelText("Persona A")); fireEvent.click(screen.getByRole("button", { name: "Crear invitación" }));
  expect(await screen.findByText(/no se confirmó el envío del correo/)).toBeTruthy();
});
it("revocation uses the restricted command only after confirmation", async () => {
  render(<TeamPanel session={session} spaces={spaces} onAccessChanged={() => {}} />);
  await screen.findByText("care@example.invalid");
  fireEvent.click(screen.getAllByRole("button", { name: "Revocar" })[1]);
  expect(await screen.findByRole("alertdialog")).toBeTruthy();
  expect(mock.rpc.mock.calls.some(call => call[0] === "sfa_revoke_team_member")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("sfa_revoke_team_member", { p_space: "space-a", p_user: "caregiver" }));
  expect(await screen.findByText(/Los registros se conservan/)).toBeTruthy();
});

it("person view describes care separately from personal identity and uses a single-choice ficha", async () => {
  render(<TeamPanel session={session} spaces={spaces} initialSection="people" initialResidentId="person-a" onAccessChanged={() => {}}/>);
  await screen.findByText("care@example.invalid");
  expect(screen.getByText("Cuidadores asignados")).toBeTruthy();
  expect(screen.getByText("Cuenta de la persona")).toBeTruthy();
  expect(screen.queryByLabelText("Correo electrónico")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Dar acceso a esta persona" }));
  expect(screen.getByText("Ficha a la que corresponde esta cuenta")).toBeTruthy();
  expect((screen.getByLabelText("Persona A") as HTMLInputElement).checked).toBe(true);
  expect(screen.getAllByRole("radio")).toHaveLength(2);
  fireEvent.click(screen.getByLabelText("Persona B"));
  expect((screen.getByLabelText("Persona A") as HTMLInputElement).checked).toBe(false);
  expect((screen.getByLabelText("Persona B") as HTMLInputElement).checked).toBe(true);
  expect(mock.invoke).not.toHaveBeenCalled();
});
it("context from an unauthorized space never falls back to another administered space", () => {
  render(<TeamPanel session={session} spaces={spaces} initialSpaceId="other-space" initialResidentId="other-person" onAccessChanged={() => {}}/>);
  expect(screen.getByRole("status").textContent).toContain("No se mostrarán asignaciones de otro espacio");
  expect(mock.client).not.toHaveBeenCalled();
});
it("missing context person is not replaced by the first available person", async () => {
  render(<TeamPanel session={session} spaces={spaces} initialSection="people" initialResidentId="missing" onAccessChanged={() => {}}/>);
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Añadir cuidador" })).toBeNull();
  expect(mock.invoke).not.toHaveBeenCalled();
});

it("failed consultation never implies an empty team or a missing linked person", async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
  render(<TeamPanel session={session} spaces={spaces} initialSection="people" initialResidentId="person-a" onAccessChanged={() => {}}/>);
  await screen.findByText(/No se pudo consultar el equipo/);
  expect(screen.queryByText(/La ficha vinculada no está disponible/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Equipo y accesos" }));
  expect(screen.queryByText("Sin invitaciones pendientes.")).toBeNull();
  expect(screen.getByRole("button", { name: "Reintentar consulta" })).toBeTruthy();
});
it("reports pending invitations as space-wide without guessing a person's identity", async () => {
  mock.rpc.mockResolvedValue({ data: { members: [], invitations: [{ id: "invite", email: "other@example.invalid", role: "resident", expires_at: "2030-01-01T00:00:00Z" }] }, error: null });
  render(<TeamPanel session={session} spaces={spaces} initialSection="people" initialResidentId="person-a" onAccessChanged={() => {}}/>);
  expect(await screen.findByText(/Hay 1 invitación pendiente en el espacio/)).toBeTruthy();
  expect(screen.getByText(/no permite confirmar a qué ficha corresponden/)).toBeTruthy();
  expect(screen.queryByText("other@example.invalid")).toBeNull();
});
it("keeps an open draft when navigation is cancelled", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<TeamPanel session={session} spaces={spaces} initialSection="people" initialResidentId="person-a" onAccessChanged={() => {}}/>);
  await screen.findByText("care@example.invalid");
  fireEvent.click(screen.getByRole("button", { name: "Dar acceso a esta persona" }));
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "draft@example.invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Equipo y accesos" }));
  expect((screen.getByLabelText("Correo electrónico") as HTMLInputElement).value).toBe("draft@example.invalid");
  expect(mock.invoke).not.toHaveBeenCalled();
  confirm.mockRestore();
});
it("assigning an existing caregiver preserves other residents and waits for explicit save", async () => {
  render(<TeamPanel session={session} spaces={spaces} initialSection="people" initialResidentId="person-b" onAccessChanged={() => {}}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Añadir cuidador" }));
  fireEvent.keyDown(screen.getByLabelText("Elegir una cuenta existente"), { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: "care@example.invalid" }));
  expect((screen.getByLabelText("Persona A") as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText("Persona B") as HTMLInputElement).checked).toBe(true);
  expect(mock.rpc.mock.calls.some(call => call[0] === "sfa_set_team_access")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Guardar permisos" }));
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("sfa_set_team_access", { p_space: "space-a", p_user: "caregiver", p_residents: ["person-a", "person-b"], p_configure: false, p_share: false }));
});
it("heterogeneous permissions cannot be silently normalized", async () => {
  mock.rpc.mockResolvedValue({ data: { members: [{ user_id: "mixed", email: "mixed@example.invalid", role: "caregiver", access: [
    { resident_id: "person-a", can_configure: false, can_share_location: false },
    { resident_id: "person-b", can_configure: true, can_share_location: true },
  ] }], invitations: [] }, error: null });
  render(<TeamPanel session={session} spaces={spaces} initialSection="people" initialResidentId="person-a" onAccessChanged={() => {}}/>);
  await screen.findByText("mixed@example.invalid");
  fireEvent.click(screen.getByRole("button", { name: "Permisos" }));
  expect((screen.getByRole("button", { name: "Guardar permisos" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByLabelText(/Las asignaciones actuales tienen permisos distintos/)).toBeTruthy();
  expect(mock.rpc.mock.calls.some(call => call[0] === "sfa_set_team_access")).toBe(false);
});

it("changing the ficha represented by an existing resident requires confirmation", async () => {
  mock.rpc.mockResolvedValue({ data: { members: [{ user_id: "self-person", email: "self@example.invalid", role: "resident", access: [
    { resident_id: "person-a", can_configure: false, can_share_location: true },
  ] }], invitations: [] }, error: null });
  render(<TeamPanel session={session} spaces={spaces} initialSection="people" initialResidentId="person-a" onAccessChanged={() => {}}/>);
  await screen.findByText("self@example.invalid");
  fireEvent.click(screen.getByRole("button", { name: "Permisos" }));
  fireEvent.click(screen.getByLabelText("Persona B"));
  fireEvent.click(screen.getByRole("button", { name: "Guardar permisos" }));
  expect(await screen.findByRole("alertdialog")).toBeTruthy();
  expect(mock.rpc.mock.calls.some(call => call[0] === "sfa_set_team_access")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("sfa_set_team_access", { p_space: "space-a", p_user: "self-person", p_residents: ["person-b"], p_configure: false, p_share: true }));
});
