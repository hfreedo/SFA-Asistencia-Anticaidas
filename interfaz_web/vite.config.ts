import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // The local dashboard now embeds access. Reuse only its two public settings.
  const access = loadEnv("acceso", process.cwd(), "VITE_");
  const current = loadEnv(mode, process.cwd(), "VITE_");
  return ({
  define: Object.fromEntries(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"].map(name =>
    [`import.meta.env.${name}`, JSON.stringify(process.env[name] ?? current[name] ?? access[name] ?? "")])),
  base: mode === "acceso" ? "./" : "/static/",
  publicDir: mode === "acceso" ? false : "public",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: mode === "acceso" ? "dist-acceso" : "static",
    emptyOutDir: true,
    rollupOptions: { input: mode === "acceso" ? "acceso.html" : "index.html" },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8780",
      "/ws": { target: "ws://127.0.0.1:8780", ws: true },
    },
  },
});
});
