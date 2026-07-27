import type { DeferredIntent } from "./deferred-intent.js";
import type { InspirationCase } from "./mock-content.js";

export function shouldRotatePrompt(input: {
  focused: boolean;
  prompt: string;
  reducedMotion: boolean;
}): boolean {
  return !input.focused && !input.prompt && !input.reducedMotion;
}

export function nextRotatingPrompt(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}

export function filterInspirationCases(
  cases: InspirationCase[],
  categoryId: string,
): InspirationCase[] {
  if (categoryId === "all") return cases;
  return cases.filter((item) => item.categoryId === categoryId);
}

export function nextReplayStep(current: number, total: number): number {
  return Math.min(Math.max(0, total - 1), current + 1);
}

export function buildRemixIntent(item: InspirationCase): DeferredIntent {
  return {
    kind: "submit-prompt",
    prompt: item.prompt,
    referenceCaseId: item.id,
  };
}
