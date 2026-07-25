import { describe, expect, it, vi } from "vitest";
import {
  AGENT_TOOL_NAMES,
  createAgentTools,
  type AgentToolApplication
} from "./agent-tools.js";

function application(): AgentToolApplication {
  return {
    getCanvasContext: vi.fn(async () => ({ nodeCount: 2 })),
    createCreativePlan: vi.fn(async () => ({ planId: "plan-1" })),
    reviseCreativePlan: vi.fn(async () => ({ planId: "plan-2" })),
    analyzeSelectedImages: vi.fn(async () => ({ analysis: "A 更适合" })),
    createCanvasNodes: vi.fn(async () => ({ nodeIds: ["node-3"] })),
    arrangeCanvasNodes: vi.fn(async () => ({ nodeIds: ["node-1", "node-2"] })),
    proposePaidAction: vi.fn(async (input) => ({
      confirmationRequired: true,
      pendingActionId: `pending:${input.toolName}`,
      taskCount: input.toolName === "generate_images" ? 4 : input.targetNodeIds.length
    })),
    getGenerationStatus: vi.fn(async () => ({ status: "running" }))
  };
}

describe("agent tool catalog", () => {
  it("registers the twelve approved business tools and no host tools", () => {
    const tools = createAgentTools({
      userId: "user-1",
      projectId: "project-1",
      runId: "run-1",
      selectionSnapshot: ["node-1"],
      application: application()
    });

    expect(tools.map((tool) => tool.name)).toEqual(AGENT_TOOL_NAMES);
    expect(tools).toHaveLength(12);
  });

  it("uses the immutable selection snapshot for selected-image analysis", async () => {
    const app = application();
    const tool = createAgentTools({
      userId: "user-1",
      projectId: "project-1",
      runId: "run-1",
      selectionSnapshot: ["node-1", "node-2"],
      application: app
    }).find((item) => item.name === "analyze_selected_images")!;

    await tool.execute("call-1", { instruction: "比较" }, undefined);

    expect(app.analyzeSelectedImages).toHaveBeenCalledWith(expect.objectContaining({
      projectId: "project-1",
      nodeIds: ["node-1", "node-2"]
    }));
  });

  it("turns a paid image tool into a pending action without executing generation", async () => {
    const app = application();
    const tool = createAgentTools({
      userId: "user-1",
      projectId: "project-1",
      runId: "run-1",
      selectionSnapshot: [],
      application: app
    }).find((item) => item.name === "generate_images")!;

    const result = await tool.execute("call-2", { planId: "plan-1", count: 4 }, undefined);

    expect(app.proposePaidAction).toHaveBeenCalledWith(expect.objectContaining({
      toolName: "generate_images",
      taskCount: 4
    }));
    expect(result.details).toMatchObject({
      confirmationRequired: true,
      pendingActionId: "pending:generate_images"
    });
    expect(result.terminate).toBe(true);
  });
});
