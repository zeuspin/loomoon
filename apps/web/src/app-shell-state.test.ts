import { describe, expect, it } from "vitest";
import {
  describeProjectCreation,
  protectedClickDecision,
  resumeIntentAfterLogin,
} from "./app-shell-state.js";
import type { DeferredIntentState } from "./deferred-intent.js";

describe("application shell authentication decisions", () => {
  it("allows typing, scrolling, and prompt rotation without authentication", () => {
    expect(protectedClickDecision(false, "type")).toEqual({ kind: "allow" });
    expect(protectedClickDecision(false, "scroll")).toEqual({ kind: "allow" });
    expect(protectedClickDecision(false, "prompt-rotation")).toEqual({
      kind: "allow",
    });
  });

  it("queues click intents when the user is logged out", () => {
    const decision = protectedClickDecision(false, "click", {
      kind: "open-route",
      href: "/items",
    });

    expect(decision.kind).toBe("require-login");
    if (decision.kind === "require-login") {
      expect(decision.intent).toBeDefined();
      if (!decision.intent) throw new Error("Expected a queued intent");
      expect(decision.intent.intent).toEqual({
        kind: "open-route",
        href: "/items",
      });
    }
  });

  it("allows clicks immediately for an authenticated user", () => {
    expect(
      protectedClickDecision(true, "click", {
        kind: "open-route",
        href: "/items",
      }),
    ).toEqual({ kind: "allow" });
  });

  it("does not create an intent for passive login", () => {
    expect(protectedClickDecision(false, "login")).toEqual({
      kind: "require-login",
      intent: undefined,
    });
  });

  it("retains a queued intent after failed login and consumes it after success", () => {
    const queued: DeferredIntentState = {
      id: "intent-1",
      queuedAt: "2026-07-26T00:00:00.000Z",
      intent: { kind: "open-case", caseId: "case-1" },
    };

    expect(resumeIntentAfterLogin(queued, false)).toEqual({
      intent: undefined,
      state: queued,
    });
    expect(resumeIntentAfterLogin(queued, true)).toEqual({
      intent: { kind: "open-case", caseId: "case-1" },
      state: undefined,
    });
  });
});

describe("project creation descriptions", () => {
  it("creates a blank project without an Agent launch message", () => {
    expect(describeProjectCreation(undefined)).toEqual({
      name: "未命名项目",
    });
  });

  it("uses a homepage prompt as the new project's first Agent message", () => {
    expect(describeProjectCreation("  设计海报  ")).toEqual({
      name: "未命名",
      initialPrompt: "设计海报",
    });
  });

  it("preserves the inspiration analysis instruction in the first message", () => {
    expect(describeProjectCreation("做同款", "霓虹包装")).toEqual({
      name: "同款 · 霓虹包装",
      initialPrompt:
        "做同款\n\n参考灵感案例：霓虹包装。请先分析其构图、材质和配色，再提出适合本项目的方向。",
    });
  });
});
