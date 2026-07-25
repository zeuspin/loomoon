import type { AppendMessage } from "@assistant-ui/react";
import { describe, expect, test } from "vitest";
import { parseOutgoingMessage } from "./runtime-adapter.js";

describe("parseOutgoingMessage", () => {
  test("extracts text and de-duplicates the captured canvas selection", () => {
    const message = {
      role: "user",
      content: [
        { type: "text", text: "修改这些图片" },
        { type: "text", text: "，保留原图。" },
      ],
      createdAt: new Date("2026-07-25T00:00:00.000Z"),
      metadata: { custom: {} },
      parentId: null,
      sourceId: null,
      runConfig: undefined,
    } as AppendMessage;

    expect(
      parseOutgoingMessage(message, {
        type: "canvas-selection",
        canvasVersion: 4,
        nodeIds: ["node-1", "node-2", "node-1"],
        assets: [],
      }),
    ).toEqual({
      text: "修改这些图片，保留原图。",
      nodeIds: ["node-1", "node-2"],
    });
  });

  test("rejects an outgoing message without text", () => {
    const message = {
      role: "user",
      content: [],
      createdAt: new Date("2026-07-25T00:00:00.000Z"),
      metadata: { custom: {} },
      parentId: null,
      sourceId: null,
      runConfig: undefined,
    } as unknown as AppendMessage;

    expect(() => parseOutgoingMessage(message)).toThrow(
      "消息必须包含文本内容",
    );
  });
});
