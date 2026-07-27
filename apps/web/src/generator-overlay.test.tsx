import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Konva from "konva";
import { renderToStaticMarkup } from "react-dom/server";
import { createGeneratorNode } from "./generator-node.js";
import { GeneratorOverlay, ImageSettingsPopover, generatorOverlayPlacement, generatorOverlayTransform } from "./generator-overlay.js";

describe("generator overlay placement", () => {
  it("keeps IME composition local until the browser commits it", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "generator-overlay.tsx"), "utf8");
    expect(source).toContain("onCompositionStart");
    expect(source).toContain("onCompositionEnd");
    expect(source).toContain("setPromptDraft");
    expect(source).toContain("composingPrompt.current");
  });

  it("renders a named primary generation action without a fake cost control", () => {
    const node = createGeneratorNode("image", { x: 700, y: 600 }, () => "generator");
    node.generator = { ...node.generator!, prompt: "白猫", modelId: "wan" };
    const markup = renderToStaticMarkup(
      <GeneratorOverlay
        node={node}
        position={{ left: 0, top: 0, side: "bottom" }}
        models={[{
          id: "wan", label: "万相", description: "", available: true,
          supportsReferences: true, qualities: ["auto"], sizePresets: ["auto"], maxOutputCount: 4,
        }]}
        onChange={() => undefined}
        onRemoveReference={() => undefined}
        onSubmit={() => undefined}
        onUploadReference={() => undefined}
      />,
    );
    expect(markup).toContain(">生成</span>");
    expect(markup).not.toContain("canvas-generator-cost");
  });

  it("renders fixed-seed input and disables multi-output choices", () => {
    const node = createGeneratorNode("image", { x: 700, y: 600 }, () => "generator");
    node.generator = {
      ...node.generator!,
      prompt: "白猫",
      modelId: "wan",
      outputCount: 1,
      seedMode: "fixed",
      seed: 123456,
    };
    const markup = renderToStaticMarkup(
      <ImageSettingsPopover
        config={node.generator!}
        model={{
          id: "wan", label: "万相", description: "", available: true,
          supportsReferences: true, qualities: ["auto"], sizePresets: ["auto"], maxOutputCount: 4,
        }}
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain("随机种子");
    expect(markup).toContain('aria-label="固定种子"');
    expect(markup).toContain('value="123456"');
    expect(markup).toMatch(/>2 张<\/button>/);
    expect(markup).toMatch(/disabled=""[^>]*>2 张<\/button>/);
    expect(markup).toMatch(/disabled=""[^>]*>4 张<\/button>/);
  });

  it("anchors below a focused generator when the viewport has room", () => {
    expect(generatorOverlayPlacement(
      { x: 200, y: 100, width: 400, height: 200 },
      { width: 1000, height: 800 },
      { width: 450, height: 140 },
    )).toEqual({ left: 175, top: 308, side: "bottom" });
  });

  it("flips above a generator near the bottom edge", () => {
    expect(generatorOverlayPlacement(
      { x: 200, y: 650, width: 400, height: 200 },
      { width: 1000, height: 800 },
      { width: 450, height: 140 },
    )).toEqual({ left: 175, top: 502, side: "top" });
  });

  it("keeps the form inside the horizontal safe area", () => {
    expect(generatorOverlayPlacement(
      { x: -100, y: 100, width: 200, height: 100 },
      { width: 800, height: 600 },
      { width: 450, height: 140 },
    ).left).toBe(12);
  });

  it("derives the form position from the live Konva transform while dragging", () => {
    const group = new Konva.Group({ x: 100, y: 50, scaleX: 2, scaleY: 2 });
    group.add(new Konva.Rect({ width: 200, height: 100 }));

    expect(generatorOverlayTransform(
      group.getAbsoluteTransform().decompose(),
      { width: 200, height: 100 },
      { width: 1000, height: 800 },
      { width: 450, height: 150 },
    )).toMatchObject({ x: 75, y: 258, rotation: 0, scaleX: 1, scaleY: 1 });

    group.position({ x: 180, y: 120 });

    expect(generatorOverlayTransform(
      group.getAbsoluteTransform().decompose(),
      { width: 200, height: 100 },
      { width: 1000, height: 800 },
      { width: 450, height: 150 },
    )).toMatchObject({ x: 155, y: 328, rotation: 0, scaleX: 1, scaleY: 1 });
  });

  it("keeps the form screen-aligned below a rotated generator", () => {
    const group = new Konva.Group({ x: 300, y: 200, rotation: 90 });
    group.add(new Konva.Rect({ width: 200, height: 100 }));

    expect(generatorOverlayTransform(
      group.getAbsoluteTransform().decompose(),
      { width: 200, height: 100 },
      { width: 1000, height: 800 },
      { width: 450, height: 150 },
    )).toMatchObject({ x: 25, y: 408, rotation: 0, scaleX: 1, scaleY: 1 });
  });

  it("flips above the live transformed bounds near the viewport bottom", () => {
    const group = new Konva.Group({ x: 200, y: 650 });
    group.add(new Konva.Rect({ width: 400, height: 100 }));

    expect(generatorOverlayTransform(
      group.getAbsoluteTransform().decompose(),
      { width: 400, height: 100 },
      { width: 1000, height: 800 },
      { width: 450, height: 140 },
    )).toMatchObject({ x: 175, y: 502, rotation: 0, scaleX: 1, scaleY: 1 });
  });

  it("does not collapse the form width inside a zero-sized Konva portal host", () => {
    const node = createGeneratorNode("image", { x: 700, y: 600 }, () => "generator");
    const markup = renderToStaticMarkup(
      <GeneratorOverlay
        embedded
        node={node}
        position={{ left: 0, top: 0, side: "bottom" }}
        onChange={() => undefined}
        onRemoveReference={() => undefined}
        onSubmit={() => undefined}
        onUploadReference={() => undefined}
      />,
    );

    expect(markup).toContain("max-width:none");
  });
});
