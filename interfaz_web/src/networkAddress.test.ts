import {expect,it} from "vitest";
import {networkAddress} from "./networkAddress";
it("preserves the server protocol when switching network interfaces",()=>{
  expect(networkAddress("192.168.1.4",8780,"https://localhost:8780")).toBe("https://192.168.1.4:8780");
  expect(networkAddress("192.168.1.4",8780,"http://localhost:8780")).toBe("http://192.168.1.4:8780");
  expect(networkAddress("::1",8780,"https://localhost:8780")).toBe("https://[::1]:8780");
  expect(()=>networkAddress("192.168.1.4",8780,"ftp://localhost")).toThrow();
});
