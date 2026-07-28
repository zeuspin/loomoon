import { describe, expect, it } from "vitest";
import {
  buildRemixIntent,
  filterInspirationCases,
  nextRotatingPrompt,
  nextReplayStep,
  shouldRotatePrompt,
} from "./home-state.js";
import type { InspirationCase } from "./mock-content.js";

const cases: InspirationCase[] = [
  {
    id: "a",
    categoryId: "brand",
    title: "A",
    author: { id: "u1", name: "U1", avatarUrl: "" },
    prompt: "提示 A",
    model: "M",
    views: 1,
    likes: 2,
    coverUrl: "",
    results: [
      { id: "r1", name: "R1", imageUrl: "", aspectRatio: 1 },
    ],
    replaySteps: [
      { id: "s1", title: "S1", description: "D1", resultId: "r1" },
    ],
    capability: "mock",
  },
  {
    id: "b",
    categoryId: "poster",
    title: "B",
    author: { id: "u2", name: "U2", avatarUrl: "" },
    prompt: "提示 B",
    model: "M",
    views: 3,
    likes: 4,
    coverUrl: "",
    results: [
      { id: "r2", name: "R2", imageUrl: "", aspectRatio: 0.75 },
    ],
    replaySteps: [
      { id: "s2", title: "S2", description: "D2", resultId: "r2" },
      { id: "s3", title: "S3", description: "D3", resultId: "r2" },
    ],
    capability: "mock",
  },
];

describe("home state", () => {
  it("rotates prompts only while the empty composer is idle", () => {
    expect(
      shouldRotatePrompt({
        focused: false,
        prompt: "",
        reducedMotion: false,
      }),
    ).toBe(true);
    expect(
      shouldRotatePrompt({
        focused: true,
        prompt: "",
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(
      shouldRotatePrompt({
        focused: false,
        prompt: "已有输入",
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(
      shouldRotatePrompt({
        focused: false,
        prompt: "",
        reducedMotion: true,
      }),
    ).toBe(false);
  });

  it("wraps the rotating prompt index", () => {
    expect(nextRotatingPrompt(0, 3)).toBe(1);
    expect(nextRotatingPrompt(2, 3)).toBe(0);
    expect(nextRotatingPrompt(0, 0)).toBe(0);
  });

  it("filters inspiration cases by category", () => {
    expect(filterInspirationCases(cases, "all")).toEqual(cases);
    expect(filterInspirationCases(cases, "poster").map((item) => item.id)).toEqual([
      "b",
    ]);
  });

  it("advances replay steps and stops on the final step", () => {
    expect(nextReplayStep(0, 2)).toBe(1);
    expect(nextReplayStep(1, 2)).toBe(1);
  });

  it("builds a remix intent from the selected case", () => {
    expect(buildRemixIntent(cases[0]!)).toEqual({
      kind: "submit-prompt",
      prompt: "提示 A",
      referenceCaseId: "a",
    });
  });
});
