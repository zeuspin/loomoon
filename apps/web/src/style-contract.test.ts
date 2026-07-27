import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const styleFiles = readdirSync(sourceDirectory)
  .filter((fileName) => fileName.endsWith(".css"))
  .sort();
const flatStyleSource = readFileSync(join(sourceDirectory, "flat.css"), "utf8");
const enhancementStyleSource = readFileSync(join(sourceDirectory, "enhancements.css"), "utf8");

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

  test("keeps image generator settings compact and free from footer button inheritance", () => {
    expect(enhancementStyleSource).toContain(".canvas-image-settings{max-height:min(520px,calc(100vh - 96px))");
    expect(enhancementStyleSource).toContain("width:440px");
    expect(enhancementStyleSource).toContain(".canvas-generator-card footer>.canvas-generator-submit");
    expect(enhancementStyleSource).toContain(".canvas-image-quality button{background:#fff!important");
  });

  test("allows image settings to close from outside clicks and Escape", () => {
    const overlaySource = readFileSync(join(sourceDirectory, "generator-overlay.tsx"), "utf8");
    expect(overlaySource).toContain('document.addEventListener("pointerdown"');
    expect(overlaySource).toContain('event.key === "Escape"');
  });

  test("does not clip the reference upload menu inside the thumbnail scroller", () => {
    expect(enhancementStyleSource).toContain(".canvas-generator-reference-row{align-items:center;display:flex;gap:8px;overflow:visible");
    expect(enhancementStyleSource).toContain(".canvas-generator-references{display:flex;flex:1 1 auto;gap:8px;overflow-x:auto");
  });

  test("keeps reference controls adjacent and their actions visible", () => {
    expect(enhancementStyleSource).toContain(".canvas-generator-references{display:flex;flex:0 1 auto;gap:8px;max-width:calc(100% - 80px);overflow-x:auto;padding:8px 8px 2px}");
    expect(enhancementStyleSource).toContain(".canvas-generator-submit span{color:#fff!important");
  });
});
