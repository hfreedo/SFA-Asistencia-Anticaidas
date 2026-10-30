import { defineConfig, loadEnv, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { localProxyOrigin } from "./localProxyOrigin.ts";
import { devBackend } from "./devBackend.ts";

export default defineConfig(async ({ mode, command }): Promise<UserConfig> => {
  const backend=command==="serve" ? await devBackend() : {target:"http://127.0.0.1:8780",agent:undefined};
  // The local dashboard now embeds access. Reuse only its two public settings.
  const access = loadEnv("acceso", process.cwd(), "VITE_");
  const current = loadEnv(mode, process.cwd(), "VITE_");
  return ({
  define: Object.fromEntries(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"].map(name =>
    [`import.meta.env.${name}`, JSON.stringify(process.env[name] ?? current[name] ?? access[name] ?? "")])),
  base: mode === "acceso" ? "./" : "/static/",
  publicDir: mode === "acceso" ? false : "public",
  plugins: [react(), tailwindcss(), {
    name: "dev-access-csp",
    transformIndexHtml(html) {
      return command === "serve" ? html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'") : html;
    },
  }],
  build: {
    outDir: mode === "acceso" ? "dist-acceso" : "static",
    emptyOutDir: true,
    rollupOptions: { input: mode === "acceso" ? "acceso.html" : "index.html" },
  },
  server: {
    proxy: {
      "/api": { target: backend.target, agent:backend.agent, changeOrigin:true, configure(proxy) {
        proxy.on("proxyReq",(outgoing,request)=>{
          const origin=localProxyOrigin(request.headers.origin,request.headers.host,request.socket.remoteAddress,request.headers["sec-fetch-site"] as string | undefined,backend.target);
          if(origin) outgoing.setHeader("Origin",origin);
        });
      } },
      "/ws": { target: backend.target.replace(/^http/,"ws"), agent:backend.agent, ws: true, changeOrigin:true, configure(proxy) {
        proxy.on("proxyReqWs",(outgoing,request)=>{
          const origin=localProxyOrigin(request.headers.origin,request.headers.host,request.socket.remoteAddress,request.headers["sec-fetch-site"] as string | undefined,backend.target);
          if(origin) outgoing.setHeader("Origin",origin);
        });
      } },
    },
  },
});
});
