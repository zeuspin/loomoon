import type { PersistentAgentMessage } from "@loomoon/contracts";

export type AgentUiMessage = PersistentAgentMessage & {
  deliveryStatus: "pending" | "sent" | "failed";
  clientMessageId?: string;
};

export function optimisticUserMessage(input: {
  clientMessageId: string;
  sessionId: string;
  projectId: string;
  content: string;
  selectionSnapshot: string[];
  createdAt?: string;
}): AgentUiMessage {
  return {
    id: input.clientMessageId,
    clientMessageId: input.clientMessageId,
    sessionId: input.sessionId,
    userId: "local",
    projectId: input.projectId,
    role: "user",
    content: input.content,
    selectionSnapshot: [...input.selectionSnapshot],
    createdAt: input.createdAt ?? new Date().toISOString(),
    deliveryStatus: "pending",
  };
}

export function failOptimisticMessage(message: AgentUiMessage): AgentUiMessage {
  return { ...message, deliveryStatus: "failed" };
}

function sameSubmission(
  persisted: PersistentAgentMessage,
  optimistic: AgentUiMessage,
): boolean {
  return persisted.id === optimistic.id || (
    persisted.role === "user" &&
    persisted.sessionId === optimistic.sessionId &&
    persisted.content === optimistic.content &&
    persisted.selectionSnapshot.join("\u0000") === optimistic.selectionSnapshot.join("\u0000") &&
    Math.abs(Date.parse(persisted.createdAt) - Date.parse(optimistic.createdAt)) < 60_000
  );
}

export function mergeAgentMessages(
  persisted: PersistentAgentMessage[],
  optimistic: AgentUiMessage[],
): AgentUiMessage[] {
  const serverMessages = persisted
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({ ...message, deliveryStatus: "sent" as const }));
  const unmatched = optimistic.filter(
    (candidate) => !serverMessages.some((message) => sameSubmission(message, candidate)),
  );

  return [...serverMessages, ...unmatched].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
}
