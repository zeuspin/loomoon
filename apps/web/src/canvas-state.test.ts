import { describe, expect, it } from "vitest";
import type { CanvasNode } from "@loomoon/contracts";
import {
  focusNodeInViewport,
  moveNodeOrGroup,
  moveNodeOrSelection,
  nodesInRect,
  reorderNode,
  selectionAfterClick,
  updateNodePosition,
  zoomStageAroundPoint,
} from "./canvas-state.js";

const node: CanvasNode = {
  id: "one",
  type: "image",
  x: 0,
  y: 0,
  width: 100,
  height: 100
};

describe("selectionAfterClick", () => {
  it("replaces selection on a normal click and toggles with shift", () => {
    expect(selectionAfterClick(["other"], "one", false)).toEqual(["one"]);
    expect(selectionAfterClick(["other"], "one", true)).toEqual(["other", "one"]);
    expect(selectionAfterClick(["other", "one"], "one", true)).toEqual(["other"]);
  });
});

describe("nodesInRect", () => {
  it("returns every visible canvas object intersecting a marquee rectangle", () => {
    const inside = { ...node, id: "inside", x: 20, y: 20 };
    const text = { ...node, id: "text", type: "text" as const, x: 80, y: 80 };
    const hidden = { ...node, id: "hidden", visible: false, x: 40, y: 40 };
    const outside = { ...node, id: "outside", x: 400, y: 400 };
    expect(nodesInRect([inside, text, hidden, outside], { x: 0, y: 0, width: 180, height: 180 })).toEqual(["inside", "text"]);
  });
});

describe("focusNodeInViewport", () => {
  it("centers and scales a distant large object into the usable viewport", () => {
    const result = focusNodeInViewport({
      node: { ...node, x: 900, y: 700, width: 1024, height: 1024 },
      position: { x: 0, y: 0 },
      reserveBottom: 180,
      scale: 0.72,
      viewport: { width: 1000, height: 700 },
    });
    const screenX = 900 * result.scale + result.position.x;
    const screenY = 700 * result.scale + result.position.y;
    expect(screenX).toBeGreaterThanOrEqual(40);
    expect(screenY).toBeGreaterThanOrEqual(40);
    expect(screenX + 1024 * result.scale).toBeLessThanOrEqual(960);
    expect(screenY + 1024 * result.scale).toBeLessThanOrEqual(480);
  });

  it("does not move an object that is already fully visible", () => {
    expect(focusNodeInViewport({
      node: { ...node, x: 100, y: 100 },
      position: { x: 0, y: 0 },
      reserveBottom: 0,
      scale: 1,
      viewport: { width: 800, height: 600 },
    })).toEqual({ position: { x: 0, y: 0 }, scale: 1 });
  });
});

describe("updateNodePosition", () => {
  it("returns a new node collection with the selected node moved", () => {
    const result = updateNodePosition([node], "one", 42, 64);
    expect(result[0]).toMatchObject({ x: 42, y: 64 });
    expect(result).not.toBe([node]);
  });
});

describe("group canvas operations", () => {
  it("moves grouped nodes while preserving their relative positions", () => {
    const grouped = [
      { ...node, id: "a", groupId: "group", x: 10, y: 20 },
      { ...node, id: "b", groupId: "group", x: 80, y: 90 }
    ];
    const moved = moveNodeOrGroup(grouped, "a", 30, 50);
    expect(moved.map(({ x, y }) => [x, y])).toEqual([[30, 50], [100, 120]]);
  });

  it("moves an ungrouped selection while preserving relative positions", () => {
    const selected = [
      { ...node, id: "a", x: 10, y: 20 },
      { ...node, id: "b", x: 80, y: 90 },
      { ...node, id: "c", x: 160, y: 180 }
    ];
    const moved = moveNodeOrSelection(selected, "a", 30, 50, ["a", "b"]);
    expect(moved.map(({ x, y }) => [x, y])).toEqual([[30, 50], [100, 120], [160, 180]]);
  });

  it("moves a node to the front without changing its identity", () => {
    const result = reorderNode([{ ...node, id: "a" }, { ...node, id: "b" }], "a", "front");
    expect(result.map((item) => item.id)).toEqual(["b", "a"]);
  });
});

describe("zoomStageAroundPoint", () => {
  it("keeps the canvas point under the mouse stable while zooming", () => {
    const result = zoomStageAroundPoint({
      scale: 1,
      position: { x: 50, y: 20 },
      pointer: { x: 250, y: 220 },
      delta: 0.25,
      minScale: 0.25,
      maxScale: 1.8,
    });

    expect(result.scale).toBe(1.25);
    expect(result.position).toEqual({ x: 0, y: -30 });
  });

  it("does not move the stage when zoom is already clamped", () => {
    const result = zoomStageAroundPoint({
      scale: 1.8,
      position: { x: 50, y: 20 },
      pointer: { x: 250, y: 220 },
      delta: 0.25,
      minScale: 0.25,
      maxScale: 1.8,
    });

    expect(result).toEqual({
      scale: 1.8,
      position: { x: 50, y: 20 },
    });
  });
});
