import { describe, expect, it } from "vitest";
import {
  consumeProjectLaunchIntent,
  queueProjectLaunchIntent,
  type KeyValueStorage,
} from "./project-launch-intent.js";

function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe("project launch intents", () => {
  it("keeps a prompt scoped to its project and consumes it exactly once", () => {
    const storage = createMemoryStorage();
    queueProjectLaunchIntent(storage, {
      id: "launch-1",
      projectId: "project-2",
      prompt: "设计一张夏日海报",
      createdAt: "2026-07-27T00:00:00.000Z",
    });

    expect(consumeProjectLaunchIntent(storage, "project-1")).toBeUndefined();
    expect(consumeProjectLaunchIntent(storage, "project-2")).toEqual({
      id: "launch-1",
      projectId: "project-2",
      prompt: "设计一张夏日海报",
      createdAt: "2026-07-27T00:00:00.000Z",
    });
    expect(consumeProjectLaunchIntent(storage, "project-2")).toBeUndefined();
  });

  it("rejects blank launch prompts before writing storage", () => {
    const storage = createMemoryStorage();

    expect(() =>
      queueProjectLaunchIntent(storage, {
        id: "launch-1",
        projectId: "project-1",
        prompt: "   ",
        createdAt: "2026-07-27T00:00:00.000Z",
      }),
    ).toThrow("PROJECT_LAUNCH_PROMPT_REQUIRED");
    expect(consumeProjectLaunchIntent(storage, "project-1")).toBeUndefined();
  });

  it("discards malformed launch data without affecting another project", () => {
    const storage = createMemoryStorage({
      "loomoon:project-launch:project-1": "not-json",
    });
    queueProjectLaunchIntent(storage, {
      id: "launch-2",
      projectId: "project-2",
      prompt: "设计品牌海报",
      createdAt: "2026-07-27T00:01:00.000Z",
    });

    expect(consumeProjectLaunchIntent(storage, "project-1")).toBeUndefined();
    expect(consumeProjectLaunchIntent(storage, "project-2")?.id).toBe(
      "launch-2",
    );
  });
});
