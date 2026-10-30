export function localProxyOrigin(origin: string | undefined, host: string | undefined, peer: string | undefined, site: string | undefined, backend="http://127.0.0.1:8780") {
  if (!origin || !host || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer ?? "") || site === "cross-site") return origin;
  try {
    const target = new URL(`http://${host}`);
    if (["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && origin === target.origin && target.host === host) return backend;
  } catch { /* Preserve invalid origins so the backend rejects them. */ }
  return origin;
}
