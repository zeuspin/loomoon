export type DeferredIntent =
  | { kind: "submit-prompt"; prompt: string; referenceCaseId?: string }
  | { kind: "create-project" }
  | { kind: "open-route"; href: string }
  | { kind: "open-case"; caseId: string }
  | { kind: "remix-case"; caseId: string }
  | {
      kind: "open-overlay";
      overlay: "membership" | "notices" | "about";
    };

export interface DeferredIntentState {
  id: string;
  queuedAt: string;
  intent: DeferredIntent;
}

interface DeferredIntentMetadata {
  id: string;
  queuedAt: string;
}

export function queueDeferredIntent(
  _current: DeferredIntentState | undefined,
  intent: DeferredIntent,
  metadata: DeferredIntentMetadata = {
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  },
): DeferredIntentState {
  return {
    id: metadata.id,
    queuedAt: metadata.queuedAt,
    intent,
  };
}

export function consumeDeferredIntent(
  state: DeferredIntentState | undefined,
): { intent: DeferredIntent | undefined; state: undefined } {
  return {
    intent: state?.intent,
    state: undefined,
  };
}
