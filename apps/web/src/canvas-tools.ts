import type { CanvasNode, DemoProject } from "@loomoon/contracts";
import { normalizeCanvasNode } from "@loomoon/canvas-domain";

export type CanvasToolNodeKind =
  | "rectangle"
  | "circle"
  | "triangle"
  | "star"
  | "speech"
  | "arrow"
  | "pencil"
  | "pen";

export const generatorCanvasColors = {
  error: "#b94f43",
  fill: "#dcecff",
  pencil: "#222222",
  placeholder: "#6f65bb",
  selection: "#5aaee8",
} as const;

const toolGlyphs: Record<CanvasToolNodeKind, string> = {
  rectangle: "■",
  circle: "●",
  triangle: "▲",
  star: "★",
  speech: "▰  对话文字",
  arrow: "➜",
  pencil: "〰〰〰",
  pen: "⌁⌁⌁",
};

export function createCanvasToolNode(
  kind: CanvasToolNodeKind,
  createId: () => string = () => crypto.randomUUID(),
): CanvasNode {
  return {
    id: createId(),
    type: "text",
    x: 180,
    y: 180,
    width: kind === "speech" ? 300 : 180,
    height: kind === "speech" ? 100 : 180,
    text: toolGlyphs[kind],
  };
}

export function projectIdFromLocation(search: string): string | undefined {
  return new URLSearchParams(search).get("projectId")?.trim() || undefined;
}

export function canvasNodesForProject(project: DemoProject): CanvasNode[] {
  return project.canvas.nodes.map(normalizeCanvasNode);
}
