import type { DemoProject } from "@loomoon/contracts";
import { describe, expect, test } from "vitest";
import { mapProjectToAgentEntries } from "./message-mapper.js";

const project: DemoProject = {
  id: "project-1",
  name: "Demo",
  canvas: {
    id: "canvas-1",
    projectId: "project-1",
    version: 4,
    updatedAt: "2026-07-25T00:00:00.000Z",
    nodes: [],
  },
  canvasOperations: [],
  messages: [
    {
      id: "message-1",
      role: "user",
      content: "生成海报",
      selectionSnapshot: ["node-1"],
      createdAt: "2026-07-25T00:00:01.000Z",
    },
    {
      id: "message-2",
      role: "assistant",
      content: "我准备了两个方向。",
      selectionSnapshot: [],
      createdAt: "2026-07-25T00:00:02.000Z",
    },
  ],
  plans: [
    {
      id: "plan-1",
      brief: "海报",
      summary: "两个视觉方向",
      audience: "年轻用户",
      directions: [
        {
          id: "direction-1",
          title: "方向一",
          style: "极简",
          composition: "居中",
          palette: "白紫",
          prompt: "minimal",
        },
        {
          id: "direction-2",
          title: "方向二",
          style: "编辑感",
          composition: "网格",
          palette: "黑白",
          prompt: "editorial",
        },
      ],
      status: "awaiting_confirmation",
      version: 1,
      createdAt: "2026-07-25T00:00:03.000Z",
    },
  ],
  generationHistory: [
    {
      id: "generation-1",
      nodeId: "node-2",
      type: "text_to_image",
      status: "failed",
      prompt: "poster",
      sourceNodeIds: [],
      errorCode: "PROVIDER_TIMEOUT",
      createdAt: "2026-07-25T00:00:05.000Z",
    },
  ],
  confirmations: [
    {
      id: "confirmation-1",
      action: "generate_candidates",
      summary: "生成 4 张候选图",
      targetNodeIds: [],
      taskCount: 4,
      inputHash: "hash",
      status: "pending",
      expiresAt: "2026-07-25T01:00:00.000Z",
    },
  ],
  auditLog: [],
};

describe("mapProjectToAgentEntries", () => {
  test("preserves messages and actionable work without projecting image history", () => {
    const entries = mapProjectToAgentEntries(project);

    expect(entries.map((entry) => [entry.id, entry.kind])).toEqual([
      ["message-1", "message"],
      ["message-2", "message"],
      ["plan:plan-1", "plan"],
      ["confirmation:confirmation-1", "confirmation"],
    ]);
    expect(entries[0]).toMatchObject({
      role: "user",
      text: "生成海报",
      selectionNodeIds: ["node-1"],
    });
  });

  test("does not mutate the authoritative project", () => {
    const before = JSON.stringify(project);

    mapProjectToAgentEntries(project);

    expect(JSON.stringify(project)).toBe(before);
  });

  test("does not render a duplicate confirmation card for the active plan", () => {
    const entries = mapProjectToAgentEntries({
      ...project,
      confirmations: [{
        ...project.confirmations[0]!,
        id: "plan-1"
      }]
    });

    expect(entries.filter((entry) => entry.kind !== "message").map((entry) => entry.kind))
      .toEqual(["plan"]);
  });
});
