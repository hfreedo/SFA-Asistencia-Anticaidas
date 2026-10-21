// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("./RemoteLocation", () => ({ RemoteLocation: ({onSelectCenter}: {onSelectCenter?: (lat:number,lng:number)=>void}) => <button disabled={!onSelectCenter} onClick={() => onSelectCenter?.(1,2)}>Mapa de prueba</button> }));
import { InternetGeofence, type ZoneApi } from "./CloudGeofence";
const zone={home_lat:0,home_lng:0,radius_m:100,address_name:"Hogar",updated_at:"2026-10-21T10:00:00Z"};
let api: ZoneApi;
beforeEach(() => { api={load:vi.fn().mockResolvedValue({can_configure:true,geofence:zone}),save:vi.fn().mockResolvedValue({can_configure:true,geofence:{...zone,radius_m:5}})}; });
afterEach(cleanup);
it("saves a 5 m zone with the prior revision, not local SQLite", async () => {
  render(<InternetGeofence api={api} position={null} clock={Date.now()} />);
  await screen.findByDisplayValue("Hogar");
  fireEvent.click(screen.getByRole("button",{name:/^5 m$/}));
  fireEvent.click(screen.getByRole("button",{name:"Guardar zona remota"}));
  await waitFor(() => expect(api.save).toHaveBeenCalledWith({p_lat:0,p_lng:0,p_radius:5,p_label:"Hogar",p_expected:zone.updated_at}));
  expect(await screen.findByText(/Esto no confirma que el celular ya la recibió/)).toBeTruthy();
});
it("GPS polling cannot overwrite a draft radius or reload the zone", async () => {
  const position={latitude:0,longitude:0,accuracy_m:20,observed_at:new Date().toISOString()};
  const view=render(<InternetGeofence api={api} position={position} clock={Date.now()} />);
  await screen.findByDisplayValue("Hogar");
  fireEvent.click(screen.getByRole("button",{name:/^5 m$/}));
  view.rerender(<InternetGeofence api={api} position={{...position,latitude:3}} clock={Date.now()} />);
  expect(screen.getByRole("button",{name:/^5 m$/}).getAttribute("aria-pressed")).toBe("true");
  expect(api.load).toHaveBeenCalledTimes(1);
});
it("read-only viewers cannot edit or save a zone", async () => {
  vi.mocked(api.load).mockResolvedValue({can_configure:false,geofence:zone});
  render(<InternetGeofence api={api} position={null} clock={Date.now()} />);
  await screen.findByText(/Solo lectura/);
  expect(screen.queryByRole("button",{name:"Guardar zona remota"})).toBeNull();
  expect(api.save).not.toHaveBeenCalled();
});
it("map selection is explicit and remains a preview until saved", async () => {
  render(<InternetGeofence api={api} position={null} clock={Date.now()} />);
  fireEvent.click(await screen.findByRole("button",{name:"Elegir centro en el mapa"}));
  fireEvent.click(screen.getByRole("button",{name:"Mapa de prueba"}));
  expect((screen.getByLabelText("Latitud del centro") as HTMLInputElement).value).toBe("1.0000000");
  expect(screen.getByText(/Vista previa con cambios sin guardar/)).toBeTruthy();
  expect(api.save).not.toHaveBeenCalled();
});
it("failed or conflicting save retains the draft and does not claim success", async () => {
  vi.mocked(api.save).mockRejectedValue(new Error("conflict"));
  render(<InternetGeofence api={api} position={null} clock={Date.now()} />);
  await screen.findByDisplayValue("Hogar");
  fireEvent.click(screen.getByRole("button",{name:/^5 m$/}));
  fireEvent.click(screen.getByRole("button",{name:"Guardar zona remota"}));
  await screen.findByRole("alert");
  expect(screen.queryByText(/Zona guardada en Supabase/)).toBeNull();
  expect(screen.getByText(/Vista previa con cambios sin guardar/)).toBeTruthy();
});
it("an empty zone never invents coordinates or saves itself", async () => {
  vi.mocked(api.load).mockResolvedValue({can_configure:true,geofence:null});
  render(<InternetGeofence api={api} position={null} clock={Date.now()} />);
  await screen.findByText(/No hay una zona remota guardada/);
  expect((screen.getByRole("button",{name:"Guardar zona remota"}) as HTMLButtonElement).disabled).toBe(true);
  expect(api.save).not.toHaveBeenCalled();
});
