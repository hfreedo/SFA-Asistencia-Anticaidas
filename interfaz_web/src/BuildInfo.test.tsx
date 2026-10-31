// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {BuildInfo} from "./BuildInfo";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("keeps technical information closed until requested and returns focus on Escape",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({version:"1.2.0-rc16-dev"})}));
  render(<BuildInfo/>);
  expect(screen.queryByRole("region")).toBeNull();
  const toggle=screen.getByRole("button",{name:"Información del sistema"});
  fireEvent.click(toggle);
  expect(await screen.findByRole("region",{name:"Información del sistema"})).toBeTruthy();
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.keyDown(document,{key:"Escape"});
  expect(screen.queryByRole("region")).toBeNull();
  expect(document.activeElement).toBe(toggle);
});
it("closes on outside click and reports an unavailable server honestly",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));
  render(<BuildInfo/>);fireEvent.click(screen.getByRole("button",{name:"Información del sistema"}));
  expect(await screen.findByText("sin conexión")).toBeTruthy();
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole("region")).toBeNull();
});
