import { describe, expect, it } from "vitest";
import type { CanvasNode } from "@loomoon/contracts";
import Konva from "konva";
import * as canvasTransform from "./canvas-transform.js";
import { transformCanvasNode } from "./canvas-transform.js";

const image: CanvasNode = {
  height: 100,
  id: "image",
  type: "image",
  width: 200,
  x: 10,
  y: 20,
};

describe("transformCanvasNode", () => {
  it("persists position, size and rotation for ordinary objects", () => {
    expect(transformCanvasNode(image, {
      height: 150,
      rotation: 18,
      width: 300,
      x: 40,
      y: 50,
    })).toMatchObject({ height: 150, rotation: 18, width: 300, x: 40, y: 50 });
  });

  it("scales path points with its bounds", () => {
    const path: CanvasNode = {
      ...image,
      id: "path",
      points: [0, 0, 100, 50, 200, 100],
      type: "path",
    };
    expect(transformCanvasNode(path, {
      height: 50,
      rotation: 0,
      width: 100,
      x: 10,
      y: 20,
    }).points).toEqual([0, 0, 50, 25, 100, 50]);
  });

  it("does not transform a locked object", () => {
    const locked = { ...image, locked: true };
    expect(transformCanvasNode(locked, {
      height: 10,
      rotation: 0,
      width: 10,
      x: 0,
      y: 0,
    })).toBe(locked);
  });

  it("invalidates the transformer bounds after a node is resized", () => {
    const group = new Konva.Group();
    const rect = new Konva.Rect({ height: 1024, width: 1024 });
    const transformer = new Konva.Transformer();
    group.add(rect);
    transformer.nodes([group]);

    rect.size({ height: 258, width: 258 });
    expect(transformer.width()).toBe(1024);

    const syncSelectionTransformer = (
      canvasTransform as unknown as {
        syncSelectionTransformer?: (
          transformer: Konva.Transformer,
          target: Konva.Node
        ) => void;
      }
    ).syncSelectionTransformer;
    expect(syncSelectionTransformer).toBeTypeOf("function");
    syncSelectionTransformer!(transformer, group);

    expect(transformer.width()).toBe(258);
    expect(transformer.height()).toBe(258);
  });
});
