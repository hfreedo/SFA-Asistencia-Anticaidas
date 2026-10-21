import { createClient } from "@supabase/supabase-js";
import { validateConfiguration } from "./authPolicy";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
export const configurationProblem = validateConfiguration(url, key);

// No privileged key or durable login on shared caregiver workstations.
export const accessClient = configurationProblem ? null : createClient(url, key, {
  auth: {
    persistSession: true,
    storage: window.sessionStorage,
    storageKey: "sfa-access-session-v1",
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  },
});

export function accessDataClient(accessToken: string) {
  if (configurationProblem || !accessToken) throw new Error("Missing verified session");
  // Pin reads to the exact identity just verified, never an anonymous fallback.
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
