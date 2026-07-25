import { PiRuntime } from "@loomoon/agent-runtime";
import type { CanvasIntent } from "@loomoon/agent-runtime";
import { extractImageUrls, parseJsonObject } from "./response.js";

interface BailianClientOptions {
  apiKey: string;
  baseUrl: string;
  agentModel: string;
  imageModel: string;
  fetchImpl?: typeof fetch;
}

export interface PlanDraft {
  summary: string;
  audience: string;
  directions: Array<{
    title: string;
    style: string;
    composition: string;
    palette: string;
    prompt: string;
  }>;
  providerRequestId?: string;
  resolvedModel?: string;
}

export interface GeneratedImage {
  url: string;
  requestId?: string;
  model: string;
}

export class BailianClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #imageModel: string;
  readonly #fetch: typeof fetch;
  readonly #agent: PiRuntime;

  constructor(options: BailianClientOptions) {
    this.#apiKey = options.apiKey;
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    this.#imageModel = options.imageModel;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#agent = new PiRuntime({
      apiKey: options.apiKey,
      baseUrl: this.#baseUrl,
      model: options.agentModel,
      systemPrompt:
        "你是 Loomoon 的视觉创意总监 Agent。你只能处理视觉策划、图片分析和图片编辑意图，不具备 Shell、文件系统或任意网络工具。"
    });
  }

  async createPlan(brief: string, imageDataUrls: string[] = []): Promise<PlanDraft> {
    let content: string;
    let responseId: string | undefined;
    let resolvedModel: string | undefined;
    try {
      const completion = await this.#agent.completeWithTrace(
        [
          "请根据下面需求输出视觉方案。",
          "只输出一个 JSON 对象，不要 Markdown。",
          "字段必须是 summary、audience、directions；directions 必须恰好两个。",
          "每个 direction 必须包含 title、style、composition、palette、prompt，prompt 可直接用于高质量广告图生成。",
          `用户需求：${brief}`
        ].join("\n"),
        imageDataUrls
      );
      content = completion.text;
      responseId = completion.responseId;
      resolvedModel = completion.model;
    } catch (error) {
      throw normalizeProviderError(error);
    }
    try {
      return {
        ...parsePlanDraft(content),
        ...(responseId ? { providerRequestId: responseId } : {}),
        ...(resolvedModel ? { resolvedModel } : {})
      };
    } catch {
      try {
        const corrected = await this.#agent.completeWithTrace(
          [
            "请把下面内容纠正为合法 JSON，只输出 JSON 对象。",
            "必须包含 summary、audience、directions，directions 必须恰好两个；每个方向包含 title、style、composition、palette、prompt。",
            content
          ].join("\n")
        );
        return {
          ...parsePlanDraft(corrected.text),
          ...(corrected.responseId ? { providerRequestId: corrected.responseId } : {}),
          resolvedModel: corrected.model
        };
      } catch (error) {
        throw normalizeProviderError(error);
      }
    }
  }

  async analyzeImages(instruction: string, imageDataUrls: string[]): Promise<string> {
    try {
      return await this.#agent.complete(instruction, imageDataUrls);
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }

  async decideImageIntent(instruction: string, selectedImageCount: number): Promise<CanvasIntent> {
    try {
      const content = await this.#agent.complete([
        "判断用户对已选图片的操作意图，只输出 JSON。",
        'intent 只能是 "analyze"、"edit"、"reference" 或 "clarify"。',
        "比较、推荐、总结属于 analyze；逐张修改属于 edit；把多图作为构图/颜色/材质参考并生成新图属于 reference；范围不明确属于 clarify。",
        `选中图片数：${selectedImageCount}`,
        `用户指令：${instruction}`
      ].join("\n"));
      const parsed = parseJsonObject(content);
      const intent = parsed.intent;
      if (intent === "analyze" || intent === "edit" || intent === "reference" || intent === "clarify") {
        return intent;
      }
      return "clarify";
    } catch {
      return "clarify";
    }
  }

  async generateImage(prompt: string, imageDataUrls: string[] = [], bboxList?: number[][][]): Promise<GeneratedImage> {
    const generationBase = this.#baseUrl.replace(/\/compatible-mode\/v1$/, "");
    const body: Record<string, unknown> = {
      model: this.#imageModel,
      input: {
        messages: [
          {
            role: "user",
            content: [
              ...imageDataUrls.map((image) => ({ image })),
              { text: prompt }
            ]
          }
        ]
      },
      parameters: {
        size: "2K",
        n: 1,
        watermark: false,
        ...(bboxList ? { bbox_list: bboxList } : {})
      }
    };
    const response = await this.#request(
      `${generationBase}/api/v1/services/aigc/multimodal-generation/generation`,
      body
    );
    const [url] = extractImageUrls(response);
    if (!url) throw new Error("BAILIAN_INVALID_RESPONSE");
    const requestId =
      response && typeof response === "object" && "request_id" in response
        ? String((response as { request_id: unknown }).request_id)
        : undefined;
    return {
      url,
      model: this.#imageModel,
      ...(requestId ? { requestId } : {})
    };
  }

  async #request(url: string, body: unknown): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await this.#fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.#apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(120_000)
        });
        const payload: unknown = await response.json();
        if (response.ok) return payload;
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await delay(500 * 2 ** attempt);
          continue;
        }
        const requestId =
          payload && typeof payload === "object" && "request_id" in payload
            ? String((payload as { request_id: unknown }).request_id)
            : "unknown";
        const code =
          response.status === 401 || response.status === 403
            ? "BAILIAN_AUTH_ERROR"
            : response.status === 429
              ? "BAILIAN_RATE_LIMITED"
              : response.status >= 500
                ? "BAILIAN_UNAVAILABLE"
                : "BAILIAN_INVALID_RESPONSE";
        throw new Error(`${code}:${requestId}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("BAILIAN_")) throw error;
        if (attempt < 2) {
          await delay(500 * 2 ** attempt);
          continue;
        }
        throw normalizeProviderError(error);
      }
    }
    throw new Error("BAILIAN_UNAVAILABLE");
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parsePlanDraft(content: string): PlanDraft {
  const parsed = parseJsonObject(content);
  const directions = Array.isArray(parsed.directions) ? parsed.directions : [];
  if (directions.length !== 2) throw new Error("Agent plan must contain exactly two directions");
  return parsed as unknown as PlanDraft;
}

function normalizeProviderError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  if (/401|403|unauthori|api.?key/i.test(message)) return new Error("BAILIAN_AUTH_ERROR");
  if (/429|rate.?limit|too many/i.test(message)) return new Error("BAILIAN_RATE_LIMITED");
  if (/timeout|timed out|abort/i.test(message)) return new Error("BAILIAN_TIMEOUT");
  if (/json|direction|response|content/i.test(message)) return new Error("BAILIAN_INVALID_RESPONSE");
  return new Error("BAILIAN_UNAVAILABLE");
}
