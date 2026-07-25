import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const styleFiles = readdirSync(sourceDirectory)
  .filter((fileName) => fileName.endsWith(".css"))
  .sort();
const flatStyleSource = readFileSync(join(sourceDirectory, "flat.css"), "utf8");

describe("flat visual style contract", () => {
  test("keeps non-circular corner radii at four pixels or less", () => {
    const violations: string[] = [];

    const declarations = flatStyleSource.matchAll(
      /border-radius\s*:\s*([^;}\n]+)/g,
    );

    for (const declaration of declarations) {
      const value = (declaration[1] ?? "").trim();
      if (
        value === "50% !important" ||
        value.includes("--flat-radius-control") ||
        value.includes("--flat-radius-container")
      ) {
        continue;
      }

      const pixelValues = [...value.matchAll(/([\d.]+)px/g)].map((match) =>
        Number(match[1]),
      );
      if (pixelValues.some((pixelValue) => pixelValue > 4)) {
        violations.push(`flat.css: ${value}`);
      }
    }

    expect(violations).toEqual([]);
    expect(flatStyleSource).toContain("--flat-radius-control: 2px");
    expect(flatStyleSource).toContain("--flat-radius-container: 4px");
  });

  test("does not use decorative gradients", () => {
    expect(flatStyleSource).not.toMatch(
      /(?:linear|radial|conic)-gradient\(/,
    );
    expect(flatStyleSource).toContain("background-image: none !important");
  });

  test("loads the visual policy after every component stylesheet", () => {
    const mainSource = readFileSync(join(sourceDirectory, "main.tsx"), "utf8");
    const imports = [
      ...mainSource.matchAll(/import\s+"\.\/([^"]+\.css)";/g),
    ].map((match) => match[1]);

    expect(imports.at(-1)).toBe("flat.css");
    expect(styleFiles).toContain("flat.css");
  });

  test("keeps Konva canvas nodes within the same corner radius scale", () => {
    const appSource = readFileSync(join(sourceDirectory, "app.tsx"), "utf8");
    const radii = [...appSource.matchAll(/cornerRadius=\{(\d+)\}/g)].map(
      (match) => Number(match[1]),
    );

    expect(radii.every((radius) => radius <= 4)).toBe(true);
    expect(appSource).toContain("canvasTheme.radius.media");
    expect(appSource).toContain("canvasTheme.selection");
  });
});
