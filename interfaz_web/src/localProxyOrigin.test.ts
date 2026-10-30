import { expect, it } from "vitest";
import { localProxyOrigin } from "../localProxyOrigin";
it("normalizes only same-origin requests arriving on loopback",()=>{
  expect(localProxyOrigin("http://127.0.0.1:5180","127.0.0.1:5180","127.0.0.1","same-origin")).toBe("http://127.0.0.1:8780");
  expect(localProxyOrigin("http://localhost:5181","localhost:5181","::1","same-origin")).toBe("http://127.0.0.1:8780");
});
it("preserves foreign, cross-site, LAN and forged origins for rejection",()=>{
  for(const [origin,host,peer,site] of [
    ["https://evil.invalid","127.0.0.1:5180","127.0.0.1","cross-site"],
    ["http://127.0.0.1:5180","127.0.0.1:5180","192.0.2.1","same-origin"],
    ["http://127.0.0.1:5180","127.0.0.1:5180","127.0.0.1","cross-site"],
    ["http://192.0.2.1:5180","192.0.2.1:5180","127.0.0.1","same-origin"],
    ["http://127.0.0.1:5180","localhost:5180","127.0.0.1","same-origin"],
  ]) expect(localProxyOrigin(origin,host,peer,site)).toBe(origin);
});
