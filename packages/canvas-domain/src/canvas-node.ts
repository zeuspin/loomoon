import type { CanvasNode } from "@loomoon/contracts";

const typeLabels: Record<CanvasNode["type"], string> = {
  artboard: "画板",
  "generation-placeholder": "生成结果",
  "image-generator": "图片生成器",
  image: "图片",
  path: "画笔",
  shape: "形状",
  text: "文字",
  "video-generator": "视频生成器",
};

export function normalizeCanvasNode(node: CanvasNode, index = 0): CanvasNode {
  return {
    ...node,
    locked: node.locked ?? false,
    name: node.name?.trim() || `${typeLabels[node.type]} ${index + 1}`,
    rotation: node.rotation ?? 0,
    visible: node.visible ?? true,
  };
}

export function isNodeVisible(node: CanvasNode): boolean {
  return node.visible !== false;
}

export function isNodeEditable(node: CanvasNode): boolean {
  return isNodeVisible(node) && node.locked !== true;
}
