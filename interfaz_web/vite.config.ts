import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
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
}));
