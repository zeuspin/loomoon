import { describe, expect, test } from "vitest";
import { canvasThemeTokens, resolveTheme } from "./index.js";

describe("design token contract", () => {
  test("keeps the agreed corner radius scale", () => {
    expect(canvasThemeTokens.radius).toEqual({
      control: 2,
      container: 4,
      media: 4,
    });
  });

  test("resolves explicit and system theme preferences", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  test("keeps editor chrome separate from document content", () => {
    expect(canvasThemeTokens.light).not.toHaveProperty("document");
    expect(canvasThemeTokens.dark).not.toHaveProperty("document");
    expect(canvasThemeTokens.light.selection).toBe(
      canvasThemeTokens.dark.selection,
    );
  });
});
