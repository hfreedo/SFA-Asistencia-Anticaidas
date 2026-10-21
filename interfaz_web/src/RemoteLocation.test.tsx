// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const layer = { addTo: vi.fn() };
const { tileLayer } = vi.hoisted(() => ({ tileLayer: vi.fn() }));
vi.mock("leaflet", () => ({ default: {
  map: () => ({ setView: () => ({ remove: vi.fn(), invalidateSize: vi.fn() }) }),
  tileLayer: (...args: unknown[]) => { tileLayer(...args); return layer; }, circleMarker: () => layer, circle: () => layer,
} }));
import { RemoteLocation } from "./RemoteLocation";
beforeEach(() => { tileLayer.mockClear(); vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("missing GPS does not manufacture a position or require a belt", () => {
  render(<RemoteLocation position={null} clock={Date.now()} />);
  expect(screen.getByText(/Sin ubicación recibida/)).toBeTruthy();
  expect(screen.queryByLabelText("Mapa de la última ubicación del celular")).toBeNull();
});
it("old GPS remains clearly historical", () => {
  render(<RemoteLocation position={{latitude:0,longitude:0,accuracy_m:20,observed_at:"2020-01-01T00:00:00Z"}} clock={Date.now()} />);
  expect(screen.getByText(/Última posición conocida, no actual/)).toBeTruthy();
  expect(screen.queryByText(/Posición reciente/)).toBeNull();
});
it("fresh GPS marks the accuracy circle as distinct from a geofence", () => {
  const now=Date.now();
  render(<RemoteLocation position={{latitude:0,longitude:0,accuracy_m:5,observed_at:new Date(now).toISOString()}} clock={now} />);
  expect(screen.getByText(/Posición reciente/)).toBeTruthy();
  expect(screen.getByText(/no una geocerca/)).toBeTruthy();
  expect(tileLayer).toHaveBeenCalledWith("https://tile.openstreetmap.org/{z}/{x}/{y}.png", expect.objectContaining({
    maxZoom: 19, referrerPolicy: "origin", attribution: expect.stringContaining("OpenStreetMap"),
  }));
});
