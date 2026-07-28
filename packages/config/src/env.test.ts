import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env.js";

const valid = {
  NODE_ENV: "development",
  API_HOST: "0.0.0.0",
  API_PORT: "3000",
  PUBLIC_APP_URL: "http://localhost:5173",
  DATABASE_URL: "postgresql://loomoon:loomoon@localhost:5432/loomoon",
  REDIS_URL: "redis://localhost:6379",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "loomoon-assets",
  S3_ACCESS_KEY_ID: "loomoon",
  S3_SECRET_ACCESS_KEY: "secret",
  JWT_SIGNING_KEY: "a".repeat(32),
  BAILIAN_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  BAILIAN_API_KEY: "sk-test",
  BAILIAN_AGENT_MODEL: "qwen3.7-plus-2026-05-26",
  BAILIAN_FAST_MODEL: "qwen3.6-flash-2026-04-16",
  BAILIAN_IMAGE_MODEL: "wan2.7-image-pro",
  BAILIAN_IMAGE_FALLBACK_MODEL: "qwen-image-2.0-pro-2026-06-22",
  ENABLE_LEGACY_MASK_EDIT: "false"
};

describe("parseServerEnv", () => {
  it("parses valid configuration and coerces numeric and boolean values", () => {
    const env = parseServerEnv(valid);

    expect(env.API_PORT).toBe(3000);
    expect(env.ENABLE_LEGACY_MASK_EDIT).toBe(false);
  });

  it("rejects a missing Bailian API key", () => {
    expect(() =>
      parseServerEnv({ ...valid, BAILIAN_API_KEY: "" })
    ).toThrow(/BAILIAN_API_KEY/);
  });

  it("rejects the documented placeholder Bailian API key", () => {
    expect(() =>
      parseServerEnv({
        ...valid,
        BAILIAN_API_KEY: "replace-with-your-bailian-api-key"
      })
    ).toThrow(/BAILIAN_API_KEY/);
  });

  it("provides the documented fallback and draft image models", () => {
    const env = parseServerEnv({
      ...valid,
      BAILIAN_IMAGE_FALLBACK_MODEL: undefined,
      BAILIAN_DRAFT_IMAGE_MODEL: undefined,
    });

    expect(env.BAILIAN_IMAGE_FALLBACK_MODEL).toBe("qwen-image-2.0-pro-2026-06-22");
    expect(env.BAILIAN_DRAFT_IMAGE_MODEL).toBe("wan2.7-image");
  });
});
