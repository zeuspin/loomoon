import type { CanvasNode } from "@loomoon/contracts";
import type Konva from "konva";

export type CanvasNodeTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export function syncSelectionTransformer(
  transformer: Konva.Transformer,
  target: Konva.Node
): void {
  transformer.nodes([target]);
  transformer.forceUpdate();
  transformer.getLayer()?.batchDraw();
}

export function transformCanvasNode(
  node: CanvasNode,
  transform: CanvasNodeTransform
): CanvasNode {
  if (node.locked) {
    return node;
  }

  const width = Math.max(1, transform.width);
  const height = Math.max(1, transform.height);

  if (node.type === "path" && node.points) {
    const scaleX = width / Math.max(1, node.width);
    const scaleY = height / Math.max(1, node.height);

    return {
      ...node,
      ...transform,
      width,
      height,
      points: node.points.map((value, index) =>
        value * (index % 2 === 0 ? scaleX : scaleY)
      )
    };
  }

  return {
    ...node,
    ...transform,
    width,
    height
  };
}
