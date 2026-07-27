import { describe, expect, it } from "vitest";
import type { ProjectSummary } from "./api.js";
import {
  filterProjects,
  sortProjects,
  summarizeProfileCases,
} from "./library-state.js";

const projects: ProjectSummary[] = [
  {
    id: "older",
    name: "品牌手册",
    status: "ready",
    updatedAt: "2026-07-20T00:00:00.000Z",
  },
  {
    id: "newer",
    name: "夏日海报",
    status: "planning",
    updatedAt: "2026-07-25T00:00:00.000Z",
  },
];

describe("project library state", () => {
  it("sorts recently updated projects first without mutating input", () => {
    expect(sortProjects(projects).map((item) => item.id)).toEqual([
      "newer",
      "older",
    ]);
    expect(projects[0]?.id).toBe("older");
  });

  it("filters project names case-insensitively", () => {
    expect(filterProjects(projects, "夏日").map((item) => item.id)).toEqual([
      "newer",
    ]);
    expect(filterProjects(projects, "  ").length).toBe(2);
  });
});

describe("profile case summary", () => {
  it("returns published and liked cases in repository order", () => {
    const cases = [
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ];
    expect(
      summarizeProfileCases(cases, ["c", "a"], ["b"]),
    ).toEqual({
      published: [{ id: "a" }, { id: "c" }],
      liked: [{ id: "b" }],
    });
  });
});
