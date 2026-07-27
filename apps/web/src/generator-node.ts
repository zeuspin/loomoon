import type { CanvasNode, GeneratorConfig, ImageSeedMode } from "@loomoon/contracts";

type Point = { x: number; y: number };

export function createGeneratorNode(
  kind: "image" | "video",
  center: Point,
  createId: () => string = () => crypto.randomUUID(),
): CanvasNode {
  const width = kind === "image" ? 1024 : 1280;
  const height = kind === "image" ? 1024 : 720;
  return {
    generator: {
      aspectRatio: kind === "image" ? "1:1" : "16:9",
      modelId: kind === "image" ? "" : "loomoon-video-v1",
      outputCount: kind === "image" ? 4 : 1,
      prompt: "",
      quality: "auto",
      referenceAssetUrls: [],
      referenceNodeIds: [],
      sizePreset: "auto",
      seedMode: "random",
      status: "draft",
    },
    height,
    id: createId(),
    locked: false,
    name: kind === "image" ? "图片生成器" : "视频生成器",
    rotation: 0,
    type: kind === "image" ? "image-generator" : "video-generator",
    visible: true,
    width,
    x: center.x - width / 2,
    y: center.y - height / 2,
  };
}

export function updateGeneratorConfig(
  node: CanvasNode,
  patch: Partial<GeneratorConfig>,
): CanvasNode {
  if (!node.generator) return node;
  return { ...node, generator: { ...node.generator, ...patch } };
}

export function validateGeneratorConfig(
  config: GeneratorConfig,
): { valid: true } | { valid: false; reason: string } {
  if (!config.prompt.trim()) return { valid: false, reason: "请输入提示词" };
  if (!config.modelId.trim()) return { valid: false, reason: "请选择生成模型" };
  if (config.seedMode === "fixed" && (
    config.outputCount !== 1 || config.seed === undefined ||
    !Number.isInteger(config.seed) || config.seed < 0 || config.seed > 2147483647
  )) return { valid: false, reason: "请输入 0–2147483647 的固定种子" };
  return { valid: true };
}

export function resolveGeneratorModelId(
  modelId: string,
  models: Array<Pick<{ id: string; available: boolean }, "id" | "available">>,
): string {
  if (models.some((model) => model.available && model.id === modelId)) return modelId;
  return models.find((model) => model.available)?.id ?? modelId;
}

export function normalizeGeneratorNodesForModels(
  nodes: CanvasNode[],
  models: Array<Pick<{ id: string; available: boolean }, "id" | "available">>,
): CanvasNode[] {
  return nodes.map((node) => {
    if (node.type !== "image-generator" || !node.generator) return node;
    const modelId = resolveGeneratorModelId(node.generator.modelId, models);
    const seedMode = node.generator.seedMode ?? "random";
    if (modelId === node.generator.modelId && seedMode === node.generator.seedMode) return node;
    return updateGeneratorConfig(node, { modelId, seedMode });
  });
}

export function generatorSeedModePatch(mode: ImageSeedMode): Partial<GeneratorConfig> {
  return mode === "fixed"
    ? { seedMode: "fixed", outputCount: 1 }
    : { seedMode: "random" };
}

export function generationFailureMessage(
  failure: Pick<CanvasNode, "errorCode" | "providerErrorCode" | "providerErrorMessage" | "providerRequestId">,
): string {
  if (failure.providerErrorCode || failure.providerErrorMessage) {
    const detail = [failure.providerErrorCode, failure.providerErrorMessage].filter(Boolean).join("：");
    return failure.providerRequestId ? `${detail}（请求 ID：${failure.providerRequestId}）` : detail;
  }
  const messages: Record<string, string> = {
    BAILIAN_AUTH_ERROR: "模型服务配置异常",
    BAILIAN_RATE_LIMITED: "请求过于频繁，请稍后重试",
    BAILIAN_TIMEOUT: "生成超时，请重试",
    BAILIAN_INVALID_RESPONSE: "模型返回了无效结果",
    BAILIAN_UNAVAILABLE: "模型服务暂时不可用",
  };
  return failure.errorCode ? messages[failure.errorCode] ?? "生成失败" : "生成失败";
}

export function isGeneratorNode(node: CanvasNode): boolean {
  return node.type === "image-generator" || node.type === "video-generator";
}

export function generatorSettingsSummary(config: GeneratorConfig): string {
  const quality = {
    auto: "自动",
    high: "高",
    medium: "中",
    low: "低",
  }[config.quality ?? "auto"];
  const size = config.sizePreset === "custom" && config.width && config.height
    ? `${config.width}×${config.height}`
    : (config.sizePreset ?? "auto").replace(/-(\d+k)$/i, "($1)");
  return `${quality} · ${size} · ${config.outputCount} 张`;
}

export function generatorDisplayDimensions(config: GeneratorConfig): {
  width: number;
  height: number;
} {
  let sourceWidth = config.width;
  let sourceHeight = config.height;
  if (config.sizePreset !== "custom" || !sourceWidth || !sourceHeight) {
    const ratio = /^(\d+):(\d+)/.exec(config.aspectRatio);
    sourceWidth = Number(ratio?.[1] ?? 1);
    sourceHeight = Number(ratio?.[2] ?? 1);
  }
  const scale = 1024 / Math.max(sourceWidth, sourceHeight);
  return {
    width: Math.round(sourceWidth * scale),
    height: Math.round(sourceHeight * scale),
  };
}

export function appendGeneratorReferences(
  current: string[],
  incoming: string[],
  maximum = 9,
): string[] {
  return [...new Set([...current, ...incoming])].slice(0, maximum);
}
