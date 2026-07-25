import { transitionAgentRun } from "@loomoon/agent-runtime";
import type { PendingAgentAction } from "@loomoon/contracts";
import type { AgentRepository } from "./agent-repository.js";

export class LocalGenerationExecutor {
  readonly #queues = new Map<string, PendingAgentAction[]>();
  readonly #activeByUser = new Map<string, number>();
  readonly #running = new Set<Promise<void>>();

  constructor(private readonly options: {
    repository: AgentRepository;
    executeAction: (action: PendingAgentAction) => Promise<void>;
    onSucceeded?: (action: PendingAgentAction) => Promise<void>;
    perUserConcurrency?: number;
  }) {}

  enqueue(action: PendingAgentAction): void {
    if (action.status !== "confirmed") throw new Error("ACTION_NOT_CONFIRMED");
    const queue = this.#queues.get(action.userId) ?? [];
    if (!queue.some((item) => item.id === action.id)) queue.push(structuredClone(action));
    this.#queues.set(action.userId, queue);
    this.#pump(action.userId);
  }

  async recover(userId: string): Promise<void> {
    const actions = await this.options.repository.listPendingActions(userId);
    actions.filter((action) => action.status === "confirmed").forEach((action) => {
      this.enqueue(action);
    });
  }

  async waitForIdle(): Promise<void> {
    while (this.#running.size > 0 ||
           [...this.#queues.values()].some((queue) => queue.length > 0)) {
      if (this.#running.size > 0) {
        await Promise.allSettled([...this.#running]);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }
  }

  #pump(userId: string): void {
    const limit = this.options.perUserConcurrency ?? 2;
    const queue = this.#queues.get(userId) ?? [];
    while ((this.#activeByUser.get(userId) ?? 0) < limit && queue.length > 0) {
      const action = queue.shift()!;
      this.#activeByUser.set(userId, (this.#activeByUser.get(userId) ?? 0) + 1);
      const running = this.#execute(action).finally(() => {
        this.#running.delete(running);
        this.#activeByUser.set(userId, Math.max(0, (this.#activeByUser.get(userId) ?? 1) - 1));
        this.#pump(userId);
      });
      this.#running.add(running);
    }
  }

  async #execute(action: PendingAgentAction): Promise<void> {
    try {
      await this.options.executeAction(action);
      await this.options.onSucceeded?.(action);
      const latest = await this.options.repository.getPendingAction(action.userId, action.id);
      if (latest?.status === "cancelled") return;
      await this.options.repository.savePendingAction({
        ...(latest ?? action),
        status: "completed"
      });
      const run = await this.options.repository.getRun(action.userId, action.runId);
      if (run?.status === "waiting_jobs") {
        await this.options.repository.saveRun(transitionAgentRun(run, "completed"));
      }
      const toolCall = await this.options.repository.getToolCall(action.userId, action.toolCallId);
      if (toolCall) {
        toolCall.status = "succeeded";
        toolCall.updatedAt = new Date().toISOString();
        await this.options.repository.saveToolCall(toolCall);
      }
    } catch (error) {
      const latest = await this.options.repository.getPendingAction(action.userId, action.id);
      await this.options.repository.savePendingAction({
        ...(latest ?? action),
        status: "failed"
      });
      const run = await this.options.repository.getRun(action.userId, action.runId);
      if (run?.status === "waiting_jobs") {
        await this.options.repository.saveRun({
          ...transitionAgentRun(run, "failed"),
          errorCode: providerError(error)
        });
      }
      const toolCall = await this.options.repository.getToolCall(action.userId, action.toolCallId);
      if (toolCall) {
        toolCall.status = "failed";
        toolCall.errorCode = providerError(error);
        toolCall.updatedAt = new Date().toISOString();
        await this.options.repository.saveToolCall(toolCall);
      }
    }
  }
}

function providerError(error: unknown): string {
  return error instanceof Error && /^[A-Z0-9_]+/.test(error.message)
    ? error.message.split(":")[0]!
    : "GENERATION_FAILED";
}
