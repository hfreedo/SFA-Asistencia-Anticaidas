import { accessDataClient } from "./accessClient";
import type { RemotePosition } from "./RemoteLocation";

export async function loadMapPosition(token: string, resident: string): Promise<RemotePosition | null> {
  const api = accessDataClient(token);
  const result = await api.rpc("sfa_map_position", { p_resident: resident });
  if (result.error?.code === "PGRST202") {
    const legacy = await api.from("sfa_positions").select("latitude,longitude,accuracy_m,observed_at")
      .eq("resident_id", resident).eq("simulated", false).order("observed_at", { ascending: false }).limit(1);
    if (legacy.error) throw legacy.error;
    return legacy.data?.[0] ?? null;
  }
  if (result.error) throw result.error;
  if (!result.data || !("position" in result.data)) throw new Error("Invalid map response");
  const p = result.data.position;
  if (p !== null && (!Number.isFinite(p.latitude) || Math.abs(p.latitude) > 90 || !Number.isFinite(p.longitude) || Math.abs(p.longitude) > 180 ||
    !Number.isFinite(p.accuracy_m) || p.accuracy_m <= 0 || p.accuracy_m > 10000 || !Number.isFinite(Date.parse(p.observed_at)) ||
    typeof p.simulated !== "boolean" || p.source !== (p.simulated ? "admin_test" : "phone"))) throw new Error("Invalid map position");
  return p;
}
