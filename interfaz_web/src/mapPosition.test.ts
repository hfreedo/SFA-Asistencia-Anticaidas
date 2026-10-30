import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("./accessClient", () => ({ accessDataClient: () => mocks }));
import { loadMapPosition } from "./mapPosition";
afterEach(() => vi.resetAllMocks());
const point = { latitude: 1, longitude: 2, accuracy_m: 8, observed_at: new Date().toISOString(), simulated: true, source: "admin_test" };
it("preserves the test marker from the authorized map reader", async () => {
  mocks.rpc.mockResolvedValue({ data: { position: point }, error: null });
  expect(await loadMapPosition("session", "person")).toEqual(point);
  expect(mocks.rpc).toHaveBeenCalledWith("sfa_map_position", { p_resident: "person" });
  expect(mocks.from).not.toHaveBeenCalled();
});
it("does not silently bypass an authorization or connection failure", async () => {
  for (const code of ["42501", "PGRST301", "NETWORK_ERROR"]) {
    mocks.rpc.mockResolvedValue({ error: { code } });
    await expect(loadMapPosition("session", "person")).rejects.toEqual({ code });
  }
  expect(mocks.from).not.toHaveBeenCalled();
});
it("rejects malformed or unlabelled test points", async () => {
  for (const position of [{ ...point, source: "phone" }, { ...point, simulated: undefined }, { ...point, latitude: 100 }, undefined]) {
    mocks.rpc.mockResolvedValue({ data: { position }, error: null });
    await expect(loadMapPosition("session", "person")).rejects.toThrow();
  }
});
it("supports empty maps and only falls back when the new RPC is absent", async () => {
  mocks.rpc.mockResolvedValue({ data: { position: null }, error: null });
  expect(await loadMapPosition("session", "person")).toBeNull();
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }) };
  mocks.from.mockReturnValue(query);
  mocks.rpc.mockResolvedValue({ error: { code: "PGRST202" } });
  expect(await loadMapPosition("session", "person")).toBeNull();
  expect(query.eq).toHaveBeenCalledWith("simulated", false);
});
