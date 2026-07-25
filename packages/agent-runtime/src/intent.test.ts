import { describe, expect, it } from "vitest";
import { classifyCanvasIntent } from "./intent.js";

describe("classifyCanvasIntent", () => {
  it("creates a plan when there is no selected image", () => {
    expect(classifyCanvasIntent("做一组新品广告", 0)).toBe("create_plan");
  });

  it("analyzes selected images without a paid action for comparison requests", () => {
    expect(classifyCanvasIntent("比较这四张，推荐一张做主视觉", 4)).toBe("analyze");
  });

  it("proposes a paid edit when selected images are explicitly modified", () => {
    expect(classifyCanvasIntent("把这两张的背景都改成夜间音乐节", 2)).toBe("edit");
  });

  it("requires clarification when a multi-image edit does not define its scope", () => {
    expect(classifyCanvasIntent("把背景改成夜晚", 3)).toBe("clarify");
  });

  it("recognizes multi-image reference generation as one fusion intent", () => {
    expect(classifyCanvasIntent("第一张做主图，其余图片分别作为构图和材质参考，融合生成新图", 3)).toBe("reference");
  });
});
