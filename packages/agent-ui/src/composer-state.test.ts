import { describe, expect, it } from "vitest";
import {
  availableModels,
  filterConversationHistory,
  modelForMode,
} from "./composer-state.js";

describe("Agent composer preferences", () => {
  it("provides mode-specific models", () => {
    expect(modelForMode(availableModels, "image").every((item) => item.mode === "image")).toBe(true);
    expect(modelForMode(availableModels, "video").every((item) => item.mode === "video")).toBe(true);
  });

  it("filters conversation history by title", () => {
    expect(
      filterConversationHistory(
        [{ id: "1", title: "夏日气泡水" }, { id: "2", title: "品牌海报" }],
        "海报",
      ),
    ).toEqual([{ id: "2", title: "品牌海报" }]);
  });
});
