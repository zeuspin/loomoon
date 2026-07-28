import { describe, expect, it } from "vitest";
import { BailianClient, BailianProviderError } from "./client.js";

describe("BailianClient image generation", () => {
  it("maps the selected model and dimensions into the provider request", async () => {
    let requestBody: unknown;
    const client = new BailianClient({
      apiKey: "sk-test",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      agentModel: "qwen-test",
      imageModel: "wan-default",
      fetchImpl: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          request_id: "request-1",
          output: { choices: [{ message: { content: [{ image: "https://example.com/result.png" }] } }] },
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });

    const result = await client.generateImage(
      "一只白猫",
      ["data:image/png;base64,AA=="],
      { modelId: "qwen-image-pro", width: 1024, height: 1536, quality: "high", seed: 73921 },
    );

    expect(requestBody).toMatchObject({
      model: "qwen-image-pro",
      parameters: { size: "1024*1536", n: 1, watermark: false, quality: "high", seed: 73921 },
    });
    expect(result).toMatchObject({ model: "qwen-image-pro", requestId: "request-1" });
  });

  it("preserves the provider code, message, and request ID on failed requests", async () => {
    const client = new BailianClient({
      apiKey: "sk-test",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      agentModel: "qwen-test",
      imageModel: "wan-default",
      fetchImpl: async () => new Response(JSON.stringify({
        code: "InvalidParameter",
        message: "size is not supported for this request",
        request_id: "request-failed-1",
      }), { status: 400, headers: { "content-type": "application/json" } }),
    });

    await expect(client.generateImage("白猫")).rejects.toEqual(expect.objectContaining({
      name: "BailianProviderError",
      code: "BAILIAN_INVALID_RESPONSE",
      providerCode: "InvalidParameter",
      providerMessage: "size is not supported for this request",
      requestId: "request-failed-1",
    } satisfies Partial<BailianProviderError>));
  });

  it("identifies a successful HTTP response that contains no image", async () => {
    const client = new BailianClient({
      apiKey: "sk-test",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      agentModel: "qwen-test",
      imageModel: "wan-default",
      fetchImpl: async () => new Response(JSON.stringify({
        request_id: "request-empty-1",
        output: { choices: [{ message: { content: [{ text: "unable to generate" }] } }] },
      }), { status: 200, headers: { "content-type": "application/json" } }),
    });

    await expect(client.generateImage("白猫")).rejects.toEqual(expect.objectContaining({
      code: "BAILIAN_INVALID_RESPONSE",
      providerCode: "EMPTY_IMAGE_RESULT",
      providerMessage: "响应中没有图片内容",
      requestId: "request-empty-1",
    } satisfies Partial<BailianProviderError>));
  });
});
