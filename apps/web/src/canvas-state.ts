import type { CanvasNode } from "@loomoon/contracts";

export function selectionAfterClick(current: string[], id: string, additive: boolean): string[] {
  if (!additive) return [id];
  if (current.includes(id)) return current.filter((item) => item !== id);
  return current.length >= 8 ? current : [...current, id];
}

export function updateNodePosition(nodes: CanvasNode[], id: string, x: number, y: number): CanvasNode[] {
  return nodes.map((node) => (node.id === id && !node.locked ? { ...node, x, y } : node));
}

export function moveNodeOrGroup(nodes: CanvasNode[], id: string, x: number, y: number): CanvasNode[] {
  const target = nodes.find((node) => node.id === id);
  if (!target || target.locked) return nodes;
  const dx = x - target.x;
  const dy = y - target.y;
  if (!target.groupId) return updateNodePosition(nodes, id, x, y);
  return nodes.map((node) =>
    node.groupId === target.groupId && !node.locked
      ? { ...node, x: node.x + dx, y: node.y + dy }
      : node
  );
}

export function moveNodeOrSelection(
  nodes: CanvasNode[],
  id: string,
  x: number,
  y: number,
  selection: string[]
): CanvasNode[] {
  const target = nodes.find((node) => node.id === id);
  if (!target || target.locked) return nodes;
  if (selection.length <= 1 || !selection.includes(id)) return moveNodeOrGroup(nodes, id, x, y);
  const dx = x - target.x;
  const dy = y - target.y;
  return nodes.map((node) =>
    selection.includes(node.id) && !node.locked
      ? { ...node, x: node.x + dx, y: node.y + dy }
      : node
  );
}

export function reorderNode(nodes: CanvasNode[], id: string, direction: "front" | "back"): CanvasNode[] {
  const target = nodes.find((node) => node.id === id);
  if (!target) return nodes;
  const remaining = nodes.filter((node) => node.id !== id);
  return direction === "front" ? [...remaining, target] : [target, ...remaining];
}

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function nodesInRect(nodes: CanvasNode[], rect: SelectionRect): string[] {
  return nodes
    .filter((node) => node.visible !== false)
    .filter(
      (node) =>
        node.x < rect.x + rect.width &&
        node.x + node.width > rect.x &&
        node.y < rect.y + rect.height &&
        node.y + node.height > rect.y
    )
    .slice(0, 8)
    .map((node) => node.id);
}

interface Point {
  x: number;
  y: number;
}

export function focusNodeInViewport(input: {
  node: CanvasNode;
  position: Point;
  reserveBottom?: number;
  scale: number;
  viewport: { width: number; height: number };
}): { scale: number; position: Point } {
  const padding = 40;
  const reserveBottom = input.reserveBottom ?? 0;
  const usableRight = input.viewport.width - padding;
  const usableBottom = input.viewport.height - reserveBottom - padding;
  const screenLeft = input.node.x * input.scale + input.position.x;
  const screenTop = input.node.y * input.scale + input.position.y;
  const screenRight = screenLeft + input.node.width * input.scale;
  const screenBottom = screenTop + input.node.height * input.scale;
  if (
    screenLeft >= padding &&
    screenTop >= padding &&
    screenRight <= usableRight &&
    screenBottom <= usableBottom
  ) {
    return { scale: input.scale, position: input.position };
  }

  const usableWidth = Math.max(1, input.viewport.width - padding * 2);
  const usableHeight = Math.max(1, input.viewport.height - reserveBottom - padding * 2);
  const scale = Math.max(0.25, Math.min(
    input.scale,
    usableWidth / input.node.width,
    usableHeight / input.node.height,
  ));
  return {
    scale,
    position: {
      x: padding + (usableWidth - input.node.width * scale) / 2 - input.node.x * scale,
      y: padding + (usableHeight - input.node.height * scale) / 2 - input.node.y * scale,
    },
  };
}

export function zoomStageAroundPoint(input: {
  scale: number;
  position: Point;
  pointer: Point;
  delta: number;
  minScale: number;
  maxScale: number;
}): { scale: number; position: Point } {
  const nextScale = Math.min(input.maxScale, Math.max(input.minScale, input.scale + input.delta));
  if (nextScale === input.scale) return { scale: input.scale, position: input.position };

  const canvasPoint = {
    x: (input.pointer.x - input.position.x) / input.scale,
    y: (input.pointer.y - input.position.y) / input.scale,
  };

  return {
    scale: nextScale,
    position: {
      x: input.pointer.x - canvasPoint.x * nextScale,
      y: input.pointer.y - canvasPoint.y * nextScale,
    },
  };
}
