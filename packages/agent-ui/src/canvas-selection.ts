import type { CanvasNode } from "@loomoon/contracts";
import type { CanvasSelectionAttachment } from "./model.js";

export function createCanvasSelectionAttachment(
  nodes: readonly CanvasNode[],
  canvasVersion: number,
): CanvasSelectionAttachment | undefined {
  const images = nodes.filter(
    (
      node,
    ): node is CanvasNode & { assetId: string; assetUrl: string } =>
      node.type === "image" &&
      Boolean(node.assetId) &&
      Boolean(node.assetUrl),
  );

  if (images.length === 0) return undefined;

  return {
    type: "canvas-selection",
    canvasVersion,
    nodeIds: images.map((node) => node.id),
    assets: images.map((node) => ({
      assetId: node.assetId,
      thumbnailUrl: node.assetUrl,
      width: node.width,
      height: node.height,
    })),
  };
}
