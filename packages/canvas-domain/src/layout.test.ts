import { describe, expect, it } from "vitest";
import { layoutCreativePlan, placeDerivedImages } from "./layout.js";

describe("layoutCreativePlan", () => {
  it("creates one brief, two direction labels, and four non-overlapping placeholders", () => {
    const nodes = layoutCreativePlan({
      brief: "青柠气泡水社媒广告",
      directions: [
        { id: "a", title: "清爽自然" },
        { id: "b", title: "霓虹派对" }
      ]
    });

    expect(nodes).toHaveLength(7);
    expect(nodes.filter((node) => node.type === "generation-placeholder")).toHaveLength(4);
    expect(new Set(nodes.map((node) => `${node.x}:${node.y}`)).size).toBe(7);
  });

  it("places a new plan below existing canvas content", () => {
    const nodes = layoutCreativePlan({
      id: "plan",
      brief: "青柠气泡水社媒广告",
      directions: [
        { id: "a", title: "清爽自然" },
        { id: "b", title: "霓虹派对" }
      ]
    }, [{
      id: "reference",
      type: "image",
      x: 80,
      y: 500,
      width: 300,
      height: 300
    }]);

    expect(Math.min(...nodes.map((node) => node.y))).toBeGreaterThan(800);
    expect(nodes.every((node) => node.planId === "plan")).toBe(true);
  });
});

describe("placeDerivedImages", () => {
  it("places results beside their sources without overwriting source positions", () => {
    const nodes = placeDerivedImages([
      { id: "one", x: 120, y: 200, width: 320, height: 320 },
      { id: "two", x: 120, y: 560, width: 320, height: 320 }
    ]);

    expect(nodes[0]?.x).toBeGreaterThan(440);
    expect(nodes[1]?.x).toBeGreaterThan(440);
    expect(nodes[0]?.sourceNodeIds).toEqual(["one"]);
    expect(nodes[1]?.sourceNodeIds).toEqual(["two"]);
  });
});
