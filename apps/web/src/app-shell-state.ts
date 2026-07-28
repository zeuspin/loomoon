import {
  consumeDeferredIntent,
  queueDeferredIntent,
  type DeferredIntent,
  type DeferredIntentState,
} from "./deferred-intent.js";

export type PublicInteraction = "type" | "scroll" | "prompt-rotation";
export type ShellInteraction = PublicInteraction | "click" | "login";

export type ProtectedClickDecision =
  | { kind: "allow" }
  | {
      kind: "require-login";
      intent: DeferredIntentState | undefined;
    };

export function protectedClickDecision(
  authenticated: boolean,
  interaction: ShellInteraction,
  intent?: DeferredIntent,
): ProtectedClickDecision {
  if (
    interaction === "type" ||
    interaction === "scroll" ||
    interaction === "prompt-rotation"
  ) {
    return { kind: "allow" };
  }
  if (authenticated) return { kind: "allow" };
  if (interaction === "login") {
    return { kind: "require-login", intent: undefined };
  }
  return {
    kind: "require-login",
    intent: intent ? queueDeferredIntent(undefined, intent) : undefined,
  };
}

export function resumeIntentAfterLogin(
  state: DeferredIntentState | undefined,
  succeeded: boolean,
): {
  intent: DeferredIntent | undefined;
  state: DeferredIntentState | undefined;
} {
  if (!succeeded) return { intent: undefined, state };
  return consumeDeferredIntent(state);
}

export function describeProjectCreation(
  prompt: string | undefined,
  referenceTitle?: string,
): { name: string; initialPrompt?: string } {
  const normalizedPrompt = prompt?.trim();
  if (!normalizedPrompt) return { name: "未命名项目" };
  if (!referenceTitle) {
    return { name: "未命名", initialPrompt: normalizedPrompt };
  }
  return {
    name: `同款 · ${referenceTitle}`,
    initialPrompt: `${normalizedPrompt}\n\n参考灵感案例：${referenceTitle}。请先分析其构图、材质和配色，再提出适合本项目的方向。`,
  };
}
