import type {
  AgentRunStatus,
  PersistentAgentRun
} from "@loomoon/contracts";

export type { AgentRunStatus } from "@loomoon/contracts";

const transitions: Readonly<Record<AgentRunStatus, readonly AgentRunStatus[]>> = {
  created: ["streaming", "failed", "cancelled"],
  streaming: [
    "tool_running",
    "waiting_confirmation",
    "waiting_jobs",
    "completed",
    "failed",
    "cancelled"
  ],
  tool_running: [
    "streaming",
    "waiting_confirmation",
    "waiting_jobs",
    "completed",
    "failed",
    "cancelled"
  ],
  waiting_confirmation: ["waiting_jobs", "cancelled", "failed"],
  waiting_jobs: ["streaming", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: []
};

export function assertAgentRunTransition(
  from: AgentRunStatus,
  to: AgentRunStatus
): void {
  if (!transitions[from].includes(to)) {
    throw new Error("AGENT_RUN_INVALID_TRANSITION");
  }
}

export function createAgentRun(input: {
  id: string;
  sessionId: string;
  projectId: string;
  userId: string;
  selectedNodeIds: string[];
  now?: string;
}): PersistentAgentRun {
  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id,
    sessionId: input.sessionId,
    projectId: input.projectId,
    userId: input.userId,
    status: "created",
    selectionSnapshot: [...input.selectedNodeIds],
    toolCallCount: 0,
    paidTaskCount: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function transitionAgentRun(
  run: PersistentAgentRun,
  status: AgentRunStatus,
  now = new Date().toISOString()
): PersistentAgentRun {
  assertAgentRunTransition(run.status, status);
  return {
    ...run,
    status,
    updatedAt: now,
    ...(
      status === "completed" || status === "failed" || status === "cancelled"
        ? { completedAt: now }
        : {}
    )
  };
}
