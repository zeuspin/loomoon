import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DemoProvider } from "./demo-service.js";
import { ProjectRegistry } from "./project-registry.js";

const provider: DemoProvider = {
  async createPlan() {
    throw new Error("not needed");
  },
  async analyzeImages() {
    throw new Error("not needed");
  },
  async generateImage() {
    throw new Error("not needed");
  }
};

describe("ProjectRegistry", () => {
  it("creates, renames, lists, resolves, and deletes isolated user projects", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-projects-"));
    const registry = new ProjectRegistry(root, provider, async (_userId, url) => url);
    const first = await registry.create("user-a", "品牌视觉");
    const second = await registry.create("user-a", "社媒广告");
    await registry.create("user-b", "其他用户项目");

    expect(await registry.list("user-a")).toHaveLength(2);
    expect(await registry.list("user-b")).toHaveLength(1);
    await registry.rename("user-a", first.id, "品牌视觉 2026");
    expect((await registry.resolve("user-a", first.id)).name).toBe("品牌视觉 2026");
    await expect(registry.resolve("user-b", first.id)).rejects.toThrow("PROJECT_NOT_FOUND");

    await registry.delete("user-a", second.id);
    expect(await registry.list("user-a")).toHaveLength(1);
  });
});
