import type {
  CanvasGeneratorSnapshot,
  ImageModelCapability,
  ImageQuality,
  ImageSizePreset,
} from "@loomoon/contracts";

type CatalogConfig = {
  primaryModelId: string;
  fallbackModelId: string;
  draftModelId: string;
};

const qualities: ImageQuality[] = ["auto", "high", "medium", "low"];
const sizePresets: ImageSizePreset[] = [
  "auto", "1:1", "3:2", "2:3", "4:3", "3:4", "9:16",
  "1:1-2k", "16:9-2k", "9:16-2k", "16:9-4k", "9:16-4k", "custom",
];
const presetDimensions: Partial<Record<ImageSizePreset, { width: number; height: number }>> = {
  "1:1": { width: 1024, height: 1024 },
  "3:2": { width: 1536, height: 1024 },
  "2:3": { width: 1024, height: 1536 },
  "4:3": { width: 1365, height: 1024 },
  "3:4": { width: 1024, height: 1365 },
  "9:16": { width: 1024, height: 1820 },
  "1:1-2k": { width: 2048, height: 2048 },
  "16:9-2k": { width: 2048, height: 1152 },
  "9:16-2k": { width: 1152, height: 2048 },
  "16:9-4k": { width: 4096, height: 2304 },
  "9:16-4k": { width: 2304, height: 4096 },
};

export function createImageModelCatalog(config: CatalogConfig): ImageModelCapability[] {
  const definitions = [
    {
      id: config.primaryModelId,
      label: "万相 Pro",
      description: "高质量通用图像生成",
      costEstimate: "预计 15",
    },
    {
      id: config.fallbackModelId,
      label: "Qwen Image Pro",
      description: "适合文字与复杂构图",
      costEstimate: "预计 15",
    },
    {
      id: config.draftModelId,
      label: "万相快速草图",
      description: "快速探索视觉方向",
      costEstimate: "预计 5",
    },
  ];
  const seen = new Set<string>();
  return definitions.flatMap((definition) => {
    const id = definition.id.trim();
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{
      ...definition,
      id,
      available: true,
      supportsReferences: true,
      qualities: [...qualities],
      sizePresets: [...sizePresets],
      maxOutputCount: 4,
    }];
  });
}

export function normalizeGeneratorSnapshot(
  input: unknown,
  catalog: ImageModelCapability[],
): CanvasGeneratorSnapshot {
  if (!isRecord(input)) throw new Error("INVALID_GENERATOR_CONFIG");
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const modelId = typeof input.modelId === "string" ? input.modelId : "";
  const model = catalog.find((item) => item.id === modelId && item.available);
  if (!model) throw new Error("IMAGE_MODEL_UNAVAILABLE");
  const quality = input.quality;
  const sizePreset = input.sizePreset;
  const outputCount = input.outputCount;
  const aspectRatio = input.aspectRatio;
  const references = input.referenceAssetUrls;
  const seedMode = input.seedMode === undefined ? "random" : input.seedMode;
  const seed = input.seed;
  if (
    !prompt || !isQuality(quality) || !model.qualities.includes(quality) ||
    !isSizePreset(sizePreset) || !model.sizePresets.includes(sizePreset) ||
    typeof outputCount !== "number" || ![1, 2, 4].includes(outputCount) ||
    outputCount > model.maxOutputCount || typeof aspectRatio !== "string" ||
    !Array.isArray(references) || !references.every((item) => typeof item === "string")
  ) {
    throw new Error("INVALID_GENERATOR_CONFIG");
  }
  if (
    (seedMode !== "random" && seedMode !== "fixed") ||
    (seedMode === "fixed" && (outputCount !== 1 || !isSeed(seed)))
  ) {
    throw new Error("INVALID_GENERATOR_CONFIG");
  }
  if (references.length > 0 && !model.supportsReferences) {
    throw new Error("INVALID_GENERATOR_CONFIG");
  }
  const width = input.width;
  const height = input.height;
  if (sizePreset === "custom" && (!isDimension(width) || !isDimension(height))) {
    throw new Error("INVALID_GENERATOR_CONFIG");
  }
  const dimensions = sizePreset === "custom"
    ? { width: width as number, height: height as number }
    : presetDimensions[sizePreset];
  return {
    prompt,
    modelId,
    quality,
    sizePreset,
    aspectRatio,
    outputCount,
    referenceAssetUrls: [...references],
    seedMode,
    ...(seedMode === "fixed" ? { seed: seed as number } : {}),
    ...(dimensions ? dimensions : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isQuality(value: unknown): value is ImageQuality {
  return typeof value === "string" && qualities.includes(value as ImageQuality);
}

function isSizePreset(value: unknown): value is ImageSizePreset {
  return typeof value === "string" && sizePresets.includes(value as ImageSizePreset);
}

function isDimension(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 256 && value <= 4096;
}

function isSeed(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2147483647;
}
