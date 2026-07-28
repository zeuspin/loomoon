import { describe, expect, it } from "vitest";
import type { CanvasNode } from "@loomoon/contracts";
import {
  isNodeEditable,
  isNodeVisible,
  normalizeCanvasNode,
} from "./canvas-node.js";

const legacyImage: CanvasNode = {
  id: "image-1",
  type: "image",
  x: 10,
  y: 20,
  width: 100,
  height: 80,
  assetUrl: "/image.webp",
};

describe("normalizeCanvasNode", () => {
  it("adds deterministic interaction defaults to a legacy node", () => {
    expect(normalizeCanvasNode(legacyImage, 2)).toMatchObject({
      id: "image-1",
      locked: false,
      name: "图片 3",
      rotation: 0,
      visible: true,
    });
  });

  it("preserves explicit visibility, locking and name", () => {
    expect(normalizeCanvasNode({
      ...legacyImage,
      locked: true,
      name: "主视觉",
      rotation: 15,
      visible: false,
    }, 0)).toMatchObject({
      locked: true,
      name: "主视觉",
      rotation: 15,
      visible: false,
    });
  });
});

describe("Canvas node interaction rules", () => {
  it("excludes hidden nodes from rendering and interaction", () => {
    expect(isNodeVisible({ ...legacyImage, visible: false })).toBe(false);
    expect(isNodeVisible(legacyImage)).toBe(true);
  });

  it("prevents locked or hidden nodes from being edited", () => {
    expect(isNodeEditable({ ...legacyImage, locked: true })).toBe(false);
    expect(isNodeEditable({ ...legacyImage, visible: false })).toBe(false);
    expect(isNodeEditable(legacyImage)).toBe(true);
  });
});
