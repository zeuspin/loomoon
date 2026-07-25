export type AgentUiRuntime = "assistant-ui" | "legacy";

export function resolveAgentUiRuntime(
  value: string | undefined,
): AgentUiRuntime {
  return value === "legacy" ? "legacy" : "assistant-ui";
}

export function createAgentSendInput(
  text: string,
  nodeIds: readonly string[],
) {
  return {
    text: text.trim(),
    nodeIds: [...new Set(nodeIds)],
  };
}
