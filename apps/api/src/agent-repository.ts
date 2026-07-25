import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  AgentSession,
  AgentStateDocument,
  AgentToolCall,
  PendingAgentAction,
  PersistentAgentMessage,
  PersistentAgentRun
} from "@loomoon/contracts";
import { transitionAgentRun } from "@loomoon/agent-runtime";

export interface AgentRepository {
  getSession(userId: string, sessionId: string): Promise<AgentSession | undefined>;
  listSessions(userId: string, projectId: string): Promise<AgentSession[]>;
  saveSession(session: AgentSession): Promise<void>;
  getRun(userId: string, runId: string): Promise<PersistentAgentRun | undefined>;
  saveRun(run: PersistentAgentRun): Promise<void>;
  listMessages(userId: string, sessionId: string): Promise<PersistentAgentMessage[]>;
  saveMessage(message: PersistentAgentMessage): Promise<void>;
  getToolCall(userId: string, toolCallId: string): Promise<AgentToolCall | undefined>;
  saveToolCall(toolCall: AgentToolCall): Promise<void>;
  getPendingAction(userId: string, actionId: string): Promise<PendingAgentAction | undefined>;
  listPendingActions(userId?: string): Promise<PendingAgentAction[]>;
  savePendingAction(action: PendingAgentAction): Promise<void>;
  confirmPendingAction(
    userId: string,
    runId: string,
    actionId: string,
    now?: string
  ): Promise<{
    action: PendingAgentAction;
    run: PersistentAgentRun;
    toolCall: AgentToolCall;
  }>;
}

const emptyDocument = (): AgentStateDocument => ({
  sessions: [],
  runs: [],
  messages: [],
  toolCalls: [],
  pendingActions: []
});

export class JsonAgentRepository implements AgentRepository {
  readonly #queues = new Map<string, Promise<void>>();

  constructor(private readonly root: string) {}

  async getSession(userId: string, sessionId: string): Promise<AgentSession | undefined> {
    return clone((await this.#read(userId)).sessions.find((item) => item.id === sessionId));
  }

  async listSessions(userId: string, projectId: string): Promise<AgentSession[]> {
    return clone((await this.#read(userId)).sessions.filter((item) => item.projectId === projectId));
  }

  async saveSession(session: AgentSession): Promise<void> {
    await this.#upsert(session.userId, "sessions", session);
  }

  async getRun(userId: string, runId: string): Promise<PersistentAgentRun | undefined> {
    return clone((await this.#read(userId)).runs.find((item) => item.id === runId));
  }

  async saveRun(run: PersistentAgentRun): Promise<void> {
    await this.#upsert(run.userId, "runs", run);
  }

  async listMessages(userId: string, sessionId: string): Promise<PersistentAgentMessage[]> {
    return clone((await this.#read(userId)).messages.filter((item) => item.sessionId === sessionId));
  }

  async saveMessage(message: PersistentAgentMessage): Promise<void> {
    await this.#upsert(message.userId, "messages", message);
  }

  async getToolCall(userId: string, toolCallId: string): Promise<AgentToolCall | undefined> {
    return clone((await this.#read(userId)).toolCalls.find((item) => item.id === toolCallId));
  }

  async saveToolCall(toolCall: AgentToolCall): Promise<void> {
    await this.#upsert(toolCall.userId, "toolCalls", toolCall);
  }

  async getPendingAction(userId: string, actionId: string): Promise<PendingAgentAction | undefined> {
    return clone((await this.#read(userId)).pendingActions.find((item) => item.id === actionId));
  }

  async listPendingActions(userId?: string): Promise<PendingAgentAction[]> {
    if (!userId) throw new Error("USER_SCOPE_REQUIRED");
    return clone((await this.#read(userId)).pendingActions);
  }

  async savePendingAction(action: PendingAgentAction): Promise<void> {
    await this.#upsert(action.userId, "pendingActions", action);
  }

  async confirmPendingAction(
    userId: string,
    runId: string,
    actionId: string,
    now = new Date().toISOString()
  ): Promise<{
    action: PendingAgentAction;
    run: PersistentAgentRun;
    toolCall: AgentToolCall;
  }> {
    let confirmed:
      | {
          action: PendingAgentAction;
          run: PersistentAgentRun;
          toolCall: AgentToolCall;
        }
      | undefined;
    await this.#exclusive(userId, async () => {
      const document = await this.#read(userId);
      const action = document.pendingActions.find((item) => item.id === actionId && item.runId === runId);
      const run = document.runs.find((item) => item.id === runId);
      const toolCall = action
        ? document.toolCalls.find((item) => item.id === action.toolCallId)
        : undefined;
      if (!action || !run || !toolCall) throw new Error("CONFIRMATION_NOT_FOUND");
      if (action.status === "confirmed" || action.status === "completed") {
        confirmed = { action: clone(action), run: clone(run), toolCall: clone(toolCall) };
        return;
      }
      if (action.status !== "pending" || Date.parse(action.expiresAt) <= Date.parse(now)) {
        action.status = "expired";
        if (run.status === "waiting_confirmation") Object.assign(run, transitionAgentRun(run, "cancelled", now));
        toolCall.status = "cancelled";
        toolCall.errorCode = "CONFIRMATION_EXPIRED";
        toolCall.updatedAt = now;
        await this.#write(userId, document);
        throw new Error("CONFIRMATION_EXPIRED");
      }
      if (run.status !== "waiting_confirmation") throw new Error("AGENT_RUN_INVALID_STATE");
      action.status = "confirmed";
      action.confirmedAt = now;
      const nextRun = transitionAgentRun(run, "waiting_jobs", now);
      Object.assign(run, nextRun);
      toolCall.status = "waiting_jobs";
      toolCall.updatedAt = now;
      await this.#write(userId, document);
      confirmed = {
        action: clone(action),
        run: clone(run),
        toolCall: clone(toolCall)
      };
    });
    if (!confirmed) throw new Error("CONFIRMATION_NOT_FOUND");
    return confirmed;
  }

  async #upsert<
    K extends keyof AgentStateDocument,
    T extends AgentStateDocument[K][number] & { id: string }
  >(userId: string, key: K, value: T): Promise<void> {
    await this.#exclusive(userId, async () => {
      const document = await this.#read(userId);
      const collection = document[key] as unknown as T[];
      const index = collection.findIndex((item) => item.id === value.id);
      if (index >= 0) collection[index] = clone(value);
      else collection.push(clone(value));
      await this.#write(userId, document);
    });
  }

  async #exclusive(userId: string, operation: () => Promise<void>): Promise<void> {
    const previous = this.#queues.get(userId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.#queues.set(userId, current);
    try {
      await current;
    } finally {
      if (this.#queues.get(userId) === current) this.#queues.delete(userId);
    }
  }

  async #read(userId: string): Promise<AgentStateDocument> {
    try {
      return JSON.parse(await readFile(this.#file(userId), "utf8")) as AgentStateDocument;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyDocument();
      throw error;
    }
  }

  async #write(userId: string, document: AgentStateDocument): Promise<void> {
    const file = this.#file(userId);
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(temporary, JSON.stringify(document, null, 2), "utf8");
    await rename(temporary, file);
  }

  #file(userId: string): string {
    if (!/^[a-z0-9-]+$/i.test(userId)) throw new Error("INVALID_USER_SCOPE");
    return join(this.root, userId, "state.json");
  }
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}
