import { describe, expect, it } from "vitest";
import type { CanvasNode } from "@loomoon/contracts";
import {
  deleteLayer,
  layerItemsForNodes,
  reorderLayer,
  renameLayer,
  toggleLayerLock,
  toggleLayerVisibility,
} from "./layer-state.js";

const back: CanvasNode = {
  id: "back",
  type: "image",
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  name: "背景",
};
const front: CanvasNode = { ...back, id: "front", name: "前景" };

describe("layer panel ordering", () => {
  it("presents frontmost render nodes first", () => {
    expect(layerItemsForNodes([back, front]).map((node) => node.id)).toEqual([
      "front",
      "back",
    ]);
  });

  it("moves a layer by panel index while preserving render order semantics", () => {
    expect(reorderLayer([back, front], "back", 0).map((node) => node.id)).toEqual([
      "front",
      "back",
    ]);
    expect(reorderLayer([back, front], "front", 1).map((node) => node.id)).toEqual([
      "front",
      "back",
    ]);
  });
});

describe("layer mutations", () => {
  it("toggles visibility and locking independently", () => {
    expect(toggleLayerVisibility([front], "front")[0]?.visible).toBe(false);
    expect(toggleLayerLock([front], "front")[0]?.locked).toBe(true);
  });

  it("does not delete locked layers", () => {
    expect(deleteLayer([{ ...back, locked: true }], "back")).toHaveLength(1);
    expect(deleteLayer([back], "back")).toHaveLength(0);
  });

  it("trims names and rejects an empty rename", () => {
    expect(renameLayer([front], "front", "  主视觉  ")[0]?.name).toBe("主视觉");
    expect(renameLayer([front], "front", "   ")[0]?.name).toBe("前景");
  });
});
