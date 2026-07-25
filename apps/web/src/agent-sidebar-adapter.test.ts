import { describe, expect, test } from "vitest";
import {
  createAgentSendInput,
  resolveAgentUiRuntime,
} from "./agent-sidebar-adapter";

describe("agent sidebar adapter", () => {
  test("defaults to assistant-ui and preserves the explicit legacy fallback", () => {
    expect(resolveAgentUiRuntime(undefined)).toBe("assistant-ui");
    expect(resolveAgentUiRuntime("assistant-ui")).toBe("assistant-ui");
    expect(resolveAgentUiRuntime("legacy")).toBe("legacy");
    expect(resolveAgentUiRuntime("unexpected")).toBe("assistant-ui");
  });

  test("normalizes the Web send command", () => {
    expect(createAgentSendInput("  修改图片  ", ["node-1", "node-1"])).toEqual({
      text: "修改图片",
      nodeIds: ["node-1"],
    });
  });
});
