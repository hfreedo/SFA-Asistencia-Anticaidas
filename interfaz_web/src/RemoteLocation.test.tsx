// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ tileLayer: vi.fn(), create: vi.fn(), map: {
  setView: vi.fn().mockReturnThis(), remove: vi.fn(), invalidateSize: vi.fn(), panTo: vi.fn(), on: vi.fn(),
}, marker: { addTo: vi.fn().mockReturnThis(), setLatLng: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() },
accuracy: { addTo: vi.fn().mockReturnThis(), setLatLng: vi.fn().mockReturnThis(), setRadius: vi.fn().mockReturnThis() } }));
vi.mock("leaflet", () => ({ default: {
  map: (...args: unknown[]) => { mocks.create(...args); return mocks.map; },
  tileLayer: (...args: unknown[]) => { mocks.tileLayer(...args); return { addTo: vi.fn() }; },
  circleMarker: () => mocks.marker, circle: () => mocks.accuracy,
} }));
import { RemoteLocation } from "./RemoteLocation";
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("missing GPS does not manufacture a position or require a belt", () => {
  render(<RemoteLocation position={null} clock={Date.now()} />);
  expect(screen.getByText(/Sin ubicación recibida/)).toBeTruthy();
  expect(screen.queryByLabelText("Mapa de la última ubicación del celular")).toBeNull();
});
it("shows a persistent administrator test warning instead of a real fresh position", () => {
  const now=Date.now();
  render(<RemoteLocation position={{latitude:1,longitude:2,accuracy_m:8,observed_at:new Date(now).toISOString(),simulated:true,source:"admin_test"}} clock={now} />);
  expect(screen.getByRole("status").textContent).toContain("PRUEBA");
  expect(screen.getByText(/Lectura de prueba/)).toBeTruthy();
  expect(screen.queryByText(/Posición reciente/)).toBeNull();
  expect(mocks.marker.setStyle).toHaveBeenLastCalledWith({color:"#b7791f"});
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
  expect(mocks.tileLayer).toHaveBeenCalledWith("https://tile.openstreetmap.org/{z}/{x}/{y}.png", expect.objectContaining({
    maxZoom: 19, referrerPolicy: "origin", attribution: expect.stringContaining("OpenStreetMap"),
  }));
});
it("GPS polling updates layers without recreating or recentering the map", () => {
  const now=Date.now();
  const position={latitude:0,longitude:0,accuracy_m:5,observed_at:new Date(now).toISOString()};
  const view=render(<RemoteLocation position={position} clock={now} />);
  view.rerender(<RemoteLocation position={{...position}} clock={now+1000} />);
  view.rerender(<RemoteLocation position={{...position,latitude:1,longitude:2,accuracy_m:12}} clock={now+2000} />);
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.map.setView).toHaveBeenCalledTimes(1);
  expect(mocks.map.panTo).not.toHaveBeenCalled();
  expect(mocks.map.remove).not.toHaveBeenCalled();
  expect(mocks.marker.setLatLng).toHaveBeenLastCalledWith([1,2]);
  expect(mocks.accuracy.setRadius).toHaveBeenLastCalledWith(12);
});
it("becoming historical changes marker style without resetting zoom", () => {
  const now=Date.now();
  const position={latitude:0,longitude:0,accuracy_m:5,observed_at:new Date(now).toISOString()};
  const view=render(<RemoteLocation position={position} clock={now} />);
  view.rerender(<RemoteLocation position={position} clock={now+91000} />);
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.map.setView).toHaveBeenCalledTimes(1);
  expect(mocks.marker.setStyle).toHaveBeenLastCalledWith({color:"#64748b"});
});
it("explicit centering uses the latest GPS without changing zoom", () => {
  const now=Date.now();
  const position={latitude:0,longitude:0,accuracy_m:5,observed_at:new Date(now).toISOString()};
  const view=render(<RemoteLocation position={position} clock={now} />);
  view.rerender(<RemoteLocation position={{...position,latitude:3,longitude:4}} clock={now} />);
  fireEvent.click(screen.getByRole("button",{name:"Centrar en el celular"}));
  expect(mocks.map.panTo).toHaveBeenCalledWith([3,4]);
  expect(mocks.map.setView).toHaveBeenCalledTimes(1);
});
it("changing resident deliberately resets the old map", () => {
  const now=Date.now();
  const position={latitude:0,longitude:0,accuracy_m:5,observed_at:new Date(now).toISOString()};
  const view=render(<RemoteLocation key="one" position={position} clock={now} />);
  view.rerender(<RemoteLocation key="two" position={{...position,latitude:3}} clock={now} />);
  expect(mocks.map.remove).toHaveBeenCalledTimes(1);
  expect(mocks.create).toHaveBeenCalledTimes(2);
});
it("missing or invalid positions cannot leave the old person's map visible", () => {
  const now=Date.now();
  const position={latitude:0,longitude:0,accuracy_m:5,observed_at:new Date(now).toISOString()};
  const view=render(<RemoteLocation position={position} clock={now} />);
  view.rerender(<RemoteLocation position={null} clock={now} />);
  expect(mocks.map.remove).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText("Mapa de la última ubicación del celular")).toBeNull();
  view.rerender(<RemoteLocation position={{...position,latitude:100}} clock={now} />);
  expect(mocks.create).toHaveBeenCalledTimes(1);
});
