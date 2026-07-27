import type {
  AgentSession,
  PersistentAgentMessage,
  PersistentAgentRun,
} from "@loomoon/contracts";
import { describe, expect, it } from "vitest";
import { refreshAgentTimelineAfterProjectEvent } from "./agent-event-sync.js";

const session: AgentSession = {
  id: "session-1",
  userId: "user-1",
  projectId: "project-1",
  createdAt: "2026-07-27T00:00:00.000Z",
  updatedAt: "2026-07-27T00:01:00.000Z",
  messageIds: ["message-1"],
};

const waitingRun: PersistentAgentRun = {
  id: "run-1",
  sessionId: "session-1",
  userId: "user-1",
  projectId: "project-1",
  status: "waiting_jobs",
  selectionSnapshot: [],
  toolCallCount: 2,
  paidTaskCount: 4,
  createdAt: "2026-07-27T00:00:00.000Z",
  updatedAt: "2026-07-27T00:00:30.000Z",
};

const completedRun: PersistentAgentRun = {
  ...waitingRun,
  status: "completed",
  updatedAt: "2026-07-27T00:01:00.000Z",
  completedAt: "2026-07-27T00:01:00.000Z",
};

const completedMessage: PersistentAgentMessage = {
  id: "message-1",
  sessionId: "session-1",
  runId: "run-1",
  userId: "user-1",
  projectId: "project-1",
  role: "assistant",
  content: "4 张图片已生成完毕。",
  selectionSnapshot: [],
  createdAt: "2026-07-27T00:01:00.000Z",
};

describe("Agent project-event synchronization", () => {
  it("refreshes the last waiting run after completion clears activeRunId", async () => {
    const result = await refreshAgentTimelineAfterProjectEvent(
      {
        getAgentSession: async () => ({
          session,
          messages: [completedMessage],
        }),
        getAgentRun: async () => completedRun,
      },
      session.id,
      waitingRun,
    );

    expect(result).toEqual({
      session,
      messages: [completedMessage],
      run: completedRun,
    });
  });
});
