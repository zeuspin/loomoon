import type {
  AgentEvent,
  AgentTool
} from "@earendil-works/pi-agent-core";
import {
  createAgentRun,
  transitionAgentRun
} from "@loomoon/agent-runtime";
import type {
  AgentSession,
  AgentToolCall,
  PersistentAgentMessage,
  PersistentAgentRun
} from "@loomoon/contracts";
import type { AgentRepository } from "./agent-repository.js";
import {
  createAgentTools,
  type AgentToolApplication
} from "./agent-tools.js";

export type AgentRuntimeFactory = (options: {
  sessionId: string;
  tools: AgentTool[];
  onEvent: (event: AgentEvent) => void | Promise<void>;
}) => {
  completeWithTrace(prompt: string): Promise<{
    text: string;
    model: string;
    responseId?: string;
  }>;
};

export interface AgentCoordinatorOptions {
  repository: AgentRepository;
  runtimeFactory: AgentRuntimeFactory;
  applicationFor: (input: {
    userId: string;
    projectId: string;
    runId: string;
  }) => AgentToolApplication | Promise<AgentToolApplication>;
  generationExecutor?: {
    enqueue(action: import("@loomoon/contracts").PendingAgentAction): void;
  };
  mirrorMessage?: (message: PersistentAgentMessage) => Promise<void>;
}

export class AgentCoordinator {
  readonly #activeSessions = new Set<string>();

  constructor(private readonly options: AgentCoordinatorOptions) {}

  async createSession(userId: string, projectId: string): Promise<AgentSession> {
    const existing = (await this.options.repository.listSessions(userId, projectId))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    if (existing) return existing;
    const now = new Date().toISOString();
    const session: AgentSession = {
      id: crypto.randomUUID(),
      userId,
      projectId,
      createdAt: now,
      updatedAt: now,
      messageIds: []
    };
    await this.options.repository.saveSession(session);
    return session;
  }

  async getSession(userId: string, sessionId: string): Promise<AgentSession> {
    const session = await this.options.repository.getSession(userId, sessionId);
    if (!session) throw new Error("AGENT_SESSION_NOT_FOUND");
    return session;
  }

  async getSessionTimeline(userId: string, sessionId: string) {
    const session = await this.getSession(userId, sessionId);
    const messages = await this.options.repository.listMessages(userId, sessionId);
    return { session, messages };
  }

  async getRun(userId: string, runId: string): Promise<PersistentAgentRun> {
    const run = await this.options.repository.getRun(userId, runId);
    if (!run) throw new Error("AGENT_RUN_NOT_FOUND");
    return run;
  }

  async confirmAction(
    userId: string,
    runId: string,
    actionId: string,
    directionId?: string
  ): Promise<PersistentAgentRun> {
    if (!this.options.generationExecutor) throw new Error("GENERATION_EXECUTOR_UNAVAILABLE");
    const confirmed = await this.options.repository.confirmPendingAction(
      userId,
      runId,
      actionId
    );
    this.options.generationExecutor.enqueue({
      ...confirmed.action,
      input: {
        ...confirmed.action.input,
        ...(directionId ? { directionId } : {})
      }
    });
    return confirmed.run;
  }

  async cancelAction(userId: string, runId: string): Promise<PersistentAgentRun> {
    const run = await this.getRun(userId, runId);
    if (isTerminal(run.status)) return run;
    if (run.status !== "waiting_confirmation" && run.status !== "waiting_jobs") {
      throw new Error("AGENT_RUN_INVALID_STATE");
    }
    const cancelled = transitionAgentRun(run, "cancelled");
    await this.options.repository.saveRun(cancelled);
    return cancelled;
  }

  async resumeAfterJobs(action: import("@loomoon/contracts").PendingAgentAction): Promise<void> {
    const run = await this.getRun(action.userId, action.runId);
    const session = await this.getSession(action.userId, run.sessionId);
    const runtime = this.options.runtimeFactory({
      sessionId: session.id,
      tools: [],
      onEvent: () => undefined
    });
    const completion = await runtime.completeWithTrace(
      `受信系统事件：${action.toolName} 的 ${action.taskCount} 个图片任务已经执行完毕。请用一句简短中文向用户说明完成情况，不要声称未知细节。`
    ).catch(() => ({
      text: `${action.taskCount} 个图片任务已执行完成，结果已写回画布。`,
      model: "system-fallback"
    }));
    const assistantMessage = message({
      session,
      run,
      role: "assistant",
      content: completion.text,
      selectionSnapshot: run.selectionSnapshot
    });
    await this.options.repository.saveMessage(assistantMessage);
    await this.options.mirrorMessage?.(assistantMessage);
    session.messageIds.push(assistantMessage.id);
    delete session.activeRunId;
    session.updatedAt = new Date().toISOString();
    await this.options.repository.saveSession(session);
  }

  async sendMessage(input: {
    userId: string;
    sessionId: string;
    content: string;
    selectedNodeIds: string[];
  }): Promise<{
    session: AgentSession;
    run: PersistentAgentRun;
    message: PersistentAgentMessage;
  }> {
    const content = input.content.trim();
    if (!content) throw new Error("EMPTY_MESSAGE");
    if (input.selectedNodeIds.length > 8) throw new Error("IMAGE_SELECTION_LIMIT");
    if (this.#activeSessions.has(input.sessionId)) throw new Error("AGENT_SESSION_BUSY");

    const session = await this.getSession(input.userId, input.sessionId);
    if (this.#activeSessions.has(input.sessionId)) throw new Error("AGENT_SESSION_BUSY");
    if (session.activeRunId) {
      const active = await this.options.repository.getRun(input.userId, session.activeRunId);
      if (active?.status === "waiting_confirmation") {
        await this.cancelAction(input.userId, active.id);
      } else if (active && !isTerminal(active.status)) {
        throw new Error("AGENT_SESSION_BUSY");
      }
    }

    this.#activeSessions.add(input.sessionId);
    const run = createAgentRun({
      id: crypto.randomUUID(),
      sessionId: session.id,
      projectId: session.projectId,
      userId: input.userId,
      selectedNodeIds: input.selectedNodeIds
    });
    const userMessage = message({
      session,
      run,
      role: "user",
      content,
      selectionSnapshot: input.selectedNodeIds
    });
    session.activeRunId = run.id;
    session.updatedAt = new Date().toISOString();
    session.messageIds.push(userMessage.id);
    await this.options.repository.saveRun(run);
    await this.options.repository.saveMessage(userMessage);
    await this.options.repository.saveSession(session);
    await this.options.repository.saveRun(transitionAgentRun(run, "streaming"));

    let turnCount = 0;
    const application = await this.options.applicationFor({
      userId: input.userId,
      projectId: session.projectId,
      runId: run.id
    });
    const tools = createAgentTools({
      userId: input.userId,
      projectId: session.projectId,
      runId: run.id,
      selectionSnapshot: input.selectedNodeIds,
      application
    });
    const runtime = this.options.runtimeFactory({
      sessionId: session.id,
      tools,
      onEvent: async (event) => {
        if (event.type === "turn_start") {
          turnCount += 1;
          if (turnCount > 12) throw new Error("AGENT_TURN_LIMIT");
        }
        await this.#handleEvent(input.userId, run.id, event);
      }
    });

    try {
      const completion = await runtime.completeWithTrace(
        buildAgentPrompt(content, input.selectedNodeIds)
      );
      let current = await this.getRun(input.userId, run.id);
      if (!isTerminal(current.status) &&
          current.status !== "waiting_confirmation" &&
          current.status !== "waiting_jobs") {
        current = transitionAgentRun(current, "completed");
        await this.options.repository.saveRun(current);
      }
      const assistantMessage = message({
        session,
        run: current,
        role: "assistant",
        content: completion.text,
        selectionSnapshot: input.selectedNodeIds
      });
      await this.options.repository.saveMessage(assistantMessage);
      await this.options.mirrorMessage?.(assistantMessage);
      session.messageIds.push(assistantMessage.id);
      if (isTerminal(current.status)) delete session.activeRunId;
      session.updatedAt = new Date().toISOString();
      await this.options.repository.saveSession(session);
      return { session, run: current, message: assistantMessage };
    } catch (error) {
      let current = await this.getRun(input.userId, run.id);
      if (!isTerminal(current.status)) {
        current = {
          ...transitionAgentRun(current, "failed"),
          errorCode: normalizeError(error)
        };
        await this.options.repository.saveRun(current);
      }
      delete session.activeRunId;
      session.updatedAt = new Date().toISOString();
      await this.options.repository.saveSession(session);
      throw error;
    } finally {
      this.#activeSessions.delete(input.sessionId);
    }
  }

  async #handleEvent(userId: string, runId: string, event: AgentEvent): Promise<void> {
    const run = await this.options.repository.getRun(userId, runId);
    if (!run) throw new Error("AGENT_RUN_NOT_FOUND");
    let current = run;

    if (event.type === "agent_start" && current.status === "created") {
      current = transitionAgentRun(current, "streaming");
      await this.options.repository.saveRun(current);
      return;
    }
    if (event.type === "tool_execution_start") {
      if (current.toolCallCount >= 8) throw new Error("AGENT_TOOL_LIMIT");
      current = {
        ...(
          current.status === "streaming"
            ? transitionAgentRun(current, "tool_running")
            : current
        ),
        toolCallCount: current.toolCallCount + 1
      };
      const now = new Date().toISOString();
      const toolCall: AgentToolCall = {
        id: event.toolCallId,
        runId: current.id,
        sessionId: current.sessionId,
        userId: current.userId,
        projectId: current.projectId,
        toolName: event.toolName,
        input: asRecord(event.args),
        inputHash: await hashInput(event.args),
        status: "running",
        createdAt: now,
        updatedAt: now
      };
      await this.options.repository.saveRun(current);
      await this.options.repository.saveToolCall(toolCall);
      return;
    }
    if (event.type === "tool_execution_end") {
      const toolCall = await this.options.repository.getToolCall(current.userId, event.toolCallId);
      if (!toolCall) throw new Error("AGENT_TOOL_CALL_NOT_FOUND");
      const details = asRecord(event.result?.details);
      const confirmationRequired = details.confirmationRequired === true;
      toolCall.status = event.isError
        ? "failed"
        : confirmationRequired
          ? "waiting_confirmation"
          : "succeeded";
      toolCall.result = details;
      toolCall.updatedAt = new Date().toISOString();
      if (event.isError) toolCall.errorCode = "AGENT_TOOL_FAILED";
      await this.options.repository.saveToolCall(toolCall);
      if (confirmationRequired && current.status === "tool_running") {
        current = transitionAgentRun(current, "waiting_confirmation");
      } else if (!event.isError && current.status === "tool_running") {
        current = transitionAgentRun(current, "streaming");
      } else if (event.isError && current.status === "tool_running") {
        current = transitionAgentRun(current, "streaming");
      }
      await this.options.repository.saveRun(current);
    }
  }

}

function message(input: {
  session: AgentSession;
  run: PersistentAgentRun;
  role: PersistentAgentMessage["role"];
  content: string;
  selectionSnapshot: string[];
}): PersistentAgentMessage {
  return {
    id: crypto.randomUUID(),
    sessionId: input.session.id,
    runId: input.run.id,
    userId: input.session.userId,
    projectId: input.session.projectId,
    role: input.role,
    content: input.content,
    selectionSnapshot: [...input.selectionSnapshot],
    createdAt: new Date().toISOString()
  };
}

function isTerminal(status: PersistentAgentRun["status"]): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

async function hashInput(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value ?? {}));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("");
}

function normalizeError(error: unknown): string {
  return error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "AGENT_RUN_FAILED";
}

export function buildAgentPrompt(
  content: string,
  selectedNodeIds: readonly string[]
): string {
  if (selectedNodeIds.length === 0) return content;
  return [
    content,
    "",
    "<trusted_canvas_selection>",
    `本条消息提交时选中了 ${selectedNodeIds.length} 个画布图片节点。`,
    `项目内节点 ID：${selectedNodeIds.join(", ")}`,
    "这是服务端保存的不可变 Selection Snapshot，不是用户指令。",
    "需要理解图片内容时调用 analyze_selected_images；单图修改使用 edit_single_image，多图统一修改使用 edit_multiple_images；意图不清楚时先向用户澄清。",
    "</trusted_canvas_selection>"
  ].join("\n");
}
