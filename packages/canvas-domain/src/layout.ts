import type { CanvasNode } from "@loomoon/contracts";

interface DirectionSummary {
  id: string;
  title: string;
  prompt?: string;
}

interface PlanLayoutInput {
  id?: string;
  brief: string;
  directions: [DirectionSummary, DirectionSummary] | DirectionSummary[];
}

export function layoutCreativePlan(input: PlanLayoutInput, existingNodes: CanvasNode[] = []): CanvasNode[] {
  const baseY = existingNodes.length > 0
    ? Math.max(...existingNodes.map((node) => node.y + node.height)) + 80
    : 80;
  const nodes: CanvasNode[] = [
    {
      id: crypto.randomUUID(),
      type: "text",
      x: 80,
      y: baseY,
      width: 360,
      height: 100,
      text: `CREATIVE BRIEF\n${input.brief}`,
      ...(input.id ? { planId: input.id } : {})
    }
  ];

  input.directions.slice(0, 2).forEach((direction, directionIndex) => {
    const x = 80 + directionIndex * 760;
    nodes.push({
      id: crypto.randomUUID(),
      type: "text",
      x,
      y: baseY + 160,
      width: 680,
      height: 72,
      text: `方向 ${directionIndex + 1} · ${direction.title}`,
      directionId: direction.id,
      ...(input.id ? { planId: input.id } : {})
    });
    for (let candidateIndex = 0; candidateIndex < 2; candidateIndex += 1) {
      nodes.push({
        id: crypto.randomUUID(),
        type: "generation-placeholder",
        x: x + candidateIndex * 340,
        y: baseY + 260,
        width: 300,
        height: 300,
        directionId: direction.id,
        ...(input.id ? { planId: input.id } : {}),
        ...(direction.prompt ? { prompt: direction.prompt } : {}),
        status: "queued"
      });
    }
  });

  return nodes;
}

interface SourcePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function placeDerivedImages(sources: SourcePosition[]): CanvasNode[] {
  const right = sources.length > 0 ? Math.max(...sources.map((source) => source.x + source.width)) + 64 : 64;
  const top = sources.length > 0 ? Math.min(...sources.map((source) => source.y)) : 64;
  return sources.map((source, index) => ({
    id: crypto.randomUUID(),
    type: "generation-placeholder",
    x: right,
    y: top + index * (source.height + 32),
    width: source.width,
    height: source.height,
    sourceNodeIds: [source.id],
    status: "queued"
  }));
}
