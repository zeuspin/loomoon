import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAgentRun, transitionAgentRun } from "@loomoon/agent-runtime";
import type { PendingAgentAction } from "@loomoon/contracts";
import { JsonAgentRepository } from "./agent-repository.js";
import { LocalGenerationExecutor } from "./local-generation-executor.js";

describe("LocalGenerationExecutor", () => {
  it("runs at most two actions per user and completes their waiting runs", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-agent-"));
    const repository = new JsonAgentRepository(root);
    let active = 0;
    let maximum = 0;
    let calls = 0;
    const releases: Array<() => void> = [];
    const executor = new LocalGenerationExecutor({
      repository,
      executeAction: async () => {
        calls += 1;
        active += 1;
        maximum = Math.max(maximum, active);
        if (calls <= 2) {
          await new Promise<void>((resolve) => releases.push(resolve));
        }
        active -= 1;
      }
    });

    for (let index = 0; index < 3; index += 1) {
      const run = transitionAgentRun(
        transitionAgentRun(
          transitionAgentRun(createAgentRun({
            id: `run-${index}`,
            sessionId: "session-1",
            projectId: "project-1",
            userId: "user-1",
            selectedNodeIds: []
          }), "streaming"),
          "waiting_confirmation"
        ),
        "waiting_jobs"
      );
      const action: PendingAgentAction = {
        id: `action-${index}`,
        runId: run.id,
        toolCallId: `call-${index}`,
        userId: "user-1",
        projectId: "project-1",
        toolName: "generate_images",
        input: {},
        inputHash: `hash-${index}`,
        targetNodeIds: [],
        taskCount: 1,
        status: "confirmed",
        expiresAt: "2099-01-01T00:00:00.000Z",
        createdAt: "2026-07-25T00:00:00.000Z",
        confirmedAt: "2026-07-25T00:00:01.000Z"
      };
      await repository.saveRun(run);
      await repository.savePendingAction(action);
      executor.enqueue(action);
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(maximum).toBe(2);
    expect(active).toBe(2);
    releases.splice(0).forEach((release) => release());
    await executor.waitForIdle();

    expect((await repository.getRun("user-1", "run-2"))?.status).toBe("completed");
    expect((await repository.getPendingAction("user-1", "action-2"))?.status).toBe("completed");
  });
});
