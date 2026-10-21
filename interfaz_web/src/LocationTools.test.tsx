// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://localhost:8780/"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocationHistory, LocationPanel, type LocationSnapshot } from "./LocationTools";

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,fixture") } }));
const fetchMock = vi.fn();
const snapshot: LocationSnapshot = { resident_id: 1, paired: true, status: "stale", age_seconds: null, position: null,
  events: [{ id: 1, event_type: "GEOCERCA_SALIDA", detail: "Ubicación confirmada fuera de la zona", received_at: "2026-10-20T20:00:00Z" }] };
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes("network-info")
    ? { url: "https://192.168.1.5:8780", port: 8780, addresses: ["192.168.1.5"], lan_available: true }
    : { token: "PRIVATE_TEST_LOCATION_TOKEN", resident_id: 1 } }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("resident location controls", () => {
  it("requires confirmation without rotating a working phone link", () => {
    render(<LocationPanel residentId={1} snapshot={snapshot} />);
    fireEvent.click(screen.getByText("Reemplazar vínculo del celular"));
    expect(screen.getByRole("group", { name: "Confirmar reemplazo del vínculo" })).toBeTruthy();
    fireEvent.click(screen.getByText("Cancelar"));
    expect(fetchMock.mock.calls.every(call => !call[0].includes("location-device"))).toBe(true);
  });
  it("shows private QR and compact event history after explicit replacement", async () => {
    const { container } = render(<><LocationPanel residentId={1} snapshot={snapshot} /><LocationHistory events={snapshot.events} /></>);
    fireEvent.click(screen.getByText("Reemplazar vínculo del celular"));
    fireEvent.click(screen.getByRole("button", { name: "Reemplazar vínculo" }));
    expect(await screen.findByAltText("QR privado para compartir ubicación")).toBeTruthy();
    expect(screen.getByText("Actividad reciente")).toBeTruthy();
    expect(container.querySelector(".is-warning")).toBeTruthy();
    expect(container.innerHTML).not.toContain("PRIVATE_TEST_LOCATION_TOKEN");
    const post = fetchMock.mock.calls.find(call => call[0].includes("location-device"));
    expect(JSON.parse(post?.[1].body).replace_existing).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar código QR" }));
    expect(screen.queryByAltText("QR privado para compartir ubicación")).toBeNull();
    expect(fetchMock.mock.calls.some(call => call[1]?.method === "DELETE")).toBe(false);
  });
  it("removes the previous resident QR when switching profiles", async () => {
    const { rerender } = render(<LocationPanel residentId={1} snapshot={{ ...snapshot, paired: false }} />);
    fireEvent.click(screen.getByText("Vincular celular por QR"));
    await screen.findByAltText("QR privado para compartir ubicación");
    rerender(<LocationPanel residentId={2} snapshot={null} />);
    expect(screen.queryByAltText("QR privado para compartir ubicación")).toBeNull();
  });
  it("does not rotate a token when LAN access is unavailable", async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ url: "https://192.168.1.5:8780", addresses: [], lan_available: false }) }));
    render(<LocationPanel residentId={1} snapshot={null} />);
    fireEvent.click(screen.getByText("Vincular celular por QR"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(fetchMock.mock.calls.some(call => call[0].includes("location-device"))).toBe(false);
  });
});
