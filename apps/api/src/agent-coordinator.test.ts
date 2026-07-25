import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentEvent, AgentTool } from "@earendil-works/pi-agent-core";
import { AgentCoordinator, type AgentRuntimeFactory } from "./agent-coordinator.js";
import { JsonAgentRepository } from "./agent-repository.js";
import type { AgentToolApplication } from "./agent-tools.js";
import { createAgentRun, transitionAgentRun } from "@loomoon/agent-runtime";
import type { AgentToolCall, PendingAgentAction } from "@loomoon/contracts";

const application: AgentToolApplication = {
  getCanvasContext: async () => ({ nodeCount: 0 }),
  createCreativePlan: async () => ({ planId: "plan-1" }),
  reviseCreativePlan: async () => ({ planId: "plan-2" }),
  analyzeSelectedImages: async () => ({ analysis: "ok" }),
  createCanvasNodes: async () => ({ nodeIds: [] }),
  arrangeCanvasNodes: async () => ({ nodeIds: [] }),
  proposePaidAction: async () => ({ confirmationRequired: true, pendingActionId: "pending-1" }),
  getGenerationStatus: async () => ({ status: "queued" })
};

describe("AgentCoordinator", () => {
  it("persists a run, immutable selection, Pi events, and tool audit", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-agent-"));
    const repository = new JsonAgentRepository(root);
    let modelPrompt = "";
    const runtimeFactory: AgentRuntimeFactory = (options) => ({
      completeWithTrace: async (prompt) => {
        modelPrompt = prompt;
        await options.onEvent({ type: "agent_start" });
        await options.onEvent({
          type: "tool_execution_start",
          toolCallId: "call-1",
          toolName: "get_canvas_context",
          args: {}
        });
        const tool = options.tools.find((item: AgentTool) => item.name === "get_canvas_context")!;
        const result = await tool.execute("call-1", {}, undefined);
        await options.onEvent({
          type: "tool_execution_end",
          toolCallId: "call-1",
          toolName: "get_canvas_context",
          result,
          isError: false
        });
        await options.onEvent({ type: "agent_end", messages: [] });
        return { text: "已读取画布", model: "qwen3.7-plus" };
      }
    });
    const coordinator = new AgentCoordinator({
      repository,
      runtimeFactory,
      applicationFor: () => application
    });
    const session = await coordinator.createSession("user-1", "project-1");
    const selection = ["node-1"];

    const result = await coordinator.sendMessage({
      userId: "user-1",
      sessionId: session.id,
      content: "读取画布",
      selectedNodeIds: selection
    });
    selection.push("node-2");

    expect(result.run.status).toBe("completed");
    expect(result.run.selectionSnapshot).toEqual(["node-1"]);
    expect(modelPrompt).toContain("本条消息提交时选中了 1 个画布图片节点");
    expect(modelPrompt).toContain("node-1");
    expect(modelPrompt).toContain("读取画布");
    expect((await repository.getToolCall("user-1", "call-1"))?.status).toBe("succeeded");
    const messages = await repository.listMessages("user-1", session.id);
    expect(messages.map((item) => item.role)).toEqual(["user", "assistant"]);
    expect(messages[0]?.content).toBe("读取画布");
  });

  it("returns the canonical persisted message timeline for a session", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-agent-"));
    const repository = new JsonAgentRepository(root);
    const coordinator = new AgentCoordinator({
      repository,
      runtimeFactory: () => ({
        completeWithTrace: async () => ({ text: "Assistant reply", model: "qwen" })
      }),
      applicationFor: () => application
    });
    const session = await coordinator.createSession("user-1", "project-1");
    await coordinator.sendMessage({
      userId: "user-1",
      sessionId: session.id,
      content: "User request",
      selectedNodeIds: ["node-1"]
    });

    const timeline = await coordinator.getSessionTimeline("user-1", session.id);

    expect(timeline.session.id).toBe(session.id);
    expect(timeline.messages.map((item) => [item.role, item.content])).toEqual([
      ["user", "User request"],
      ["assistant", "Assistant reply"]
    ]);
  });

  it("rejects a second concurrent run for the same session", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-agent-"));
    const repository = new JsonAgentRepository(root);
    let release!: () => void;
    let ready!: () => void;
    const runtimeReady = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const runtimeFactory: AgentRuntimeFactory = () => ({
      completeWithTrace: () => new Promise((resolve) => {
        release = () => resolve({ text: "done", model: "qwen3.7-plus" });
        ready();
      })
    });
    const coordinator = new AgentCoordinator({
      repository,
      runtimeFactory,
      applicationFor: () => application
    });
    const session = await coordinator.createSession("user-1", "project-1");
    const first = coordinator.sendMessage({
      userId: "user-1",
      sessionId: session.id,
      content: "first",
      selectedNodeIds: []
    });
    await runtimeReady;

    await expect(coordinator.sendMessage({
      userId: "user-1",
      sessionId: session.id,
      content: "second",
      selectedNodeIds: []
    })).rejects.toThrow("AGENT_SESSION_BUSY");
    release();
    await first;
  });

  it("replaces a run that is waiting for confirmation when the user sends a follow-up", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-agent-"));
    const repository = new JsonAgentRepository(root);
    const coordinator = new AgentCoordinator({
      repository,
      runtimeFactory: () => ({
        completeWithTrace: async () => ({ text: "revised", model: "qwen" })
      }),
      applicationFor: () => application
    });
    const session = await coordinator.createSession("user-1", "project-1");
    let waiting = createAgentRun({
      id: "waiting-run",
      sessionId: session.id,
      projectId: "project-1",
      userId: "user-1",
      selectedNodeIds: []
    });
    waiting = transitionAgentRun(
      transitionAgentRun(waiting, "streaming"),
      "waiting_confirmation"
    );
    session.activeRunId = waiting.id;
    await repository.saveRun(waiting);
    await repository.saveSession(session);

    const result = await coordinator.sendMessage({
      userId: "user-1",
      sessionId: session.id,
      content: "Please revise the direction",
      selectedNodeIds: []
    });

    expect((await repository.getRun("user-1", waiting.id))?.status).toBe("cancelled");
    expect(result.run.status).toBe("completed");
    expect(result.message.content).toBe("revised");
  });

  it("atomically confirms a pending tool action and queues background execution", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-agent-"));
    const repository = new JsonAgentRepository(root);
    const queued: string[] = [];
    const coordinator = new AgentCoordinator({
      repository,
      runtimeFactory: () => ({
        completeWithTrace: async () => ({ text: "unused", model: "qwen" })
      }),
      applicationFor: () => application,
      generationExecutor: {
        enqueue: (action) => queued.push(action.id)
      }
    });
    const session = await coordinator.createSession("user-1", "project-1");
    let run = createAgentRun({
      id: "run-1",
      sessionId: session.id,
      projectId: "project-1",
      userId: "user-1",
      selectedNodeIds: []
    });
    run = transitionAgentRun(transitionAgentRun(run, "streaming"), "waiting_confirmation");
    const now = "2026-07-25T00:00:00.000Z";
    const toolCall: AgentToolCall = {
      id: "call-1",
      runId: run.id,
      sessionId: session.id,
      userId: "user-1",
      projectId: "project-1",
      toolName: "generate_images",
      input: {},
      inputHash: "hash",
      status: "waiting_confirmation",
      createdAt: now,
      updatedAt: now
    };
    const action: PendingAgentAction = {
      id: "action-1",
      runId: run.id,
      toolCallId: toolCall.id,
      userId: "user-1",
      projectId: "project-1",
      toolName: "generate_images",
      input: {},
      inputHash: "hash",
      targetNodeIds: [],
      taskCount: 4,
      status: "pending",
      expiresAt: "2099-01-01T00:00:00.000Z",
      createdAt: now
    };
    await repository.saveRun(run);
    await repository.saveToolCall(toolCall);
    await repository.savePendingAction(action);

    const confirmed = await coordinator.confirmAction("user-1", run.id, action.id);

    expect(confirmed.status).toBe("waiting_jobs");
    expect((await repository.getPendingAction("user-1", action.id))?.status).toBe("confirmed");
    expect((await repository.getToolCall("user-1", toolCall.id))?.status).toBe("waiting_jobs");
    expect(queued).toEqual(["action-1"]);
  });
});
