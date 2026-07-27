import { describe, expect, it } from "vitest";
import { mockContentRepository } from "./mock-content.js";

describe("mock content repository", () => {
  it("provides populated inspiration categories with replayable cases", () => {
    const categories = mockContentRepository.listInspirationCategories();
    const cases = mockContentRepository.listInspirationCases();

    expect(categories[0]?.id).toBe("all");
    expect(categories.length).toBeGreaterThanOrEqual(9);
    expect(cases.length).toBeGreaterThanOrEqual(8);
    for (const item of cases) {
      expect(item.results.length).toBeGreaterThan(0);
      expect(item.replaySteps.length).toBeGreaterThan(0);
      expect(item.capability).toBe("mock");
    }
  });

  it("provides the four approved membership plans", () => {
    expect(
      mockContentRepository
        .listMembershipPlans()
        .map((plan) => plan.name),
    ).toEqual(["入门版", "基础版", "专业版", "旗舰版"]);
  });

  it("marks unsupported writes and model capabilities as mock", () => {
    const profile = mockContentRepository.getProfile();
    const capabilities = mockContentRepository.getCapabilities();

    expect(profile.capability).toBe("mock");
    expect(capabilities.videoGeneration).toBe("mock");
    expect(capabilities.onlineResearch).toBe("mock");
    expect(capabilities.imageGeneration).toBe("real");
  });
});
