// @vitest-environment jsdom
import { StrictMode } from "react";
import L from "leaflet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LocationMap, MapScreen } from "./SfaDashboard";

const props = { homeLat: -25.33, homeLng: -57.58, radiusM: 5, residentLat: -25.33, residentLng: -57.58,
  residentName: "Fixture", hasGps: false, fresh: false, onMapClick: vi.fn() };
const svgDescriptor = Object.getOwnPropertyDescriptor(L.Browser, "svg")!;
beforeEach(() => {
  Object.defineProperty(L.Browser, "svg", { ...svgDescriptor, value: true });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); Object.defineProperty(L.Browser, "svg", svgDescriptor); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("location map lifecycle", () => {
  it("opens a small geofence with real Leaflet without reading an unattached circle", () => {
    const fit = vi.spyOn(L.Map.prototype, "fitBounds");
    expect(() => render(<LocationMap {...props} />)).not.toThrow();
    expect(fit).toHaveBeenCalled();
  });
  it("handles React strict remount and a subsequent radius change", () => {
    const { rerender } = render(<StrictMode><LocationMap {...props} /></StrictMode>);
    expect(() => rerender(<StrictMode><LocationMap {...props} radiusM={10} /></StrictMode>)).not.toThrow();
  });
  it("places recent activity after the map workspace", () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ addresses: [] }) })));
    const { container } = render(<MapScreen geofence={{ home_lat: -25.33, home_lng: -57.58, radius_m: 5, address_name: "Fixture" }} profile={null} onUpdateGeofence={vi.fn()} locationSnapshot={{ resident_id: 1, paired: false, status: "no_fix", position: null, age_seconds: null,
      events: [{ id: 1, event_type: "UBICACION_PERDIDA", detail: "Fixture event", received_at: "2026-10-20T20:00:00Z" }] }} />);
    const workspace = container.querySelector(".location-layout")!;
    const history = screen.getByRole("region", { name: "Actividad reciente de ubicación" });
    expect(Boolean(workspace.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(container.querySelector(".geo-tracking .geo-history")).toBeNull();
  });
});
