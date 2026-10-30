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
  expect((await screen.findByRole("status")).textContent).toContain("No se pudo verificar");
  expect(screen.queryByText(/Monitoreo vinculado/)).toBeNull();
});
