import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Context
} from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { describe, expect, it, vi } from "vitest";
import { PiRuntime } from "./pi-runtime.js";

const usage = {
  input: 1,
  output: 1,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 2,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
};

describe("PiRuntime", () => {
  it("runs through Pi Agent Core without exposing host tools", async () => {
    const streamFn = vi.fn((_model, context: Context) => {
      expect(context.tools).toEqual([]);
      const stream = createAssistantMessageEventStream();
      const message: AssistantMessage = {
        role: "assistant",
        content: [{ type: "text", text: "两个方向" }],
        api: "openai-completions",
        provider: "bailian",
        model: "qwen3.7-plus",
        usage,
        stopReason: "stop",
        timestamp: Date.now()
      };
      queueMicrotask(() => {
        stream.push({ type: "start", partial: { ...message, content: [] } });
        stream.push({ type: "done", reason: "stop", message });
      });
      return stream;
    });
    const runtime = new PiRuntime({
      apiKey: "test-key",
      baseUrl: "https://example.test/v1",
      model: "qwen3.7-plus",
      streamFn
    });

    await expect(runtime.complete("策划新品视觉")).resolves.toBe("两个方向");
    expect(runtime.capabilities).toEqual({ tools: [], shell: false, filesystem: false });
    expect(streamFn).toHaveBeenCalledOnce();
  });

  it("registers only supplied business tools and forwards Pi lifecycle events", async () => {
    const events: string[] = [];
    const streamFn = vi.fn((_model, context: Context) => {
      expect(context.tools?.map((tool) => tool.name)).toEqual(["get_canvas_context"]);
      const stream = createAssistantMessageEventStream();
      const message: AssistantMessage = {
        role: "assistant",
        content: [{ type: "text", text: "画布摘要" }],
        api: "openai-completions",
        provider: "bailian",
        model: "qwen3.7-plus",
        usage,
        stopReason: "stop",
        timestamp: Date.now()
      };
      queueMicrotask(() => {
        stream.push({ type: "start", partial: { ...message, content: [] } });
        stream.push({
          type: "text_start",
          contentIndex: 0,
          partial: { ...message, content: [{ type: "text", text: "" }] }
        });
        stream.push({
          type: "text_delta",
          contentIndex: 0,
          delta: "画布摘要",
          partial: message
        });
        stream.push({
          type: "text_end",
          contentIndex: 0,
          content: "画布摘要",
          partial: message
        });
        stream.push({ type: "done", reason: "stop", message });
      });
      return stream;
    });
    const runtime = new PiRuntime({
      apiKey: "test-key",
      baseUrl: "https://example.test/v1",
      model: "qwen3.7-plus",
      streamFn,
      sessionId: "session-1",
      tools: [{
        name: "get_canvas_context",
        label: "读取画布上下文",
        description: "读取受限画布摘要",
        parameters: Type.Object({}),
        execute: async () => ({
          content: [{ type: "text", text: "{}" }],
          details: {}
        })
      }],
      onEvent: (event) => {
        events.push(event.type);
      }
    });

    await runtime.complete("读取画布");

    expect(runtime.capabilities.tools).toEqual(["get_canvas_context"]);
    expect(events).toContain("message_update");
    expect(events.at(-1)).toBe("agent_end");
  });

  it("returns a safe visible summary when a terminating tool call has no assistant text", async () => {
    const streamFn = vi.fn(() => {
      const stream = createAssistantMessageEventStream();
      const message: AssistantMessage = {
        role: "assistant",
        content: [{
          type: "toolCall",
          id: "call-1",
          name: "generate_images",
          arguments: { count: 4 }
        }],
        api: "openai-completions",
        provider: "bailian",
        model: "qwen3.7-plus",
        usage,
        stopReason: "toolUse",
        timestamp: Date.now()
      };
      queueMicrotask(() => {
        stream.push({ type: "start", partial: { ...message, content: [] } });
        stream.push({ type: "done", reason: "toolUse", message });
      });
      return stream;
    });
    const runtime = new PiRuntime({
      apiKey: "test-key",
      baseUrl: "https://example.test/v1",
      model: "qwen3.7-plus",
      streamFn,
      tools: [{
        name: "generate_images",
        label: "生成图片",
        description: "创建需确认的图片任务",
        parameters: Type.Object({ count: Type.Number() }),
        execute: async () => ({
          content: [{ type: "text", text: "confirmation_required" }],
          details: { status: "confirmation_required" },
          terminate: true
        })
      }]
    });

    await expect(runtime.complete("生成四张图片")).resolves.toBe("已准备好图片任务，等待你的确认。");
  });
});
