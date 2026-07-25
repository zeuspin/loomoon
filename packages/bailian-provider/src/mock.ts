import type { PlanDraft } from "./client.js";

const onePixelPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export class MockBailianProvider {
  readonly delayMs: number;
  readonly failAt: Set<number>;
  #generationCount = 0;

  constructor(options: { delayMs?: number; failAt?: number[] } = {}) {
    this.delayMs = options.delayMs ?? 10;
    this.failAt = new Set(options.failAt ?? []);
  }

  async createPlan(brief: string): Promise<PlanDraft> {
    await delay(this.delayMs);
    return {
      summary: `围绕“${brief.slice(0, 40)}”建立可执行的社交媒体视觉`,
      audience: "目标消费人群",
      resolvedModel: "mock-qwen",
      directions: [
        {
          title: "清爽商业摄影",
          style: "通透、高级、自然",
          composition: "产品英雄位，标题留白",
          palette: "青柠绿与银白",
          prompt: `${brief}，通透商业摄影，产品英雄镜头`
        },
        {
          title: "未来霓虹",
          style: "活力、年轻、未来感",
          composition: "低机位主体，几何光效",
          palette: "荧光绿与深紫",
          prompt: `${brief}，未来霓虹广告，几何光效`
        }
      ]
    };
  }

  async analyzeImages(): Promise<string> {
    await delay(this.delayMs);
    return "Mock 分析完成：第一张主体更明确，第二张色彩更适合作为参考。";
  }

  async generateImage(): Promise<{ url: string; requestId: string; model: string }> {
    this.#generationCount += 1;
    const generationIndex = this.#generationCount;
    await delay(this.delayMs);
    if (this.failAt.has(generationIndex)) throw new Error("BAILIAN_UNAVAILABLE");
    return {
      url: onePixelPng,
      requestId: `mock-request-${generationIndex}`,
      model: "mock-wan"
    };
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
