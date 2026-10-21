export function isLocalPortal(location: Pick<Location, "hostname" | "pathname">): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) && location.pathname.startsWith("/acceso/");
}

export function sampleAge(observed: string, now = Date.now()): number | null {
  const time = Date.parse(observed);
  return Number.isFinite(time) ? Math.max(0, (now - time) / 1000) : null;
}

export function isFreshSample(observed: string, simulated: boolean, now = Date.now()): boolean {
  const time = Date.parse(observed);
  return !simulated && Number.isFinite(time) && time <= now + 5000 && now - time <= 15000;
}
