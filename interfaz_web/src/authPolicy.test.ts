import { describe, expect, it } from "vitest";
import { accessFailure, accessUrl, callbackMode, passwordProblem, validateConfiguration } from "./authPolicy";

describe("access policy", () => {
  it("support references expose only stage and safe codes, never provider messages", () => {
    expect(accessFailure("MEMBERSHIP", { code: "42501", message: "secret" }).message).toBe("MEMBERSHIP:42501");
    expect(accessFailure("IDENTITY", { code: "private token=abc", message: "secret" }).message).toBe("IDENTITY:REQUEST");
  });
  it("accepts only publishable credentials over HTTPS", () => {
    expect(validateConfiguration("https://demo.supabase.co", "sb_publishable_example")).toBeNull();
    for (const key of ["sb_secret_danger", "eyJlegacy", ""]) {
      expect(validateConfiguration("https://demo.supabase.co", key)).not.toBeNull();
    }
    for (const url of ["http://demo.supabase.co", "https://demo.supabase.co.evil.com", "https://user@demo.supabase.co", "https://demo.supabase.co?x=1", "oops"]) {
      expect(validateConfiguration(url, "sb_publishable_example")).not.toBeNull();
    }
  });
  it("handles invite and recovery without a public signup", () => {
    expect(callbackMode("", "#type=invite&access_token=private")).toBe("password");
    expect(callbackMode("", "#type=recovery")).toBe("password");
    expect(callbackMode("?flow=recovery", "")).toBe("password");
    expect(callbackMode("?next=https://evil.example", "")).toBe("login");
  });
  it("builds same-origin callbacks without copying tokens or redirect parameters", () => {
    expect(accessUrl("https://example.org/sfa/acceso.html?next=evil#access_token=private", true))
      .toBe("https://example.org/sfa/acceso.html?flow=recovery");
    expect(accessUrl("http://localhost:8780/acceso.html#secret")).toBe("http://localhost:8780/acceso.html");
  });
  it("requires matching passwords with at least twelve characters", () => {
    expect(passwordProblem("short", "short")).not.toBeNull();
    expect(passwordProblem("long-example-password", "other-password")).not.toBeNull();
    expect(passwordProblem("long-example-password", "long-example-password")).toBeNull();
  });
});
