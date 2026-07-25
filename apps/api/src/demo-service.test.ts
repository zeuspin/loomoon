import { describe, expect, it } from "vitest";
import type { PlanDraft } from "@loomoon/bailian-provider";
import { DemoService, MemoryProjectStore, type DemoProvider } from "./demo-service.js";

const plan: PlanDraft = {
  summary: "为新品建立清爽且有辨识度的社媒视觉",
  audience: "年轻城市消费者",
  directions: [
    {
      title: "清爽自然",
      style: "通透商业摄影",
      composition: "产品居中，青柠环绕",
      palette: "青绿与银白",
      prompt: "青柠气泡水产品广告，通透商业摄影"
    },
    {
      title: "霓虹派对",
      style: "夜间音乐节",
      composition: "低机位产品英雄镜头",
      palette: "荧光绿与深紫",
      prompt: "青柠气泡水产品广告，夜间音乐节霓虹风格"
    }
  ]
};

class FakeProvider implements DemoProvider {
  generated: Array<{ prompt: string; references: string[] }> = [];
  planReferences: string[] = [];

  async createPlan(_brief: string, references: string[] = []): Promise<PlanDraft> {
    this.planReferences = references;
    return plan;
  }

  async analyzeImages(): Promise<string> {
    return "方向一更适合作为社媒主视觉。";
  }

  async generateImage(prompt: string, references: string[]): Promise<string> {
    this.generated.push({ prompt, references });
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"/>`)}`;
  }
}

describe("DemoService", () => {
  it("creates exactly two directions and waits for confirmation before generation", async () => {
    const provider = new FakeProvider();
    const service = new DemoService(new MemoryProjectStore(), provider);
    const project = await service.bootstrap();

    const result = await service.sendMessage(project.id, {
      content: "做一组青柠气泡水广告",
      selectedNodeIds: []
    });

    expect(result.kind).toBe("plan");
    expect(result.plan?.directions).toHaveLength(2);
    expect(provider.generated).toHaveLength(0);
    expect((await service.getProject(project.id)).canvasOperations.at(-1)).toMatchObject({
      actor: "agent",
      type: "agent_layout"
    });
  });

  it("generates four candidates after the plan is confirmed", async () => {
    const provider = new FakeProvider();
    const service = new DemoService(new MemoryProjectStore(), provider);
    const project = await service.bootstrap();
    const result = await service.sendMessage(project.id, {
      content: "做一组青柠气泡水广告",
      selectedNodeIds: []
    });

    const updated = await service.confirm(project.id, result.plan!.id);

    expect(provider.generated).toHaveLength(4);
    expect(updated.canvas.nodes.filter((node) => node.type === "image")).toHaveLength(4);
    expect(updated.canvas.nodes.filter((node) => node.type === "generation-placeholder")).toHaveLength(0);
    expect(updated.plans[0]).toMatchObject({
      version: 1,
      confirmedBy: "local-demo-user"
    });
    expect(updated.confirmations[0]).toMatchObject({ status: "consumed", taskCount: 4 });
    expect(updated.auditLog.some((event) => event.action === "generate_images" && event.status === "succeeded")).toBe(true);

    const repeated = await service.confirm(project.id, result.plan!.id);
    expect(provider.generated).toHaveLength(4);
    expect(repeated.canvas.nodes.filter((node) => node.type === "image")).toHaveLength(4);
  });

  it("generates all four candidates from the selected direction", async () => {
    const provider = new FakeProvider();
    const service = new DemoService(new MemoryProjectStore(), provider);
    const project = await service.bootstrap();
    const result = await service.sendMessage(project.id, {
      content: "做一组青柠气泡水广告",
      selectedNodeIds: []
    });
    const selectedDirection = result.plan!.directions[1]!;

    const updated = await service.confirm(project.id, result.plan!.id, selectedDirection.id);

    expect(provider.generated).toHaveLength(4);
    expect(provider.generated.every((item) => item.prompt === selectedDirection.prompt)).toBe(true);
    expect(
      updated.canvas.nodes
        .filter((node) => node.type === "image")
        .every((node) => node.directionId === selectedDirection.id)
    ).toBe(true);
  });

  it("proposes an edit for selected images and only executes it after confirmation", async () => {
    const provider = new FakeProvider();
    const service = new DemoService(new MemoryProjectStore(), provider);
    let project = await service.bootstrap();
    const planned = await service.sendMessage(project.id, {
      content: "做一组青柠气泡水广告",
      selectedNodeIds: []
    });
    project = await service.confirm(project.id, planned.plan!.id);
    const sourceId = project.canvas.nodes.find((node) => node.type === "image")!.id;
    const before = provider.generated.length;

    const proposal = await service.sendMessage(project.id, {
      content: "保留产品，把背景改成夜间音乐节",
      selectedNodeIds: [sourceId]
    });

    expect(proposal.kind).toBe("confirmation");
    expect(provider.generated).toHaveLength(before);
    const updated = await service.confirm(project.id, proposal.confirmation!.id);
    expect(provider.generated).toHaveLength(before + 1);
    expect(updated.canvas.nodes.filter((node) => node.sourceNodeIds?.includes(sourceId))).toHaveLength(1);
  });

  it("lets an approved Agent tool propose a paid edit without another intent-model decision", async () => {
    const provider = new FakeProvider();
    const service = new DemoService(new MemoryProjectStore(), provider);
    let project = await service.bootstrap();
    const planned = await service.sendMessage(project.id, {
      content: "做一组青柠气泡水广告",
      selectedNodeIds: []
    });
    project = await service.confirm(project.id, planned.plan!.id);
    const sourceId = project.canvas.nodes.find((node) => node.type === "image")!.id;
    const before = provider.generated.length;

    const proposal = await service.proposeImageEdit(project.id, {
      instruction: "把背景改成纯白影棚",
      targetNodeIds: [sourceId],
      mode: "edit"
    });

    expect(proposal.kind).toBe("confirmation");
    expect(proposal.confirmation).toMatchObject({
      action: "edit_images",
      targetNodeIds: [sourceId],
      taskCount: 1
    });
    expect(provider.generated).toHaveLength(before);
  });

  it("keeps successful candidate images when one generation fails", async () => {
    let call = 0;
    const provider: DemoProvider = {
      ...new FakeProvider(),
      createPlan: async () => plan,
      analyzeImages: async () => "analysis",
      generateImage: async () => {
        call += 1;
        if (call === 2) throw new Error("provider unavailable");
        return "data:image/png;base64,AA==";
      }
    };
    const service = new DemoService(new MemoryProjectStore(), provider);
    const project = await service.bootstrap();
    const planned = await service.sendMessage(project.id, {
      content: "做一组青柠气泡水广告",
      selectedNodeIds: []
    });

    const updated = await service.confirm(project.id, planned.plan!.id);

    expect(updated.canvas.nodes.filter((node) => node.type === "image")).toHaveLength(3);
    expect(updated.canvas.nodes.filter((node) => node.status === "failed")).toHaveLength(1);
    const failed = updated.canvas.nodes.find((node) => node.status === "failed")!;
    const retried = await service.retryGeneration(project.id, failed.id);
    expect(retried.canvas.nodes.find((node) => node.id === failed.id)).toMatchObject({
      type: "image",
      status: "succeeded"
    });
    expect(retried.canvas.nodes.filter((node) => node.type === "image")).toHaveLength(4);
  });

  it("asks for scope clarification without creating a confirmation", async () => {
    const provider = new FakeProvider();
    const service = new DemoService(new MemoryProjectStore(), provider);
    let project = await service.bootstrap();
    const planned = await service.sendMessage(project.id, {
      content: "做一组青柠气泡水广告",
      selectedNodeIds: []
    });
    project = await service.confirm(project.id, planned.plan!.id);
    const selected = project.canvas.nodes.filter((node) => node.type === "image").slice(0, 3).map((node) => node.id);
    const before = provider.generated.length;

    const result = await service.sendMessage(project.id, {
      content: "把背景改成夜晚",
      selectedNodeIds: selected
    });

    expect(result.kind).toBe("analysis");
    expect(result.confirmation).toBeUndefined();
    expect(result.message.content).toContain("全部修改");
    expect(provider.generated).toHaveLength(before);
  });

  it("uses all selected images as references for one fusion result", async () => {
    const provider = new FakeProvider();
    const service = new DemoService(new MemoryProjectStore(), provider);
    let project = await service.bootstrap();
    const planned = await service.sendMessage(project.id, {
      content: "做一组青柠气泡水广告",
      selectedNodeIds: []
    });
    project = await service.confirm(project.id, planned.plan!.id);
    const selected = project.canvas.nodes.filter((node) => node.type === "image").slice(0, 3);
    const before = provider.generated.length;
    const proposal = await service.sendMessage(project.id, {
      content: "第一张做主图，其余图片分别作为构图和材质参考，融合生成一张新图",
      selectedNodeIds: selected.map((node) => node.id)
    });

    expect(proposal.confirmation).toMatchObject({
      action: "generate_from_references",
      taskCount: 1
    });
    const updated = await service.confirm(project.id, proposal.confirmation!.id);
    expect(provider.generated).toHaveLength(before + 1);
    expect(provider.generated.at(-1)?.references).toEqual(selected.map((node) => node.assetUrl));
    expect(updated.canvas.nodes.findLast((node) => node.sourceNodeIds?.length === 3)?.sourceNodeIds).toEqual(
      selected.map((node) => node.id)
    );
  });

  it("adds an uploaded reference to the canvas and includes it in the first plan", async () => {
    const provider = new FakeProvider();
    const service = new DemoService(
      new MemoryProjectStore(),
      provider,
      async () => "/assets/reference.png"
    );
    let project = await service.bootstrap();
    project = await service.addReferenceImage(project.id, "data:image/png;base64,AA==");
    const reference = project.canvas.nodes.find((node) => node.type === "image")!;

    const result = await service.sendMessage(project.id, {
      content: "参考这张图片，为青柠气泡水创建两个广告方向",
      selectedNodeIds: [reference.id]
    });

    expect(result.kind).toBe("plan");
    expect(provider.planReferences).toEqual(["/assets/reference.png"]);
  });

  it("requires confirmation for a region edit and records the original-pixel bbox", async () => {
    const provider = new FakeProvider();
    const service = new DemoService(new MemoryProjectStore(), provider);
    let project = await service.bootstrap();
    const planned = await service.sendMessage(project.id, {
      content: "做一组青柠气泡水广告",
      selectedNodeIds: []
    });
    project = await service.confirm(project.id, planned.plan!.id);
    const source = project.canvas.nodes.find((node) => node.type === "image")!;
    const before = provider.generated.length;

    const proposal = await service.proposeRegionEdit(project.id, {
      nodeId: source.id,
      instruction: "把框选的青柠替换为冰块",
      bbox: [120, 80, 640, 720]
    });
    expect(proposal.confirmation?.action).toBe("edit_region");
    expect(provider.generated).toHaveLength(before);

    const updated = await service.confirm(project.id, proposal.confirmation!.id);
    const result = updated.canvas.nodes.find((node) => node.sourceNodeIds?.includes(source.id));
    expect(result?.editBbox).toEqual([120, 80, 640, 720]);
    expect(provider.generated).toHaveLength(before + 1);
  });

  it("keeps generation history after a result node is removed from the canvas", async () => {
    const provider = new FakeProvider();
    const service = new DemoService(new MemoryProjectStore(), provider);
    let project = await service.bootstrap();
    const planned = await service.sendMessage(project.id, {
      content: "做一组青柠气泡水广告",
      selectedNodeIds: []
    });
    project = await service.confirm(project.id, planned.plan!.id);
    expect(project.generationHistory).toHaveLength(4);
    const remaining = project.canvas.nodes.filter((node) => node.type !== "image");

    const updated = await service.saveCanvas(project.id, remaining, project.canvas.version);

    expect(updated.canvas.nodes.filter((node) => node.type === "image")).toHaveLength(0);
    expect(updated.generationHistory).toHaveLength(4);
    const restored = await service.addHistoryToCanvas(updated.id, updated.generationHistory[0]!.id);
    const restoredImage = restored.canvas.nodes.find((node) => node.type === "image");
    expect(restoredImage?.id).not.toBe(updated.generationHistory[0]!.nodeId);
    expect(restoredImage?.assetUrl).toBe(updated.generationHistory[0]!.assetUrl);
  });

  it("persists edit confirmation grants across service recreation", async () => {
    const provider = new FakeProvider();
    const store = new MemoryProjectStore();
    const first = new DemoService(store, provider);
    let project = await first.bootstrap();
    const planned = await first.sendMessage(project.id, {
      content: "做一组青柠气泡水广告",
      selectedNodeIds: []
    });
    project = await first.confirm(project.id, planned.plan!.id);
    const sourceId = project.canvas.nodes.find((node) => node.type === "image")!.id;
    const proposal = await first.sendMessage(project.id, {
      content: "保留主体，把这张图改成夜间音乐节风格",
      selectedNodeIds: [sourceId]
    });

    const recreated = new DemoService(store, provider);
    const updated = await recreated.confirm(project.id, proposal.confirmation!.id);
    expect(updated.canvas.nodes.some((node) => node.sourceNodeIds?.includes(sourceId))).toBe(true);
    expect(updated.confirmations.find((grant) => grant.id === proposal.confirmation!.id)?.status).toBe("consumed");
  });

  it("revises an unconfirmed plan without keeping stale paid placeholders", async () => {
    const provider = new FakeProvider();
    const service = new DemoService(new MemoryProjectStore(), provider);
    const project = await service.bootstrap();
    const first = await service.sendMessage(project.id, {
      content: "先做一版青柠气泡水广告",
      selectedNodeIds: []
    });
    const second = await service.sendMessage(project.id, {
      content: "调整计划，让整体更未来感",
      selectedNodeIds: []
    });
    const updated = await service.getProject(project.id);

    expect(first.plan?.version).toBe(1);
    expect(second.plan?.version).toBe(2);
    expect(updated.confirmations.find((grant) => grant.id === first.plan?.id)?.status).toBe("expired");
    expect(updated.canvas.nodes.filter((node) => node.type === "generation-placeholder")).toHaveLength(4);
    expect(provider.generated).toHaveLength(0);
  });

  it("recovers interrupted running nodes as retryable failures after service recreation", async () => {
    const provider = new FakeProvider();
    const store = new MemoryProjectStore();
    const service = new DemoService(store, provider);
    let project = await service.bootstrap();
    project.canvas.nodes.push({
      id: "interrupted-task",
      type: "generation-placeholder",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      prompt: "recover me",
      status: "running"
    });
    await store.save(project);

    const recreated = new DemoService(store, provider);
    const recovered = await recreated.bootstrap();
    expect(recovered.canvas.nodes.find((node) => node.id === "interrupted-task")?.status).toBe("failed");
    expect(recovered.messages.at(-1)?.content).toContain("服务重启");
  });

  it("preserves user canvas edits made while generation is running", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;
    const provider: DemoProvider = {
      createPlan: async () => plan,
      analyzeImages: async () => "analysis",
      generateImage: async () => {
        started += 1;
        await gate;
        return "data:image/png;base64,AA==";
      }
    };
    const service = new DemoService(new MemoryProjectStore(), provider);
    let project = await service.bootstrap();
    const planned = await service.sendMessage(project.id, {
      content: "做一组青柠气泡水广告",
      selectedNodeIds: []
    });
    const confirmation = service.confirm(project.id, planned.plan!.id);
    while (started < 2) await new Promise((resolve) => setTimeout(resolve, 0));

    project = await service.getProject(project.id);
    const textNode = project.canvas.nodes.find((node) => node.type === "text")!;
    const movedX = textNode.x + 123;
    const editedNodes = project.canvas.nodes.map((node) => node.id === textNode.id ? { ...node, x: movedX } : node);
    await service.saveCanvas(project.id, editedNodes, project.canvas.version);
    release();
    const completed = await confirmation;

    expect(completed.canvas.nodes.find((node) => node.id === textNode.id)?.x).toBe(movedX);
    expect(completed.canvas.nodes.filter((node) => node.type === "image")).toHaveLength(4);
  });
});
