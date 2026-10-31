import { useSyncExternalStore } from "react";

const KEY = "sfa-browser-notices-v1";
const CHANGED = "sfa-browser-notices-changed";
let fallback: boolean | undefined;
export function browserNoticeSnapshot() {
  const supported = typeof Notification !== "undefined" && window.isSecureContext;
  let preference = fallback;
  try { const saved = localStorage.getItem(KEY); if (saved !== null) preference = saved === "on"; } catch { /* Private browser storage may be unavailable. */ }
  const permission = supported ? Notification.permission : "unsupported";
  return `${permission}:${preference === false ? "off" : "on"}`;
}
export function browserNoticesEnabled() { return browserNoticeSnapshot() === "granted:on"; }
export function setBrowserNotices(enabled: boolean) {
  fallback = enabled;
  try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch { /* Keep the preference for this page when storage is blocked. */ }
  window.dispatchEvent(new Event(CHANGED));
}
export async function enableBrowserNotices() {
  if (typeof Notification === "undefined" || !window.isSecureContext) return false;
  const permission = await Notification.requestPermission();
  setBrowserNotices(permission === "granted");
  return permission === "granted";
}
function subscribe(callback: () => void) {
  window.addEventListener(CHANGED, callback); window.addEventListener("storage", callback); window.addEventListener("focus", callback);
  return () => { window.removeEventListener(CHANGED, callback); window.removeEventListener("storage", callback); window.removeEventListener("focus", callback); };
}
export function useBrowserNotices() {
  const snapshot = useSyncExternalStore(subscribe, browserNoticeSnapshot);
  const [permission, preference] = snapshot.split(":");
  return { permission, supported: permission !== "unsupported", enabled: permission === "granted" && preference === "on" };
}
