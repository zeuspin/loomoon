import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlanDraft } from "@loomoon/bailian-provider";
import {
  DemoService,
  MemoryProjectStore,
  type DemoProvider
} from "./demo-service.js";
import { DemoAgentToolApplication } from "./demo-agent-application.js";
import { JsonAgentRepository } from "./agent-repository.js";

const plan: PlanDraft = {
  summary: "社媒视觉",
  audience: "年轻用户",
  directions: [
    { title: "A", style: "摄影", composition: "居中", palette: "绿色", prompt: "A prompt" },
    { title: "B", style: "3D", composition: "对角", palette: "银色", prompt: "B prompt" }
  ]
};

const provider: DemoProvider = {
  createPlan: async () => plan,
  analyzeImages: async () => "分析结果",
  generateImage: async () => "data:image/png;base64,AA=="
};

describe("DemoAgentToolApplication", () => {
  it("creates a plan and persists a paid pending action without generating", async () => {
    const service = new DemoService(new MemoryProjectStore(), provider);
    const project = await service.bootstrap();
    const root = await mkdtemp(join(tmpdir(), "loomoon-agent-"));
    const repository = new JsonAgentRepository(root);
    const application = new DemoAgentToolApplication({
      service,
      repository,
      userId: "user-1",
      projectId: project.id,
      runId: "run-1"
    });

    const created = await application.createCreativePlan({
      userId: "user-1",
      projectId: project.id,
      runId: "run-1",
      brief: "青柠气泡水"
    });
    const proposal = await application.proposePaidAction({
      userId: "user-1",
      projectId: project.id,
      runId: "run-1",
      toolCallId: "call-1",
      toolName: "generate_images",
      input: { planId: created.planId, count: 4 },
      targetNodeIds: [],
      taskCount: 4
    });

    expect(proposal).toMatchObject({
      confirmationRequired: true,
      taskCount: 4
    });
    const action = await repository.getPendingAction(
      "user-1",
      String(proposal.pendingActionId)
    );
    expect(action).toMatchObject({
      runId: "run-1",
      toolCallId: "call-1",
      toolName: "generate_images",
      status: "pending"
    });
    expect((await service.getProject(project.id)).canvas.nodes.filter(
      (node) => node.type === "image"
    )).toHaveLength(0);
  });
});
