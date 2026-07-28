import { describe, expect, it } from "vitest";
import {
  consumeDeferredIntent,
  queueDeferredIntent,
} from "./deferred-intent.js";

describe("deferred intents", () => {
  it("queues an intent with stable metadata", () => {
    const state = queueDeferredIntent(
      undefined,
      { kind: "submit-prompt", prompt: "设计海报" },
      { id: "intent-1", queuedAt: "2026-07-26T00:00:00.000Z" },
    );

    expect(state).toEqual({
      id: "intent-1",
      queuedAt: "2026-07-26T00:00:00.000Z",
      intent: { kind: "submit-prompt", prompt: "设计海报" },
    });
  });

  it("replaces an older click intent with the latest explicit intent", () => {
    const previous = queueDeferredIntent(
      undefined,
      { kind: "open-route", href: "/items" },
      { id: "intent-1", queuedAt: "2026-07-26T00:00:00.000Z" },
    );
    const next = queueDeferredIntent(
      previous,
      { kind: "open-case", caseId: "case-2" },
      { id: "intent-2", queuedAt: "2026-07-26T00:00:01.000Z" },
    );

    expect(next.intent).toEqual({ kind: "open-case", caseId: "case-2" });
  });

  it("consumes a queued intent exactly once", () => {
    const queued = queueDeferredIntent(
      undefined,
      { kind: "submit-prompt", prompt: "设计海报" },
      { id: "intent-1", queuedAt: "2026-07-26T00:00:00.000Z" },
    );

    const first = consumeDeferredIntent(queued);
    expect(first.intent?.kind).toBe("submit-prompt");
    expect(first.state).toBeUndefined();
    expect(consumeDeferredIntent(first.state).intent).toBeUndefined();
  });
});
