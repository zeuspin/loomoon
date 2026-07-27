import type { CanvasNode } from "@loomoon/contracts";
import type { CanvasTool } from "./canvas-tool-state.js";

type Point = { x: number; y: number };
type Camera = Point;
type PointerTarget = { kind: "canvas" } | { kind: "node"; nodeId: string };

export type CanvasInteraction =
  | { kind: "idle" }
  | { kind: "panning"; origin: Point; initialCamera: Camera }
  | { kind: "drawing"; points: number[] }
  | { kind: "marquee"; origin: Point; current: Point }
  | {
      kind: "moving-selection";
      origin: Point;
      originalNodes: CanvasNode[];
      selectedIds: string[];
    };

export type CanvasControllerState = {
  camera: Camera;
  interaction: CanvasInteraction;
  nodes: CanvasNode[];
  selection: string[];
  tool: CanvasTool;
};

export function beginCanvasPointer(
  state: CanvasControllerState,
  target: PointerTarget,
  point: Point,
): CanvasControllerState {
  if (state.tool === "hand") {
    return {
      ...state,
      interaction: { kind: "panning", origin: point, initialCamera: state.camera },
    };
  }
  if (state.tool === "draw") {
    return { ...state, interaction: { kind: "drawing", points: [point.x, point.y] } };
  }
  if (state.tool === "select" && target.kind === "canvas") {
    return {
      ...state,
      interaction: { kind: "marquee", origin: point, current: point },
    };
  }
  if (state.tool === "select" && target.kind === "node") {
    const selectedIds = state.selection.includes(target.nodeId)
      ? state.selection
      : [target.nodeId];
    return {
      ...state,
      interaction: {
        kind: "moving-selection",
        origin: point,
        originalNodes: state.nodes,
        selectedIds,
      },
      selection: selectedIds,
    };
  }
  return state;
}

export function moveCanvasPointer(
  state: CanvasControllerState,
  point: Point,
): CanvasControllerState {
  const interaction = state.interaction;
  if (interaction.kind === "panning") {
    return {
      ...state,
      camera: {
        x: interaction.initialCamera.x + point.x - interaction.origin.x,
        y: interaction.initialCamera.y + point.y - interaction.origin.y,
      },
    };
  }
  if (interaction.kind === "drawing") {
    return {
      ...state,
      interaction: { ...interaction, points: [...interaction.points, point.x, point.y] },
    };
  }
  if (interaction.kind === "marquee") {
    return { ...state, interaction: { ...interaction, current: point } };
  }
  if (interaction.kind === "moving-selection") {
    const dx = point.x - interaction.origin.x;
    const dy = point.y - interaction.origin.y;
    return {
      ...state,
      nodes: interaction.originalNodes.map((node) =>
        interaction.selectedIds.includes(node.id) && !node.locked
          ? { ...node, x: node.x + dx, y: node.y + dy }
          : node,
      ),
    };
  }
  return state;
}

export function endCanvasPointer(
  state: CanvasControllerState,
  createId: () => string = () => crypto.randomUUID(),
): CanvasControllerState {
  const interaction = state.interaction;
  if (interaction.kind !== "drawing" || interaction.points.length < 4) {
    return { ...state, interaction: { kind: "idle" } };
  }
  const xs = interaction.points.filter((_, index) => index % 2 === 0);
  const ys = interaction.points.filter((_, index) => index % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const node: CanvasNode = {
    height: Math.max(1, Math.max(...ys) - y),
    id: createId(),
    locked: false,
    name: `画笔 ${state.nodes.filter((item) => item.type === "path").length + 1}`,
    points: interaction.points,
    rotation: 0,
    stroke: "#222222",
    strokeWidth: 3,
    type: "path",
    visible: true,
    width: Math.max(1, Math.max(...xs) - x),
    x,
    y,
  };
  return {
    ...state,
    interaction: { kind: "idle" },
    nodes: [...state.nodes, node],
  };
}
