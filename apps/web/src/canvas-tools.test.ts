import { describe, expect, it } from "vitest";
import type { DemoProject } from "@loomoon/contracts";
import {
  canvasNodesForProject,
  createCanvasToolNode,
  projectIdFromLocation,
} from "./canvas-tools.js";

const emptyProject: DemoProject = {
  id: "project-1",
  name: "空白项目",
  canvas: {
    id: "canvas-1",
    projectId: "project-1",
    version: 1,
    nodes: [],
    updatedAt: "2026-07-27T00:00:00.000Z",
  },
  canvasOperations: [],
  messages: [],
  plans: [],
  generationHistory: [],
  confirmations: [],
  auditLog: [],
};

describe("canvas tool nodes", () => {
  it("creates a selectable visual node for each replicated tool", () => {
    for (const kind of [
      "rectangle",
      "circle",
      "triangle",
      "star",
      "speech",
      "arrow",
      "pencil",
      "pen",
    ] as const) {
      const node = createCanvasToolNode(kind, () => `id-${kind}`);
      expect(node.id).toBe(`id-${kind}`);
      expect(node.type).toBe("text");
      expect(node.text?.length).toBeGreaterThan(0);
    }
  });
});

describe("canvas route project", () => {
  it("reads the requested project id from the URL", () => {
    expect(projectIdFromLocation("?projectId=project%201")).toBe("project 1");
    expect(projectIdFromLocation("")).toBeUndefined();
  });
});

describe("canvas visual baseline", () => {
  it("keeps a newly created project truly empty", () => {
    expect(canvasNodesForProject(emptyProject)).toEqual([]);
  });

  it("normalizes only the nodes persisted by the project", () => {
    const nodes = canvasNodesForProject({
      ...emptyProject,
      canvas: {
        ...emptyProject.canvas,
        nodes: [
          {
            id: "node-1",
            type: "image",
            x: 10,
            y: 20,
            width: 300,
            height: 200,
          },
        ],
      },
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: "node-1",
      visible: true,
      locked: false,
      rotation: 0,
    });
  });
});
