import {
  Agent,
  type AgentEvent,
  type AgentTool,
  type StreamFn
} from "@earendil-works/pi-agent-core";
import type { ImageContent, Model } from "@earendil-works/pi-ai";
import { streamSimple as streamOpenAICompatible } from "@earendil-works/pi-ai/api/openai-completions";

export interface PiRuntimeOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt?: string;
  streamFn?: StreamFn;
  sessionId?: string;
  tools?: AgentTool[];
  onEvent?: (event: AgentEvent) => void | Promise<void>;
}

export class PiRuntime {
  readonly #apiKey: string;
  readonly #systemPrompt: string;
  readonly #streamFn: StreamFn;
  readonly #model: Model<"openai-completions">;
  readonly #sessionId: string | undefined;
  readonly #tools: AgentTool[];
  readonly #onEvent: ((event: AgentEvent) => void | Promise<void>) | undefined;

  constructor(options: PiRuntimeOptions) {
    this.#apiKey = options.apiKey;
    this.#systemPrompt = options.systemPrompt ?? "你是 Loomoon 视觉创意 Agent。";
    this.#streamFn = options.streamFn ?? ((model, context, streamOptions) =>
      streamOpenAICompatible(model as Model<"openai-completions">, context, streamOptions));
    this.#sessionId = options.sessionId;
    this.#tools = [...(options.tools ?? [])];
    this.#onEvent = options.onEvent;
    this.#model = {
      id: options.model,
      name: options.model,
      api: "openai-completions",
      provider: "bailian",
      baseUrl: options.baseUrl.replace(/\/$/, ""),
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 131_072,
      maxTokens: 8_192
    };
  }

  get capabilities(): Readonly<{ tools: readonly string[]; shell: false; filesystem: false }> {
    return {
      tools: this.#tools.map((tool) => tool.name),
      shell: false,
      filesystem: false
    };
  }

  async complete(prompt: string, imageDataUrls: string[] = []): Promise<string> {
    return (await this.completeWithTrace(prompt, imageDataUrls)).text;
  }

  async completeWithTrace(
    prompt: string,
    imageDataUrls: string[] = []
  ): Promise<{ text: string; responseId?: string; model: string }> {
    const agent = new Agent({
      initialState: {
        systemPrompt: this.#systemPrompt,
        model: this.#model,
        tools: [...this.#tools]
      },
      streamFn: this.#streamFn,
      getApiKey: (provider) => provider === "bailian" ? this.#apiKey : undefined,
      toolExecution: "parallel",
      ...(this.#sessionId ? { sessionId: this.#sessionId } : {})
    });
    if (this.#onEvent) agent.subscribe(this.#onEvent);
    const images = imageDataUrls.map(toImageContent);
    await agent.prompt(prompt, images);
    const assistant = [...agent.state.messages].reverse().find((message) => message.role === "assistant");
    if (!assistant || assistant.role !== "assistant") throw new Error("Pi Agent returned no assistant message");
    if (assistant.stopReason === "error" || assistant.stopReason === "aborted") {
      throw new Error(assistant.errorMessage ?? "Pi Agent request failed");
    }
    const text = assistant.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("");
    const hasToolCall = assistant.content.some((item) => item.type === "toolCall");
    if (!text && !hasToolCall) throw new Error("Pi Agent returned no text");
    return {
      text: text || "已准备好图片任务，等待你的确认。",
      model: assistant.responseModel ?? assistant.model,
      ...(assistant.responseId ? { responseId: assistant.responseId } : {})
    };
  }
}

function toImageContent(dataUrl: string): ImageContent {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match?.[1] || !match[2]) throw new Error("Reference image must be a base64 data URL");
  return { type: "image", mimeType: match[1], data: match[2] };
}
