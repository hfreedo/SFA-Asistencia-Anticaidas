import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/static/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "static",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8780",
      "/ws": { target: "ws://127.0.0.1:8780", ws: true },
    },
  },
});
