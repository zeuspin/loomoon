import { describe, expect, test } from "vitest";
import {
  createCanvasTheme,
  initialThemePreference,
  normalizeThemePreference,
  resolveThemePreference,
} from "./theme";

describe("web theme contract", () => {
  test("normalizes persisted values", () => {
    expect(normalizeThemePreference("dark")).toBe("dark");
    expect(normalizeThemePreference("unexpected")).toBe("light");
    expect(normalizeThemePreference(null)).toBe("light");
  });

  test("keeps the current Demo on light even when an old preference exists", () => {
    expect(initialThemePreference("dark", false)).toBe("light");
    expect(initialThemePreference("system", false)).toBe("light");
    expect(initialThemePreference("dark", true)).toBe("dark");
  });

  test("resolves system preference deterministically", () => {
    expect(resolveThemePreference("system", true)).toBe("dark");
    expect(resolveThemePreference("system", false)).toBe("light");
  });

  test("creates editor-only canvas theme values", () => {
    expect(createCanvasTheme("light")).toMatchObject({
      radius: { media: 4 },
      selection: "#6456e8",
    });
    expect(createCanvasTheme("dark")).not.toHaveProperty("document");
  });
});
