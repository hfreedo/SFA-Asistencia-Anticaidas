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
  vi.clearAllMocks();
  mock.rpc.mockImplementation(async (name: string) => name === "sfa_team" ? { data: { members: [
    { user_id: "admin", email: "admin@example.invalid", role: "admin", access: [] },
    { user_id: "caregiver", email: "care@example.invalid", role: "caregiver", access: [{ resident_id: "person-a", can_configure: false, can_share_location: false }] },
  ], invitations: [] }, error: null } : { data: { updated: true }, error: null });
  mock.invoke.mockResolvedValue({ data: { invitation_id: "invite", mail_sent: true }, error: null });
  mock.client.mockReturnValue({ rpc: mock.rpc, functions: { invoke: mock.invoke }, from: () => ({ select: () => ({ eq: () => ({ is: () => ({ order: () => Promise.resolve({ data: [{ id: "person-a", full_name: "Persona A" }], error: null }) }) }) }) }) });
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
  fireEvent.click(screen.getByLabelText("Permitir vincular este celular como emisor GPS"));
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
  fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "admin" } });
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
