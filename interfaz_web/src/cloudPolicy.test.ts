import { describe, expect, it } from "vitest";
import { isFreshSample, isLocalPortal } from "./cloudPolicy";

describe("cloud data states", () => {
  it("enables local commands only on the loopback portal route", () => {
    expect(isLocalPortal({hostname:"localhost",pathname:"/acceso/acceso.html"})).toBe(true);
    expect(isLocalPortal({hostname:"192.168.1.2",pathname:"/acceso/acceso.html"})).toBe(false);
    expect(isLocalPortal({hostname:"hfreedo.github.io",pathname:"/acceso/acceso.html"})).toBe(false);
  });
  it("never treats delayed, future, invalid or simulated samples as live", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    expect(isFreshSample("2026-10-20T11:59:55Z",false,now)).toBe(true);
    for (const [stamp, simulated] of [["2026-10-19T12:00:00Z",false],["2026-10-20T13:00:00Z",false],["invalid",false],["2026-10-20T12:00:00Z",true]] as const) {
      expect(isFreshSample(stamp,simulated,now)).toBe(false);
    }
  });
});
