import { useMemo } from "react";
import type { Session } from "@supabase/supabase-js";
import { accessDataClient } from "./accessClient";
import { IncidentWorkspace, type IncidentApi } from "./IncidentWorkspace";

export function IncidentPanel({ resident, session }: { resident: string; session: Session }) {
  const api = useMemo<IncidentApi>(() => ({
    load: async () => {
      const result = await accessDataClient(session.access_token).rpc("sfa_incidents", { p_resident: resident });
      if (result.error) throw result.error;
      return { ...result.data, viewer_id: result.data.viewer_id ?? session.user.id };
    },
    attend: async (id, expected, outcome) => {
      const result = await accessDataClient(session.access_token).rpc("sfa_attend_incident", { p_event: id, p_expected: expected, p_outcome: outcome });
      if (result.error) throw result.error;
    },
  }), [resident, session.access_token, session.user.id]);
  return <IncidentWorkspace key={resident + session.user.id} api={api} />;
}
