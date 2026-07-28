import type {
  AgentSession,
  PersistentAgentMessage,
  PersistentAgentRun,
} from "@loomoon/contracts";

export type AgentTimelineClient = {
  getAgentSession: (sessionId: string) => Promise<{
    session: AgentSession;
    messages: PersistentAgentMessage[];
  }>;
  getAgentRun: (runId: string) => Promise<PersistentAgentRun>;
};

export async function refreshAgentTimelineAfterProjectEvent(
  client: AgentTimelineClient,
  sessionId: string,
  currentRun?: PersistentAgentRun,
): Promise<{
  session: AgentSession;
  messages: PersistentAgentMessage[];
  run?: PersistentAgentRun;
}> {
  const timeline = await client.getAgentSession(sessionId);
  const runId = timeline.session.activeRunId ?? currentRun?.id;
  const run = runId ? await client.getAgentRun(runId) : undefined;
  return {
    session: timeline.session,
    messages: timeline.messages,
    ...(run ? { run } : {}),
  };
}

export function agentRunNeedsRefresh(run?: PersistentAgentRun): boolean {
  return Boolean(run && !["completed", "failed", "cancelled"].includes(run.status));
}
