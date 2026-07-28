import type { CanvasNode } from "@loomoon/contracts";

export function layerItemsForNodes(nodes: CanvasNode[]): CanvasNode[] {
  return [...nodes].reverse();
}

export function reorderLayer(
  nodes: CanvasNode[],
  nodeId: string,
  panelIndex: number,
): CanvasNode[] {
  const panelItems = layerItemsForNodes(nodes);
  const target = panelItems.find((node) => node.id === nodeId);
  if (!target) return nodes;
  const remaining = panelItems.filter((node) => node.id !== nodeId);
  const nextIndex = Math.max(0, Math.min(panelIndex, remaining.length));
  remaining.splice(nextIndex, 0, target);
  return remaining.reverse();
}

export function toggleLayerVisibility(
  nodes: CanvasNode[],
  nodeId: string,
): CanvasNode[] {
  return nodes.map((node) =>
    node.id === nodeId ? { ...node, visible: node.visible === false } : node,
  );
}

export function toggleLayerLock(
  nodes: CanvasNode[],
  nodeId: string,
): CanvasNode[] {
  return nodes.map((node) =>
    node.id === nodeId ? { ...node, locked: !node.locked } : node,
  );
}

export function deleteLayer(nodes: CanvasNode[], nodeId: string): CanvasNode[] {
  return nodes.filter((node) => node.id !== nodeId || node.locked);
}

export function renameLayer(
  nodes: CanvasNode[],
  nodeId: string,
  name: string,
): CanvasNode[] {
  const trimmed = name.trim();
  if (!trimmed) return nodes;
  return nodes.map((node) => node.id === nodeId ? { ...node, name: trimmed } : node);
}
