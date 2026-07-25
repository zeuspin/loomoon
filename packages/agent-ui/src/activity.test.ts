import type { DemoProject, PersistentAgentRun } from "@loomoon/contracts";
import { describe, expect, test } from "vitest";
import { describeAgentActivity } from "./activity.js";

const project: DemoProject = {
  id: "project-1",
  name: "Demo",
  canvas: {
    id: "canvas-1",
    projectId: "project-1",
    version: 1,
    updatedAt: "2026-07-25T00:00:00.000Z",
    nodes: [],
  },
  canvasOperations: [],
  messages: [],
  plans: [],
  generationHistory: [],
  confirmations: [],
  auditLog: [],
};

const run: PersistentAgentRun = {
  id: "run-1",
  sessionId: "session-1",
  userId: "user-1",
  projectId: "project-1",
  status: "streaming",
  selectionSnapshot: [],
  toolCallCount: 0,
  paidTaskCount: 0,
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

describe("describeAgentActivity", () => {
  test("explains that a pending plan is waiting for user confirmation", () => {
    const activity = describeAgentActivity({
      project,
      entries: [{
        id: "plan:plan-1",
        kind: "plan",
        plan: {
          id: "plan-1",
          brief: "brief",
          summary: "summary",
          audience: "audience",
          directions: [
            { id: "direction-1", title: "A", style: "style", composition: "center", palette: "white", prompt: "one" },
            { id: "direction-2", title: "B", style: "style", composition: "grid", palette: "black", prompt: "two" },
          ],
          status: "awaiting_confirmation",
          version: 1,
          createdAt: "2026-07-25T00:00:00.000Z",
        },
      }],
      isRunning: false,
    });

    expect(activity).toMatchObject({
      title: "等待确认创意方向",
      tone: "waiting",
    });
  });

  test("summarizes a waiting image generation run", () => {
    const activity = describeAgentActivity({
      project: {
        ...project,
        generationHistory: [
          {
            id: "record-1",
            nodeId: "node-1",
            type: "text_to_image",
            status: "succeeded",
            prompt: "prompt",
            sourceNodeIds: [],
            createdAt: "2026-07-25T00:01:00.000Z",
          },
        ],
      },
      entries: [],
      isRunning: true,
      run: { ...run, status: "waiting_jobs", paidTaskCount: 4 },
    });

    expect(activity).toEqual({
      title: "正在生成图片",
      detail: "已完成 1/4，结果会自动放入画布",
      tone: "generating",
    });
  });

  test("uses the current busy label while a run is being planned", () => {
    const activity = describeAgentActivity({
      project,
      entries: [],
      isRunning: true,
      run,
      busyLabel: "正在提交给 Pi Agent...",
    });

    expect(activity).toMatchObject({
      title: "正在理解需求",
      detail: "正在提交给 Pi Agent...",
    });
  });
});
