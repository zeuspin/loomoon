import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api.js";

describe("API request headers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not declare JSON content when a request has no body", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.bootstrap();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("maps an empty service response to a stable reconnecting error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 502 })));

    await expect(api.bootstrap()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: 502,
      message: "服务正在重新连接，请稍后重试。"
    });
  });
});
