import type { DemoProject, PersistentAgentMessage } from "@loomoon/contracts";
import type { LoomoonAgentEntry, MessageEntry } from "./model.js";

export function mapProjectToAgentEntries(
  project: DemoProject,
  agentMessages?: PersistentAgentMessage[],
): LoomoonAgentEntry[] {
  const sourceMessages = agentMessages ?? project.messages;
  const messages: LoomoonAgentEntry[] = sourceMessages.flatMap((message) => {
    if (message.role !== "user" && message.role !== "assistant") return [];
    const rawStatus = "deliveryStatus" in message ? message.deliveryStatus : undefined;
    const deliveryStatus: NonNullable<MessageEntry["deliveryStatus"]> =
      rawStatus === "pending" || rawStatus === "failed" ? rawStatus : "sent";
    return [{
      id: message.id,
      kind: "message",
      role: message.role,
      text: message.content,
      selectionNodeIds: [...message.selectionSnapshot],
      createdAt: message.createdAt,
      deliveryStatus,
    } satisfies MessageEntry];
  });
  const plans: LoomoonAgentEntry[] = project.plans
    .filter((plan) => plan.status === "awaiting_confirmation")
    .map((plan) => ({
      id: `plan:${plan.id}`,
      kind: "plan",
      plan: {
        ...plan,
        directions: [
          { ...plan.directions[0] },
          { ...plan.directions[1] },
        ],
      },
    }));
  const confirmations: LoomoonAgentEntry[] = project.confirmations
    .filter((confirmation) =>
      confirmation.status === "pending" &&
      !plans.some((entry) => entry.kind === "plan" && entry.plan.id === confirmation.id)
    )
    .map((confirmation) => ({
      id: `confirmation:${confirmation.id}`,
      kind: "confirmation",
      confirmation: {
        ...confirmation,
        targetNodeIds: [...confirmation.targetNodeIds],
      },
    }));
  return [...messages, ...plans, ...confirmations];
}
