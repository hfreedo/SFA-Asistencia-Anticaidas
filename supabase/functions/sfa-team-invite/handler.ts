import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const portal = "https://hfreedo.github.io/SFA-Asistencia-Anticaidas/acceso.html";
const origins = new Set(["https://hfreedo.github.io", "http://localhost:8780", "https://localhost:8780", "http://127.0.0.1:8780", "https://127.0.0.1:8780"]);

export function createTeamInviteHandler(dependencies = {
  env: (name: string) => Deno.env.get(name), client: createClient,
}) { return async (request: Request) => {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin" };
  if (origin && origins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  const reply = (status: number, value: object) => new Response(JSON.stringify(value), { status, headers });
  if (origin && !origins.has(origin)) return reply(403, { code: "origin_denied" });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, { code: "method_not_allowed" });
  const bearer = request.headers.get("Authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9._-]+$/.test(bearer)) return reply(401, { code: "session_required" });
  try {
    const url = dependencies.env("SUPABASE_URL")!;
    const publicKey = dependencies.env("SUPABASE_ANON_KEY")!;
    const secret = dependencies.env("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!url || !publicKey || !secret) return reply(503, { code: "server_not_configured" });
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const userClient = dependencies.client(url, publicKey, { ...options, global: { headers: { Authorization: bearer } } });
    const { data: identity, error: identityError } = await userClient.auth.getUser(bearer.slice(7));
    if (identityError || !identity.user) return reply(401, { code: "session_invalid" });
    const raw = await request.text();
    if (raw.length > 8192) return reply(413, { code: "body_too_large" });
    let body;
    try { body = JSON.parse(raw); } catch { return reply(400, { code: "invalid_body" }); }
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.email !== "string") return reply(400, { code: "invalid_body" });
    const { data: invitation, error } = await userClient.rpc("sfa_prepare_team_invite", {
      p_space: body.space_id, p_email: body.email, p_role: body.role,
      p_residents: body.resident_ids, p_configure: body.can_configure, p_share: body.can_share_location,
    });
    if (error) return reply(error.code === "42501" ? 403 : error.code === "22023" ? 400 : 503, { code: "invitation_not_prepared" });
    // This call follows the user-scoped authorization command; the browser never receives this key.
    const admin = dependencies.client(url, secret, options);
    const { error: delivery } = await admin.auth.admin.inviteUserByEmail(body.email.trim().toLowerCase(), { redirectTo: portal });
    return reply(201, { invitation_id: invitation.id, expires_at: invitation.expires_at, mail_sent: !delivery,
      code: delivery ? "invitation_saved_mail_not_sent" : "invitation_saved_mail_sent" });
  } catch { return reply(503, { code: "service_unavailable" }); }
}; }
