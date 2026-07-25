import assert from "node:assert/strict";
import { DemoService, MemoryProjectStore } from "../apps/api/src/demo-service.js";
import { MockBailianProvider } from "../packages/bailian-provider/src/mock.js";

const onePixelPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

type Check = { name: string; status: "PASS" };
const checks: Check[] = [];

function pass(name: string): void {
  checks.push({ name, status: "PASS" });
}

async function createCompletedPlan(service: DemoService) {
  const project = await service.bootstrap();
  const result = await service.sendMessage(project.id, {
    content:
      "为面向 18—30 岁年轻用户的青柠气泡水设计社交媒体广告，清爽、活力、略带未来感，主色为青柠绿和银色，并给标题留白。",
    selectedNodeIds: []
  });
  assert.equal(result.kind, "plan");
  if (result.kind !== "plan") throw new Error("Expected a creative plan");
  assert.equal(result.plan.directions.length, 2);
  assert.equal((await service.getProject(project.id)).generationHistory.length, 0);
  const confirmed = await service.confirm(project.id, result.plan.id);
  const candidates = confirmed.canvas.nodes.filter(
    (node) => node.type === "image" && node.status === "succeeded"
  );
  assert.equal(candidates.length, 4);
  assert.equal(confirmed.generationHistory.length, 4);
  return { project: confirmed, candidates };
}

async function main(): Promise<void> {
const service = new DemoService(
  new MemoryProjectStore(),
  new MockBailianProvider({ delayMs: 1 })
);
const first = await createCompletedPlan(service);
pass("E2E-01 two directions, confirmation gate, four candidates");

const original = first.candidates[0]!;
const editProposal = await service.sendMessage(first.project.id, {
  content: "保留产品和主色，将画面改为夜间音乐节风格",
  selectedNodeIds: [original.id]
});
assert.equal(editProposal.kind, "confirmation");
if (editProposal.kind !== "confirmation") throw new Error("Expected edit confirmation");
const beforeEdit = await service.getProject(first.project.id);
assert.equal(beforeEdit.generationHistory.length, 4);
const afterEdit = await service.confirm(first.project.id, editProposal.confirmation.id);
const editResult = afterEdit.canvas.nodes.find(
  (node) => node.sourceNodeIds?.includes(original.id) && node.id !== original.id
);
assert.ok(editResult);
assert.equal(editResult.status, "succeeded");
assert.ok(afterEdit.canvas.nodes.some((node) => node.id === original.id));
pass("E2E-02 single-image edit preserves source and provenance");

const candidateIds = first.candidates.map((node) => node.id);
const historyBeforeAnalysis = afterEdit.generationHistory.length;
const analysis = await service.sendMessage(first.project.id, {
  content: "比较这四张图并推荐最适合作为社媒主视觉的一张",
  selectedNodeIds: candidateIds
});
assert.equal(analysis.kind, "analysis");
assert.equal(
  (await service.getProject(first.project.id)).generationHistory.length,
  historyBeforeAnalysis
);
pass("E2E-03 multi-image analysis creates no image task");

const referenceProposal = await service.sendMessage(first.project.id, {
  content: "第一张作为主图，其余图片分别作为构图参考、颜色参考和材质参考，融合生成一个新方向",
  selectedNodeIds: candidateIds.slice(0, 3)
});
assert.equal(referenceProposal.kind, "confirmation");
if (referenceProposal.kind !== "confirmation") throw new Error("Expected reference confirmation");
assert.equal(referenceProposal.confirmation.taskCount, 1);
const afterReference = await service.confirm(
  first.project.id,
  referenceProposal.confirmation.id
);
const referenceResult = afterReference.canvas.nodes.find(
  (node) =>
    node.sourceNodeIds?.length === 3 &&
    candidateIds.slice(0, 3).every((id) => node.sourceNodeIds?.includes(id))
);
assert.ok(referenceResult);
pass("E2E-04 reference generation records every selected source");

const grantsBeforeClarify = afterReference.confirmations.length;
const clarification = await service.sendMessage(first.project.id, {
  content: "把背景改成夜晚",
  selectedNodeIds: candidateIds.slice(0, 3)
});
assert.equal(clarification.kind, "analysis");
assert.equal(
  (await service.getProject(first.project.id)).confirmations.length,
  grantsBeforeClarify
);
pass("E2E-06 ambiguous multi-image scope creates no paid task");

const regionProposal = await service.proposeRegionEdit(first.project.id, {
  nodeId: original.id,
  instruction: "将柠檬替换为冰块",
  bbox: [20, 30, 120, 140]
});
assert.equal(regionProposal.kind, "confirmation");
const afterRegion = await service.confirm(
  first.project.id,
  regionProposal.confirmation.id
);
const regionRecord = afterRegion.generationHistory.findLast(
  (record) => record.type === "region_edit"
);
assert.ok(regionRecord);
const regionNode = afterRegion.canvas.nodes.find(
  (node) => node.id === regionRecord.nodeId
);
assert.deepEqual(regionNode?.editBbox, [20, 30, 120, 140]);
assert.deepEqual(regionNode?.sourceNodeIds, [original.id]);
pass("E2E-07 region edit preserves original-pixel bbox and source");

const failureService = new DemoService(
  new MemoryProjectStore(),
  new MockBailianProvider({ delayMs: 1, failAt: [6] })
);
const failurePlan = await createCompletedPlan(failureService);
const batchProposal = await failureService.sendMessage(failurePlan.project.id, {
  content: "分别将这两张图片的背景改成夜晚",
  selectedNodeIds: failurePlan.candidates.slice(0, 2).map((node) => node.id)
});
assert.equal(batchProposal.kind, "confirmation");
if (batchProposal.kind !== "confirmation") throw new Error("Expected batch confirmation");
assert.equal(batchProposal.confirmation.taskCount, 2);
const batchResult = await failureService.confirm(
  failurePlan.project.id,
  batchProposal.confirmation.id
);
const batchNodes = batchResult.canvas.nodes.filter((node) =>
  node.sourceNodeIds?.some((id) =>
    failurePlan.candidates.slice(0, 2).some((candidate) => candidate.id === id)
  )
).filter((node) => !failurePlan.candidates.some((candidate) => candidate.id === node.id));
const failed = batchNodes.find((node) => node.status === "failed");
const succeeded = batchNodes.find((node) => node.status === "succeeded");
if (!failed || !succeeded) {
  console.error("Unexpected batch nodes", batchNodes);
}
assert.ok(failed);
assert.ok(succeeded);
const retried = await failureService.retryGeneration(
  failurePlan.project.id,
  failed.id
);
assert.equal(
  retried.canvas.nodes.find((node) => node.id === failed.id)?.status,
  "succeeded"
);
assert.equal(
  retried.canvas.nodes.find((node) => node.id === succeeded.id)?.status,
  "succeeded"
);
pass("E2E-05 batch failure isolation and individual retry");

const recoveryStore = new MemoryProjectStore();
const recoveryService = new DemoService(
  recoveryStore,
  new MockBailianProvider({ delayMs: 1 })
);
const recoveryProject = await recoveryService.bootstrap();
recoveryProject.canvas.nodes.push({
  id: crypto.randomUUID(),
  type: "generation-placeholder",
  x: 0,
  y: 0,
  width: 300,
  height: 300,
  status: "running",
  prompt: "interrupted task"
});
await recoveryStore.save(recoveryProject);
const restarted = new DemoService(
  recoveryStore,
  new MockBailianProvider({ delayMs: 1 })
);
const recovered = await restarted.getProject(recoveryProject.id);
assert.equal(recovered.canvas.nodes.at(-1)?.status, "failed");
assert.ok(recovered.messages.at(-1)?.content.includes("可逐项重试"));
pass("E2E-10 interrupted task recovers to a retryable state");

console.table(checks);
console.log(`Mock E2E verification passed: ${checks.length}/${checks.length}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
