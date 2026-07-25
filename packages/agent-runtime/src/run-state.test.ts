import { describe, expect, it } from "vitest";
import {
  assertAgentRunTransition,
  createAgentRun,
  type AgentRunStatus
} from "./run-state.js";

describe("agent run state", () => {
  it("creates a run in created state with immutable selection context", () => {
    const selectedNodeIds = ["node-1", "node-2"];
    const run = createAgentRun({
      id: "run-1",
      sessionId: "session-1",
      projectId: "project-1",
      userId: "user-1",
      selectedNodeIds
    });

    selectedNodeIds.push("node-3");

    expect(run.status).toBe("created");
    expect(run.selectionSnapshot).toEqual(["node-1", "node-2"]);
    expect(run.toolCallCount).toBe(0);
    expect(run.paidTaskCount).toBe(0);
  });

  it.each<[AgentRunStatus, AgentRunStatus]>([
    ["created", "streaming"],
    ["streaming", "tool_running"],
    ["tool_running", "waiting_confirmation"],
    ["waiting_confirmation", "waiting_jobs"],
    ["waiting_jobs", "streaming"],
    ["streaming", "completed"]
  ])("allows %s -> %s", (from, to) => {
    expect(() => assertAgentRunTransition(from, to)).not.toThrow();
  });

  it("rejects transitions from a terminal run", () => {
    expect(() => assertAgentRunTransition("completed", "streaming")).toThrow(
      "AGENT_RUN_INVALID_TRANSITION"
    );
  });
});
