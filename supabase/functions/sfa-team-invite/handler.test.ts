import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { createTeamInviteHandler } from "./handler.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value { if (!value) throw new Error(message); }
const origin = "https://hfreedo.github.io";
const body = { space_id: "fixture-space", email: "fixture@example.invalid", role: "caregiver", resident_ids: ["fixture-person"], can_configure: false, can_share_location: false };
function fixture({ denied = false, invalidSession = false, mailFailure = false } = {}) {
  const calls: string[] = [];
  const fake = ((_url: string, key: string) => {
    calls.push(key === "private-fixture" ? "privileged_client" : "user_client");
    return key === "private-fixture" ? { auth: { admin: { inviteUserByEmail: async (email: string, options: { redirectTo: string }) => {
      calls.push("mail"); assert(email === body.email); assert(options.redirectTo === "https://hfreedo.github.io/SFA-Asistencia-Anticaidas/acceso.html");
      return { error: mailFailure ? { message: "PRIVATE_PROVIDER_DETAIL" } : null };
    } } } } : { auth: { getUser: async () => ({ data: { user: invalidSession ? null : { id: "fixture-user" } }, error: null }) },
      rpc: async (name: string, parameters: Record<string, unknown>) => {
        calls.push("authorized_rpc"); assert(name === "sfa_prepare_team_invite"); assert(parameters.p_space === body.space_id);
        return { data: denied ? null : { id: "invitation", expires_at: "2030-01-01" }, error: denied ? { code: "42501", message: "PRIVATE_PROVIDER_DETAIL" } : null };
      } };
  }) as unknown as typeof createClient;
  return { calls, handler: createTeamInviteHandler({ client: fake, env: name => name === "SUPABASE_URL" ? "https://fixture.invalid" : name === "SUPABASE_ANON_KEY" ? "public-fixture" : "private-fixture" }) };
}
function request(value: unknown = body, headers = {}) {
  return new Request("https://fixture.invalid/functions/v1/sfa-team-invite", { method: "POST", headers: { Origin: origin, Authorization: "Bearer fixture.valid.token", ...headers }, body: JSON.stringify(value) });
}
Deno.test("no token or unapproved origin cannot create clients or send mail", async () => {
  const f = fixture();
  assert((await f.handler(request(body, { Authorization: "" }))).status === 401);
  assert((await f.handler(request(body, { Origin: "https://attacker.invalid" }))).status === 403);
  assert(f.calls.length === 0);
});
Deno.test("identity and administrator permission are checked before privileged Auth", async () => {
  for (const flags of [{ invalidSession: true }, { denied: true }]) {
    const f = fixture(flags); const response = await f.handler(request());
    assert(response.status === (flags.invalidSession ? 401 : 403));
    assert(!f.calls.includes("privileged_client")); assert(!(await response.text()).includes("PRIVATE_PROVIDER_DETAIL"));
  }
});
Deno.test("malformed and oversized requests never reach privileged Auth", async () => {
  const f = fixture();
  assert((await f.handler(request(null))).status === 400);
  assert((await f.handler(request({ email: "x".repeat(9000) }))).status === 413);
  assert(!f.calls.includes("privileged_client"));
});
Deno.test("authorized invite pins callback and does not return privileged credentials", async () => {
  const f = fixture(); const response = await f.handler(request({ ...body, redirectTo: "https://attacker.invalid" }));
  assert(response.status === 201); const text = await response.text();
  assert(JSON.parse(text).mail_sent === true); assert(!text.includes("private-fixture"));
  assert(f.calls.join(",") === "user_client,authorized_rpc,privileged_client,mail");
});
Deno.test("mail failure is not falsely reported as successful delivery", async () => {
  const f = fixture({ mailFailure: true }); const response = await f.handler(request());
  const result = await response.json(); assert(response.status === 201); assert(result.mail_sent === false);
  assert(result.invitation_id === "invitation"); assert(!JSON.stringify(result).includes("PRIVATE_PROVIDER_DETAIL"));
});
