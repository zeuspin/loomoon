import { describe, expect, it } from "vitest";
import {
  createGeneratorNode,
  generatorSettingsSummary,
  generatorDisplayDimensions,
  appendGeneratorReferences,
  generatorSeedModePatch,
  generationFailureMessage,
  normalizeGeneratorNodesForModels,
  resolveGeneratorModelId,
  updateGeneratorConfig,
  validateGeneratorConfig,
} from "./generator-node.js";

describe("generator nodes", () => {
  it("creates a configured image generator centered on the requested point", () => {
    const node = createGeneratorNode("image", { x: 700, y: 600 }, () => "gen-1");

    expect(node).toMatchObject({
      id: "gen-1",
      type: "image-generator",
      width: 1024,
      height: 1024,
      x: 188,
      y: 88,
      generator: {
        aspectRatio: "1:1",
        modelId: "",
        outputCount: 4,
        prompt: "",
        quality: "auto",
        sizePreset: "auto",
        seedMode: "random",
        status: "draft",
      },
    });
  });

  it("preserves available model IDs and replaces stale IDs with the first available model", () => {
    const models = [
      { id: "wan-pro", available: true },
      { id: "wan-fast", available: true },
    ];
    expect(resolveGeneratorModelId("wan-fast", models)).toBe("wan-fast");
    expect(resolveGeneratorModelId("loomoon-image-v2", models)).toBe("wan-pro");
    expect(resolveGeneratorModelId("", models)).toBe("wan-pro");
    expect(resolveGeneratorModelId("stale", [])).toBe("stale");
  });

  it("normalizes legacy image generators without changing video generators", () => {
    const image = createGeneratorNode("image", { x: 0, y: 0 }, () => "image");
    image.generator = { ...image.generator!, modelId: "loomoon-image-v2" };
    delete image.generator.seedMode;
    const video = createGeneratorNode("video", { x: 0, y: 0 }, () => "video");

    const normalized = normalizeGeneratorNodesForModels([image, video], [{ id: "wan-pro", available: true }]);

    expect(normalized[0]?.generator).toMatchObject({ modelId: "wan-pro", seedMode: "random" });
    expect(normalized[1]).toEqual(video);
  });

  it("forces one output for fixed seeds and leaves one output when returning to random", () => {
    expect(generatorSeedModePatch("fixed")).toEqual({ seedMode: "fixed", outputCount: 1 });
    expect(generatorSeedModePatch("random")).toEqual({ seedMode: "random" });
  });

  it("explains provider failures without the ambiguous selected retry instruction", () => {
    expect(generationFailureMessage({ errorCode: "BAILIAN_RATE_LIMITED" })).toBe("请求过于频繁，请稍后重试");
    expect(generationFailureMessage({
      errorCode: "BAILIAN_INVALID_RESPONSE",
      providerErrorCode: "InvalidParameter",
      providerErrorMessage: "size is not supported",
      providerRequestId: "request-1",
    })).toBe("InvalidParameter：size is not supported（请求 ID：request-1）");
    expect(generationFailureMessage({ errorCode: "BAILIAN_INVALID_RESPONSE" })).toBe("模型返回了无效结果");
  });

  it("uses video defaults without sharing image configuration", () => {
    const node = createGeneratorNode("video", { x: 700, y: 500 }, () => "gen-2");

    expect(node).toMatchObject({
      type: "video-generator",
      width: 1280,
      height: 720,
      generator: {
        aspectRatio: "16:9",
        modelId: "loomoon-video-v1",
        outputCount: 1,
      },
    });
  });

  it("updates a generator draft without mutating the original node", () => {
    const node = createGeneratorNode("image", { x: 700, y: 600 }, () => "gen-1");
    const updated = updateGeneratorConfig(node, { prompt: "  一只白猫  " });

    expect(updated.generator?.prompt).toBe("  一只白猫  ");
    expect(node.generator?.prompt).toBe("");
  });

  it("requires a prompt and an available model before submission", () => {
    const node = createGeneratorNode("image", { x: 700, y: 600 }, () => "gen-1");

    expect(validateGeneratorConfig(node.generator!)).toEqual({ valid: false, reason: "请输入提示词" });
    expect(validateGeneratorConfig({ ...node.generator!, prompt: "白猫", modelId: "" })).toEqual({ valid: false, reason: "请选择生成模型" });
    expect(validateGeneratorConfig({ ...node.generator!, prompt: " 白猫 ", modelId: "wan2.7-image-pro" })).toEqual({ valid: true });
  });

  it("summarizes quality, size, and output count in Chinese", () => {
    const node = createGeneratorNode("image", { x: 700, y: 600 }, () => "gen-1");
    expect(generatorSettingsSummary({
      ...node.generator!,
      quality: "medium",
      sizePreset: "auto",
      outputCount: 1,
    })).toBe("中 · auto · 1 张");
  });

  it("maps selected output ratios to a bounded canvas placeholder", () => {
    expect(generatorDisplayDimensions({
      ...createGeneratorNode("image", { x: 0, y: 0 }).generator!,
      aspectRatio: "3:4",
      sizePreset: "3:4",
    })).toEqual({ width: 768, height: 1024 });
    expect(generatorDisplayDimensions({
      ...createGeneratorNode("image", { x: 0, y: 0 }).generator!,
      aspectRatio: "16:9",
      sizePreset: "16:9-4k",
    })).toEqual({ width: 1024, height: 576 });
    expect(generatorDisplayDimensions({
      ...createGeneratorNode("image", { x: 0, y: 0 }).generator!,
      sizePreset: "custom",
      width: 800,
      height: 1200,
    })).toEqual({ width: 683, height: 1024 });
  });

  it("appends unique references in order and caps the queue at nine", () => {
    expect(appendGeneratorReferences(
      ["a", "b"],
      ["b", "c", "d", "e", "f", "g", "h", "i", "j", "k"],
    )).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
  });
});
