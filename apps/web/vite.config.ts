import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export function resolveApiProxyTarget(
  env: Record<string, string | undefined>,
): string {
  return (
    env.LOOMOON_API_PROXY_TARGET ??
    `http://127.0.0.1:${env.API_PORT || "3000"}`
  );
}

export function resolveWebServerConfig() {
  return {
    host: "::",
    port: 6001,
    strictPort: true,
  } as const;
}

export default defineConfig(({ mode }) => {
  const env = {
    ...process.env,
    ...loadEnv(mode, "../../", ""),
  };
  const apiProxyTarget = resolveApiProxyTarget(env);
  return {
    plugins: [react(), tailwindcss()],
    server: {
      ...resolveWebServerConfig(),
      proxy: {
        "/api": apiProxyTarget,
        "/assets": apiProxyTarget,
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
    },
  };
});
