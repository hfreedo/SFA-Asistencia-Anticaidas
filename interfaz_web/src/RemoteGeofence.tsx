import { useMemo } from "react";
import type { Session } from "@supabase/supabase-js";
import { accessDataClient } from "./accessClient";
import { InternetGeofence, type ZoneApi } from "./CloudGeofence";
import type { RemotePosition } from "./RemoteLocation";

export function RemoteGeofence({ resident, session, position, clock }: { resident: string; session: Session; position: RemotePosition | null; clock: number }) {
  const api = useMemo<ZoneApi>(() => {
    const rpc = async (name: string, values: object = {}) => {
      const result = await accessDataClient(session.access_token).rpc(name, { p_resident: resident, ...values });
      if (result.error) throw result.error;
      return result.data;
    };
    return { load: () => rpc("sfa_get_geofence"), save: value => rpc("sfa_save_geofence", value) };
  }, [resident, session.access_token]);
  return <InternetGeofence key={resident + session.user.id} api={api} position={position} clock={clock} />;
}
