import { describe, expect, it } from "vitest";
import { MockBailianProvider } from "./mock.js";

describe("MockBailianProvider", () => {
  it("isolates a configured failure when image requests run concurrently", async () => {
    const provider = new MockBailianProvider({ delayMs: 1, failAt: [2] });

    const results = await Promise.allSettled([
      provider.generateImage(),
      provider.generateImage()
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(results[0]).toMatchObject({
      status: "fulfilled",
      value: { requestId: "mock-request-1" }
    });
  });
});
