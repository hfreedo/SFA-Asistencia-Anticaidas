export type AccessMode = "login" | "recovery" | "password";

export function accessFailure(stage: string, reason: unknown): Error {
  const value = reason as { code?: unknown; status?: unknown } | null;
  const code = typeof value?.code === "string" && /^[A-Za-z0-9_]{2,40}$/.test(value.code)
    ? value.code : typeof value?.status === "number" ? String(value.status) : "REQUEST";
  return new Error(`${stage}:${code}`);
}

export function callbackMode(search: string, hash: string): AccessMode {
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const query = new URLSearchParams(search);
  const type = fragment.get("type");
  return type === "invite" || type === "recovery" || query.get("flow") === "recovery"
    ? "password" : "login";
}

export function accessUrl(href: string, recovery = false): string {
  const url = new URL("acceso.html", href);
  if (recovery) url.searchParams.set("flow", "recovery");
  return url.href;
}

export function validateConfiguration(url: string, key: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co") ||
        parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      return "La dirección de Supabase no es válida.";
    }
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
      return "Configura una clave publicable de Supabase, nunca una clave secreta.";
    }
    return null;
  } catch {
    return "Falta configurar la conexión con Supabase.";
  }
}

export function passwordProblem(password: string, confirmation: string): string | null {
  if (password.length < 12) return "Utiliza al menos 12 caracteres.";
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  return null;
}
