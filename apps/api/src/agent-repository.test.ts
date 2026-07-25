import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentSession, AgentToolCall, PendingAgentAction, PersistentAgentRun } from "@loomoon/contracts";
import { JsonAgentRepository } from "./agent-repository.js";

describe("JsonAgentRepository", () => {
  it("persists sessions and runs under the user scope without sharing object references", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-agent-"));
    const repository = new JsonAgentRepository(root);
    const session: AgentSession = {
      id: "session-1",
      userId: "user-1",
      projectId: "project-1",
      createdAt: "2026-07-25T00:00:00.000Z",
      updatedAt: "2026-07-25T00:00:00.000Z",
      messageIds: []
    };

    await repository.saveSession(session);
    session.messageIds.push("mutated-after-save");

    expect(await repository.getSession("user-1", "session-1")).toEqual({
      ...session,
      messageIds: []
    });
    await expect(repository.getSession("user-2", "session-1")).resolves.toBeUndefined();
    expect(JSON.parse(await readFile(join(root, "user-1", "state.json"), "utf8"))).toMatchObject({
      sessions: [{ id: "session-1" }]
    });
  });

  it("serializes concurrent updates instead of losing one writer", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-agent-"));
    const repository = new JsonAgentRepository(root);

    await Promise.all([
      repository.saveSession({
        id: "session-a",
        userId: "user-1",
        projectId: "project-1",
        createdAt: "2026-07-25T00:00:00.000Z",
        updatedAt: "2026-07-25T00:00:00.000Z",
        messageIds: []
      }),
      repository.saveSession({
        id: "session-b",
        userId: "user-1",
        projectId: "project-1",
        createdAt: "2026-07-25T00:00:00.000Z",
        updatedAt: "2026-07-25T00:00:00.000Z",
        messageIds: []
      })
    ]);

    expect((await repository.listSessions("user-1", "project-1")).map((item) => item.id).sort())
      .toEqual(["session-a", "session-b"]);
  });

  it("expires a stale confirmation and closes the waiting run", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-agent-"));
    const repository = new JsonAgentRepository(root);
    const createdAt = "2026-07-25T00:00:00.000Z";
    const run: PersistentAgentRun = {
      id: "run-1",
      sessionId: "session-1",
      projectId: "project-1",
      userId: "user-1",
      status: "waiting_confirmation",
      selectionSnapshot: [],
      toolCallCount: 1,
      paidTaskCount: 0,
      createdAt,
      updatedAt: createdAt
    };
    const toolCall: AgentToolCall = {
      id: "tool-call-1",
      runId: run.id,
      sessionId: run.sessionId,
      projectId: run.projectId,
      userId: run.userId,
      toolName: "generate_images",
      input: { prompt: "cartoon fashion design agent" },
      inputHash: "hash-1",
      status: "waiting_confirmation",
      createdAt,
      updatedAt: createdAt
    };
    const action: PendingAgentAction = {
      id: "action-1",
      runId: run.id,
      toolCallId: toolCall.id,
      projectId: run.projectId,
      userId: run.userId,
      toolName: toolCall.toolName,
      input: toolCall.input,
      inputHash: toolCall.inputHash,
      targetNodeIds: [],
      taskCount: 4,
      status: "pending",
      expiresAt: "2026-07-25T00:30:00.000Z",
      createdAt
    };

    await repository.saveRun(run);
    await repository.saveToolCall(toolCall);
    await repository.savePendingAction(action);

    await expect(
      repository.confirmPendingAction("user-1", "run-1", "action-1", "2026-07-25T00:31:00.000Z")
    ).rejects.toThrow("CONFIRMATION_EXPIRED");

    await expect(repository.getPendingAction("user-1", "action-1")).resolves.toMatchObject({
      status: "expired"
    });
    await expect(repository.getRun("user-1", "run-1")).resolves.toMatchObject({
      status: "cancelled",
      completedAt: "2026-07-25T00:31:00.000Z"
    });
    await expect(repository.getToolCall("user-1", "tool-call-1")).resolves.toMatchObject({
      status: "cancelled",
      errorCode: "CONFIRMATION_EXPIRED",
      updatedAt: "2026-07-25T00:31:00.000Z"
    });
  });
});
