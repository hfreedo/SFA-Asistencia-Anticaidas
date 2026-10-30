// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { preparationIssues } from "./preparationStatus";

describe("preparation indicators", () => {
  const ready = { session_active: true, bindings: [{ local_resident_id: 7, enabled: 1 }], push: { configured: true, last_error: null } };
  it("counts a paused session separately from an existing link", () => {
    expect(preparationIssues({ status: { ...ready, session_active: false }, failed: false }, 7).count).toBe(1);
  });
  it("never interprets an unavailable check as readiness or a numeric count", () => {
    expect(preparationIssues({ status: null, failed: true }, 7)).toMatchObject({ unknown: true, count: 0 });
  });
  it("scopes the enabled link to the selected resident", () => {
    expect(preparationIssues({ status: ready, failed: false }, 8).count).toBe(1);
    expect(preparationIssues({ status: { ...ready, bindings: [{ local_resident_id: 7, enabled: 0 }] }, failed: false }, 7).count).toBe(1);
  });
  it("does not require optional hardware or unconfigured push for GPS", () => {
    expect(preparationIssues({ status: { ...ready, push: { configured: false, last_error: null } }, failed: false }, 7).count).toBe(0);
  });
  it("flags emitter errors without claiming delivery", () => {
    expect(preparationIssues({ status: { ...ready, push: { configured: true, last_error: "error" } }, failed: false }, 7).count).toBe(1);
    expect(preparationIssues({ status: ready, failed: false }, 7).label).toContain("entrega de avisos sin verificar");
  });
});
