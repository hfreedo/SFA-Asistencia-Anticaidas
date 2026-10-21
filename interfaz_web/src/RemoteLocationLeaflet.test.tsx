// @vitest-environment jsdom
import L from "leaflet";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RemoteLocation } from "./RemoteLocation";

const svgDescriptor = Object.getOwnPropertyDescriptor(L.Browser, "svg")!;
beforeEach(() => {
  Object.defineProperty(L.Browser, "svg", { ...svgDescriptor, value: true });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  Object.defineProperty(L.Browser, "svg", svgDescriptor);
});
it("real Leaflet preserves the operator's zoom and center across GPS polling and aging", () => {
  const create = vi.spyOn(L, "map");
  const now = Date.now();
  const position = { latitude: 0, longitude: 0, accuracy_m: 5, observed_at: new Date(now).toISOString() };
  const view = render(<RemoteLocation position={position} clock={now} />);
  const map = create.mock.results[0].value as L.Map;
  map.setView([1, 1], 14, { animate: false });
  const previous = map.getCenter();
  view.rerender(<RemoteLocation position={{ ...position, latitude: 2, longitude: 3, accuracy_m: 20 }} clock={now + 91000} />);
  expect(create).toHaveBeenCalledTimes(1);
  expect(map.getZoom()).toBe(14);
  expect(map.getCenter().equals(previous)).toBe(true);
});
it("editing the zone preserves Leaflet's own container classes and map instance", () => {
  const create = vi.spyOn(L, "map");
  const now = Date.now();
  const position = { latitude: 0, longitude: 0, accuracy_m: 5, observed_at: new Date(now).toISOString() };
  const view = render(<RemoteLocation position={position} clock={now} />);
  view.rerender(<RemoteLocation position={position} clock={now} geofence={{home_lat:0,home_lng:0,radius_m:5}} onSelectCenter={() => {}} />);
  expect(create).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector('.cloud-location-map')?.classList.contains('leaflet-container')).toBe(true);
});
