import type { CanvasNode, GeneratorConfig, ImageModelCapability, ImageQuality, ImageSizePreset } from "@loomoon/contracts";
import { RiArrowDownSLine, RiAttachment2, RiCloseLine, RiImageLine, RiSparkling2Line } from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Html, type HtmlTransformAttrs } from "react-konva-utils";
import { generatorSeedModePatch, validateGeneratorConfig } from "./generator-node.js";
import { generatorSettingsSummary } from "./generator-node.js";

type Rect = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

export type GeneratorOverlayPosition = {
  left: number;
  top: number;
  side: "bottom" | "top";
};

export function generatorOverlayPlacement(
  nodeRect: Rect,
  viewport: Size,
  overlay: Size,
): GeneratorOverlayPosition {
  const gap = 8;
  const safe = 12;
  const left = Math.max(
    safe,
    Math.min(
      nodeRect.x + nodeRect.width / 2 - overlay.width / 2,
      viewport.width - overlay.width - safe,
    ),
  );
  if (nodeRect.y + nodeRect.height + gap + overlay.height <= viewport.height - safe) {
    return { left, top: nodeRect.y + nodeRect.height + gap, side: "bottom" };
  }
  return {
    left,
    top: Math.max(safe, nodeRect.y - overlay.height - gap),
    side: "top",
  };
}

export function generatorOverlayTransform(
  transform: HtmlTransformAttrs,
  node: Size,
  viewport: Size,
  overlay: Size,
): HtmlTransformAttrs {
  const angle = transform.rotation * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const corners = [
    { x: 0, y: 0 },
    { x: node.width, y: 0 },
    { x: 0, y: node.height },
    { x: node.width, y: node.height },
  ].map((corner) => {
    const scaledX = corner.x * transform.scaleX;
    const scaledY = corner.y * transform.scaleY;
    return {
      x: transform.x + scaledX * cosine - scaledY * sine,
      y: transform.y + scaledX * sine + scaledY * cosine,
    };
  });
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  const placement = generatorOverlayPlacement(
    { x: left, y: top, width: right - left, height: bottom - top },
    viewport,
    overlay,
  );
  return {
    ...transform,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    skewY: 0,
    x: placement.left,
    y: placement.top,
  };
}

const videoModels: ImageModelCapability[] = [
  { id: "loomoon-video-v1", label: "智能视频 V1", description: "", available: true, supportsReferences: true, qualities: ["auto" as const], sizePresets: ["auto" as const], maxOutputCount: 1 },
];

type GeneratorOverlayActions = {
  models?: ImageModelCapability[];
  onChange: (patch: Partial<GeneratorConfig>) => void;
  onRemoveReference: (url: string) => void;
  onSelectFromCanvas?: () => void;
  onSubmit: () => void;
  onUploadReference: (file: File) => void;
};

export function GeneratorNodePortal({
  node,
  positionSide,
  showForm,
  viewport,
  ...actions
}: GeneratorOverlayActions & {
  node: CanvasNode;
  positionSide: GeneratorOverlayPosition["side"];
  showForm: boolean;
  viewport: Size;
}) {
  const overlay = {
    height: 240,
    width: Math.min(560, viewport.width - 24),
  };
  const positionForm = useCallback(
    (transform: HtmlTransformAttrs) => generatorOverlayTransform(
      transform,
      { height: node.height, width: node.width },
      viewport,
      overlay,
    ),
    [node.height, node.width, overlay.height, overlay.width, viewport.height, viewport.width],
  );
  const positionIcon = useCallback((transform: HtmlTransformAttrs): HtmlTransformAttrs => ({
    ...transform,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    skewY: 0,
  }), []);

  return (
    <>
      <Html
        groupProps={{ x: node.width / 2, y: node.height / 2 }}
        transformFunc={positionIcon}
      >
        <div aria-hidden="true" className="canvas-generator-placeholder-icon">
          <RiImageLine />
        </div>
      </Html>
      {showForm && (
        <Html
          divProps={{ className: "canvas-generator-portal" }}
          transformFunc={positionForm}
        >
          <GeneratorOverlay
            {...actions}
            embedded
            node={node}
            position={{ left: 0, top: 0, side: positionSide }}
          />
        </Html>
      )}
    </>
  );
}

export function GeneratorOverlay({
  embedded = false,
  models: actionsModels = [],
  node,
  position,
  onChange,
  onRemoveReference,
  onSelectFromCanvas,
  onSubmit,
  onUploadReference,
}: GeneratorOverlayActions & {
  embedded?: boolean;
  node: CanvasNode;
  position: GeneratorOverlayPosition;
}) {
  const config = node.generator;
  if (!config) return null;
  const video = node.type === "video-generator";
  const validation = validateGeneratorConfig(config);
  const models = video ? videoModels : actionsModels;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [referenceMenuOpen, setReferenceMenuOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState(config.prompt);
  const composingPrompt = useRef(false);
  const settingsWrapRef = useRef<HTMLDivElement>(null);
  const referenceAddRef = useRef<HTMLDivElement>(null);
  const selectedModel = models.find((model) => model.id === config.modelId);
  useEffect(() => {
    if (!composingPrompt.current) setPromptDraft(config.prompt);
  }, [config.prompt]);
  useEffect(() => {
    if (!settingsOpen && !referenceMenuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!settingsWrapRef.current?.contains(target)) setSettingsOpen(false);
      if (!referenceAddRef.current?.contains(target)) setReferenceMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [referenceMenuOpen, settingsOpen]);
  return (
    <form
      className={`canvas-generator-card canvas-generator-card--${position.side}`}
      style={{ left: position.left, maxWidth: embedded ? "none" : undefined, top: position.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        if (validation.valid) onSubmit();
      }}
    >
      <div className="canvas-generator-reference-row">
        {config.referenceAssetUrls.length > 0 && (
          <div className="canvas-generator-references">
          {config.referenceAssetUrls.map((url) => (
            <span key={url}>
              <img alt="参考图" src={url} />
              <button aria-label="移除参考图" onClick={() => onRemoveReference(url)} type="button"><RiCloseLine /></button>
            </span>
          ))}
          </div>
        )}
        <div className="canvas-generator-reference-add" ref={referenceAddRef}>
          <button
            aria-label="添加参考图"
            className="canvas-generator-reference-tile"
            disabled={config.referenceAssetUrls.length >= 9}
            title={config.referenceAssetUrls.length >= 9 ? "参考图最多 9 张" : "添加参考图"}
            type="button"
            onClick={() => setReferenceMenuOpen((open) => !open)}
          >
            <RiImageLine /><span>参考图</span>
          </button>
          {referenceMenuOpen && config.referenceAssetUrls.length < 9 && <div className="canvas-generator-reference-menu">
            <label><RiAttachment2 />从本地上传图片<input hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
              for (const file of [...(event.target.files ?? [])]) await onUploadReference(file);
              event.target.value = "";
              setReferenceMenuOpen(false);
            }} /></label>
            <button type="button" onClick={() => { setReferenceMenuOpen(false); onSelectFromCanvas?.(); }}><RiImageLine />从画布选择</button>
          </div>}
        </div>
      </div>
      <textarea
        aria-label="生成描述"
        onChange={(event) => {
          setPromptDraft(event.target.value);
          if (!composingPrompt.current) onChange({ prompt: event.target.value });
        }}
        onCompositionStart={() => {
          composingPrompt.current = true;
        }}
        onCompositionEnd={(event) => {
          composingPrompt.current = false;
          setPromptDraft(event.currentTarget.value);
          onChange({ prompt: event.currentTarget.value });
        }}
        placeholder="今天我们要创作什么"
        value={promptDraft}
      />
      <footer>
        <div className="canvas-generator-settings-wrap" ref={settingsWrapRef}>
          <button className="canvas-generator-settings-trigger" type="button" onClick={() => setSettingsOpen((open) => !open)}>
            {generatorSettingsSummary(config)} <RiArrowDownSLine />
          </button>
          {settingsOpen && !video && <ImageSettingsPopover config={config} {...(selectedModel ? { model: selectedModel } : {})} onChange={onChange} />}
        </div>
        <select aria-label="生成模型" value={config.modelId} onChange={(event) => onChange({ modelId: event.target.value })}>
          {!config.modelId && <option value="">选择模型</option>}
          {models.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
        </select>
        {selectedModel?.costEstimate && <span className="canvas-generator-cost">⚡ {selectedModel.costEstimate.replace(/\D/g, "")}</span>}
        <button className="canvas-generator-submit" aria-label="开始生成" disabled={!validation.valid || config.status === "running" || config.status === "submitting"} type="submit"><RiSparkling2Line /><span>{config.status === "running" || config.status === "submitting" ? "生成中" : "生成"}</span></button>
      </footer>
      {!validation.valid && config.prompt.length > 0 && <small className="canvas-generator-error">{validation.reason}</small>}
    </form>
  );
}

export function ImageSettingsPopover({
  config,
  model,
  onChange,
}: {
  config: GeneratorConfig;
  model?: ImageModelCapability;
  onChange: (patch: Partial<GeneratorConfig>) => void;
}) {
  const qualityOptions: Array<{ value: ImageQuality; label: string }> = [
    { value: "auto", label: "自动" },
    { value: "high", label: "高" },
    { value: "medium", label: "中" },
    { value: "low", label: "低" },
  ];
  const presets: Array<{ value: ImageSizePreset; label: string; ratio: string }> = [
    { value: "1:1", label: "1:1", ratio: "square" },
    { value: "3:2", label: "3:2", ratio: "landscape" },
    { value: "2:3", label: "2:3", ratio: "portrait" },
    { value: "4:3", label: "4:3", ratio: "landscape" },
    { value: "3:4", label: "3:4", ratio: "portrait" },
    { value: "9:16", label: "9:16", ratio: "portrait" },
    { value: "1:1-2k", label: "1:1(2K)", ratio: "square" },
    { value: "16:9-2k", label: "16:9(2K)", ratio: "landscape" },
    { value: "9:16-2k", label: "9:16(2K)", ratio: "portrait" },
    { value: "16:9-4k", label: "16:9(4K)", ratio: "landscape" },
    { value: "9:16-4k", label: "9:16(4K)", ratio: "portrait" },
    { value: "auto", label: "auto", ratio: "auto" },
  ];
  const seedMode = config.seedMode ?? "random";
  return <section className="canvas-image-settings" aria-label="图像设置">
    <h3>图像设置</h3>
    <h4>质量</h4>
    <div className="canvas-image-quality">
      {qualityOptions.filter((option) => !model || model.qualities.includes(option.value)).map((option) => (
        <button type="button" className={(config.quality ?? "auto") === option.value ? "is-selected" : ""} key={option.value} onClick={() => onChange({ quality: option.value })}>{option.label}</button>
      ))}
    </div>
    <h4>尺寸 <small>ⓘ</small></h4>
    <div className="canvas-image-dimensions">
      <label>W <input aria-label="宽度" type="number" min="256" max="4096" value={config.width ?? 1024} onChange={(event) => onChange({ width: Number(event.target.value), sizePreset: "custom" })} /></label>
      <span>⛓</span>
      <label>H <input aria-label="高度" type="number" min="256" max="4096" value={config.height ?? 1024} onChange={(event) => onChange({ height: Number(event.target.value), sizePreset: "custom" })} /></label>
    </div>
    <h4>宽高比 <small>ⓘ</small></h4>
    <div className="canvas-image-presets">
      {presets.filter((preset) => !model || model.sizePresets.includes(preset.value)).map((preset) => (
        <button type="button" className={config.sizePreset === preset.value ? "is-selected" : ""} key={preset.value} onClick={() => onChange({ sizePreset: preset.value, aspectRatio: preset.label.replace(/\(.+\)/, "") })}>
          {preset.ratio !== "auto" && <i data-ratio={preset.ratio} />}
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
    <h4>输出数量</h4>
    <div className="canvas-image-quality">
      {[1, 2, 4].filter((count) => count <= (model?.maxOutputCount ?? 4)).map((count) => <button type="button" disabled={seedMode === "fixed" && count !== 1} className={config.outputCount === count ? "is-selected" : ""} key={count} onClick={() => onChange({ outputCount: count })}>{count} 张</button>)}
    </div>
    <h4>随机种子</h4>
    <div className="canvas-image-seed-mode">
      <button type="button" className={seedMode === "random" ? "is-selected" : ""} onClick={() => onChange(generatorSeedModePatch("random"))}>随机</button>
      <button type="button" className={seedMode === "fixed" ? "is-selected" : ""} onClick={() => onChange({ ...generatorSeedModePatch("fixed"), ...(config.seed === undefined ? { seed: 0 } : {}) })}>固定</button>
    </div>
    {seedMode === "fixed" && <label className="canvas-image-seed-input">
      <span>Seed</span>
      <input aria-label="固定种子" type="number" min="0" max="2147483647" step="1" value={config.seed ?? 0} onChange={(event) => onChange({ seed: Number(event.target.value) })} />
    </label>}
  </section>;
}
