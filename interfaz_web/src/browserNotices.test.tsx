// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { browserNoticesEnabled, enableBrowserNotices, setBrowserNotices, useBrowserNotices } from "./browserNotices";
import { showBrowserAlert } from "./LocationTools";
beforeEach(() => {
  localStorage.clear(); vi.stubGlobal("isSecureContext",true);
  const notices={permission:"default" as NotificationPermission,requestPermission:vi.fn(async()=>{notices.permission="granted";return "granted" as NotificationPermission;})};
  vi.stubGlobal("Notification",notices);
  setBrowserNotices(true);
});
afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals();});
function Probe(){const state=useBrowserNotices();return <output>{state.enabled ? "Activos" : "Inactivos"}</output>;}
it("updates already-mounted readers when permission is granted from another entry",async()=>{
  render(<Probe/>);expect(screen.getByText("Inactivos")).toBeTruthy();
  await act(async()=>{await enableBrowserNotices();});
  expect(screen.getByText("Activos")).toBeTruthy();expect(browserNoticesEnabled()).toBe(true);
});
it("keeps an explicit opt-out after remount without revoking the browser permission",async()=>{
  await enableBrowserNotices();act(()=>setBrowserNotices(false));
  const view=render(<Probe/>);expect(screen.getByText("Inactivos")).toBeTruthy();
  view.unmount();render(<Probe/>);expect(screen.getByText("Inactivos")).toBeTruthy();
  expect(Notification.permission).toBe("granted");expect(browserNoticesEnabled()).toBe(false);
});
it("does not request permission on render and does not pretend unsupported contexts work",()=>{
  vi.stubGlobal("isSecureContext",false);render(<Probe/>);
  expect(screen.getByText("Inactivos")).toBeTruthy();expect(Notification.requestPermission).not.toHaveBeenCalled();
});
it("local belt and location alerts honor the same opt-out as remote incidents",()=>{
  const delivered=vi.fn();
  class Notice {static permission="granted";constructor(){delivered();}}
  vi.stubGlobal("Notification",Notice);
  setBrowserNotices(false);showBrowserAlert("Prueba","Sin envío real");
  expect(delivered).not.toHaveBeenCalled();
  setBrowserNotices(true);showBrowserAlert("Prueba","Sin envío real");
  expect(delivered).toHaveBeenCalledTimes(1);
});
