import { describe, expect, it } from "vitest";
import type { CanvasNode } from "@loomoon/contracts";
import {
  beginCanvasPointer,
  endCanvasPointer,
  moveCanvasPointer,
  type CanvasControllerState,
} from "./canvas-controller.js";

const image: CanvasNode = {
  id: "image",
  type: "image",
  x: 10,
  y: 20,
  width: 100,
  height: 100,
};

function state(tool: CanvasControllerState["tool"]): CanvasControllerState {
  return {
    camera: { x: 0, y: 0 },
    interaction: { kind: "idle" },
    nodes: [image],
    selection: ["image"],
    tool,
  };
}

describe("Canvas pointer ownership", () => {
  it("pans the camera without moving or selecting an image in hand mode", () => {
    const started = beginCanvasPointer(state("hand"), { kind: "node", nodeId: "image" }, { x: 100, y: 100 });
    const moved = moveCanvasPointer(started, { x: 180, y: 160 });

    expect(moved.camera).toEqual({ x: 80, y: 60 });
    expect(moved.nodes[0]).toMatchObject({ x: 10, y: 20 });
    expect(moved.selection).toEqual(["image"]);
  });

  it("draws over an image without moving or selecting it", () => {
    const started = beginCanvasPointer({ ...state("draw"), selection: [] }, { kind: "node", nodeId: "image" }, { x: 100, y: 100 });
    const moved = moveCanvasPointer(started, { x: 160, y: 140 });
    const completed = endCanvasPointer(moved, () => "path-1");

    expect(completed.nodes.find((node) => node.id === "image")).toMatchObject({ x: 10, y: 20 });
    expect(completed.nodes.at(-1)).toMatchObject({ id: "path-1", type: "path", points: [100, 100, 160, 140] });
    expect(completed.selection).toEqual([]);
  });

  it("moves only the selected image in select mode", () => {
    const started = beginCanvasPointer(state("select"), { kind: "node", nodeId: "image" }, { x: 100, y: 100 });
    const moved = moveCanvasPointer(started, { x: 180, y: 160 });

    expect(moved.nodes[0]).toMatchObject({ x: 90, y: 80 });
    expect(moved.camera).toEqual({ x: 0, y: 0 });
  });

  it("starts marquee selection when select drags on the empty canvas", () => {
    const started = beginCanvasPointer(state("select"), { kind: "canvas" }, { x: 20, y: 30 });
    const moved = moveCanvasPointer(started, { x: 120, y: 150 });

    expect(moved.interaction).toEqual({
      kind: "marquee",
      origin: { x: 20, y: 30 },
      current: { x: 120, y: 150 },
    });
  });
});
