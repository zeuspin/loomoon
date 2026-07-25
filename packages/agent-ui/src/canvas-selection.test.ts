import type { CanvasNode } from "@loomoon/contracts";
import { describe, expect, test } from "vitest";
import { createCanvasSelectionAttachment } from "./canvas-selection.js";

describe("createCanvasSelectionAttachment", () => {
  test("captures only usable image assets in selection order", () => {
    const nodes: CanvasNode[] = [
      {
        id: "node-1",
        type: "image",
        x: 0,
        y: 0,
        width: 640,
        height: 480,
        assetId: "asset-1",
        assetUrl: "/assets/1",
      },
      {
        id: "placeholder-1",
        type: "generation-placeholder",
        x: 0,
        y: 0,
        width: 320,
        height: 320,
      },
      {
        id: "node-2",
        type: "image",
        x: 0,
        y: 0,
        width: 512,
        height: 512,
        assetId: "asset-2",
        assetUrl: "/assets/2",
      },
    ];

    expect(createCanvasSelectionAttachment(nodes, 7)).toEqual({
      type: "canvas-selection",
      canvasVersion: 7,
      nodeIds: ["node-1", "node-2"],
      assets: [
        {
          assetId: "asset-1",
          thumbnailUrl: "/assets/1",
          width: 640,
          height: 480,
        },
        {
          assetId: "asset-2",
          thumbnailUrl: "/assets/2",
          width: 512,
          height: 512,
        },
      ],
    });
  });
});
