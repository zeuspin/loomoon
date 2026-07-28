import { describe, expect, it } from "vitest";
import { createImageModelCatalog, normalizeGeneratorSnapshot } from "./image-model-catalog.js";

const catalog = createImageModelCatalog({
  primaryModelId: "wan2.7-image-pro",
  fallbackModelId: "qwen-image-2.0-pro-2026-06-22",
  draftModelId: "wan2.7-image",
});

describe("image model catalog", () => {
  it("publishes each configured model once", () => {
    expect(catalog.map((model) => model.id)).toEqual([
      "wan2.7-image-pro",
      "qwen-image-2.0-pro-2026-06-22",
      "wan2.7-image",
    ]);
    expect(createImageModelCatalog({
      primaryModelId: "same",
      fallbackModelId: "same",
      draftModelId: "same",
    })).toHaveLength(1);
  });

  it("normalizes a valid custom generator snapshot", () => {
    expect(normalizeGeneratorSnapshot({
      prompt: "  一只月光下的白猫  ",
      modelId: "wan2.7-image-pro",
      quality: "high",
      sizePreset: "custom",
      width: 1024,
      height: 1536,
      aspectRatio: "2:3",
      outputCount: 4,
      referenceAssetUrls: [],
    }, catalog)).toMatchObject({
      prompt: "一只月光下的白猫",
      width: 1024,
      height: 1536,
      outputCount: 4,
      seedMode: "random",
    });
  });

  it("accepts one fixed seed and preserves it", () => {
    expect(normalizeGeneratorSnapshot({
      prompt: "白猫",
      modelId: "wan2.7-image-pro",
      quality: "auto",
      sizePreset: "auto",
      aspectRatio: "1:1",
      outputCount: 1,
      referenceAssetUrls: [],
      seedMode: "fixed",
      seed: 2147483647,
    }, catalog)).toMatchObject({ seedMode: "fixed", seed: 2147483647, outputCount: 1 });
  });

  it("rejects fixed seeds outside the supported range and fixed multi-output", () => {
    const fixed = {
      prompt: "白猫",
      modelId: "wan2.7-image-pro",
      quality: "auto",
      sizePreset: "auto",
      aspectRatio: "1:1",
      outputCount: 1,
      referenceAssetUrls: [],
      seedMode: "fixed",
      seed: 42,
    };
    expect(() => normalizeGeneratorSnapshot({ ...fixed, seed: -1 }, catalog)).toThrow("INVALID_GENERATOR_CONFIG");
    expect(() => normalizeGeneratorSnapshot({ ...fixed, seed: 2147483648 }, catalog)).toThrow("INVALID_GENERATOR_CONFIG");
    expect(() => normalizeGeneratorSnapshot({ ...fixed, outputCount: 2 }, catalog)).toThrow("INVALID_GENERATOR_CONFIG");
  });

  it("rejects unknown models and unsupported counts", () => {
    const base = {
      prompt: "白猫",
      modelId: "unknown",
      quality: "auto",
      sizePreset: "auto",
      aspectRatio: "1:1",
      outputCount: 1,
      referenceAssetUrls: [],
    };
    expect(() => normalizeGeneratorSnapshot(base, catalog)).toThrow("IMAGE_MODEL_UNAVAILABLE");
    expect(() => normalizeGeneratorSnapshot({
      ...base,
      modelId: "wan2.7-image-pro",
      outputCount: 3,
    }, catalog)).toThrow("INVALID_GENERATOR_CONFIG");
  });

  it("rejects custom dimensions outside the supported range", () => {
    expect(() => normalizeGeneratorSnapshot({
      prompt: "白猫",
      modelId: "wan2.7-image-pro",
      quality: "auto",
      sizePreset: "custom",
      width: 128,
      height: 1024,
      aspectRatio: "1:1",
      outputCount: 1,
      referenceAssetUrls: [],
    }, catalog)).toThrow("INVALID_GENERATOR_CONFIG");
  });

  it("maps high resolution presets to concrete provider dimensions", () => {
    expect(normalizeGeneratorSnapshot({
      prompt: "电影海报",
      modelId: "wan2.7-image-pro",
      quality: "high",
      sizePreset: "16:9-4k",
      aspectRatio: "16:9",
      outputCount: 1,
      referenceAssetUrls: [],
    }, catalog)).toMatchObject({ width: 4096, height: 2304 });
  });
});
