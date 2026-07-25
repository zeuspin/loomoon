import type { PersistentAgentMessage } from "@loomoon/contracts";
import { describe, expect, test } from "vitest";
import {
  failOptimisticMessage,
  mergeAgentMessages,
  optimisticUserMessage,
} from "./message-state.js";

const persisted = (overrides: Partial<PersistentAgentMessage> = {}): PersistentAgentMessage => ({
  id: "server-1",
  sessionId: "session-1",
  runId: "run-1",
  userId: "user-1",
  projectId: "project-1",
  role: "user",
  content: "Create a poster",
  selectionSnapshot: ["node-1"],
  createdAt: "2026-07-25T10:00:00.000Z",
  ...overrides,
});

describe("agent message state", () => {
  test("shows a user message immediately while the request is pending", () => {
    const message = optimisticUserMessage({
      clientMessageId: "client-1",
      sessionId: "session-1",
      projectId: "project-1",
      content: "Create a poster",
      selectionSnapshot: ["node-1"],
      createdAt: "2026-07-25T10:00:00.000Z",
    });

    expect(message.role).toBe("user");
    expect(message.deliveryStatus).toBe("pending");
    expect(message.content).toBe("Create a poster");
  });

  test("keeps failed user content visible and retryable", () => {
    const pending = optimisticUserMessage({
      clientMessageId: "client-1",
      sessionId: "session-1",
      projectId: "project-1",
      content: "Create a poster",
      selectionSnapshot: [],
      createdAt: "2026-07-25T10:00:00.000Z",
    });

    expect(failOptimisticMessage(pending).deliveryStatus).toBe("failed");
    expect(failOptimisticMessage(pending).content).toBe("Create a poster");
  });

  test("reconciles an optimistic message with its persisted copy without duplication", () => {
    const pending = optimisticUserMessage({
      clientMessageId: "client-1",
      sessionId: "session-1",
      projectId: "project-1",
      content: "Create a poster",
      selectionSnapshot: ["node-1"],
      createdAt: "2026-07-25T10:00:00.000Z",
    });

    const merged = mergeAgentMessages([persisted()], [pending]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("server-1");
    expect(merged[0]?.deliveryStatus).toBe("sent");
  });
});
