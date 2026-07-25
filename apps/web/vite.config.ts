import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiProxyTarget =
  process.env.LOOMOON_API_PROXY_TARGET ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": apiProxyTarget,
      "/assets": apiProxyTarget
    }
  },
  build: {
    chunkSizeWarningLimit: 600
  }
});
