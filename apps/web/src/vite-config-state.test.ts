import { describe, expect, it } from "vitest";
import {
  resolveApiProxyTarget,
  resolveWebServerConfig,
} from "../vite.config.js";

describe("Vite API proxy target", () => {
  it("keeps the Loomoon web server fixed on Chrome-safe port 6001", () => {
    expect(resolveWebServerConfig()).toEqual({
      host: "::",
      port: 6001,
      strictPort: true,
    });
  });

  it("uses the repository API port when an explicit proxy target is absent", () => {
    expect(resolveApiProxyTarget({ API_PORT: "3002" })).toBe(
      "http://127.0.0.1:3002",
    );
  });

  it("prefers an explicit proxy target", () => {
    expect(
      resolveApiProxyTarget({
        API_PORT: "3002",
        LOOMOON_API_PROXY_TARGET: "http://api.internal:9000",
      }),
    ).toBe("http://api.internal:9000");
  });
});
