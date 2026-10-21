// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
vi.mock("./RemoteLocation", () => ({ RemoteLocation: ({ position }: { position: { latitude: number } | null }) => <div>{position ? `GPS remoto ${position.latitude}` : "Sin ubicación remota"}</div> }));
import { LocalRemoteLocation } from "./LocalRemoteLocation";
const fetchMock=vi.fn();
beforeEach(()=>{ vi.stubGlobal("fetch",fetchMock); fetchMock.mockReset(); });
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("reads cloud GPS for the selected local profile, without LAN pairing", async()=>{
  fetchMock.mockResolvedValue({ok:true,json:async()=>({position:{latitude:12}})});
  render(<LocalRemoteLocation residentId={7} residentName="Prueba"/>);
  expect(await screen.findByText("GPS remoto 12")).toBeTruthy();
  expect(fetchMock.mock.calls[0][0]).toBe("/api/cloud/residents/7/location");
  expect(screen.queryByText(/hotspot/)).toBeNull();
});
it("explains a missing cloud session instead of pretending the phone is disconnected", async()=>{
  fetchMock.mockResolvedValue({ok:false,status:401,json:async()=>({detail:{code:"session_required"}})});
  render(<LocalRemoteLocation residentId={1} residentName="Prueba"/>);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText(/Inicia sesión en el acceso/)).toBeTruthy();
  expect(screen.getByRole("link").getAttribute("href")).toBe("/acceso/acceso.html");
});
it("clears a previous residents location when changing profiles", async()=>{
  fetchMock.mockResolvedValueOnce({ok:true,json:async()=>({position:{latitude:12}})})
    .mockResolvedValue({ok:true,json:async()=>({position:null})});
  const {rerender}=render(<LocalRemoteLocation residentId={1} residentName="Uno"/>);
  await screen.findByText("GPS remoto 12");
  rerender(<LocalRemoteLocation residentId={2} residentName="Dos"/>);
  expect(screen.queryByText("GPS remoto 12")).toBeNull();
  await waitFor(()=>expect(screen.getByText("Sin ubicación remota")).toBeTruthy());
});
