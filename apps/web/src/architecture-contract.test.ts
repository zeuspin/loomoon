import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const webSourceDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(webSourceDirectory, "../../..");
const forbiddenBusinessImports = [
  "@base-ui/react",
  "class-variance-authority",
  "@assistant-ui/",
];
const visualLiteralPattern = /#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\(/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

describe("frontend architecture contract", () => {
  test("keeps headless libraries behind Loomoon packages", () => {
    const violations = sourceFiles(webSourceDirectory).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return forbiddenBusinessImports
        .filter((dependency) => source.includes(`from "${dependency}`))
        .map((dependency) => `${path}: ${dependency}`);
    });

    expect(violations).toEqual([]);
  });

  test("keeps shared UI components free of literal colors", () => {
    const uiSource = join(workspaceRoot, "packages/ui/src");
    const violations = readdirSync(uiSource)
      .filter((name) => name.endsWith(".css"))
      .flatMap((name) => {
        const matches = readFileSync(join(uiSource, name), "utf8").match(
          visualLiteralPattern,
        );
        return matches?.map((match) => `${name}: ${match}`) ?? [];
      });

    expect(violations).toEqual([]);
  });

  test("prevents the legacy canvas file from gaining visual literals", () => {
    const appSource = readFileSync(join(webSourceDirectory, "app.tsx"), "utf8");
    const currentCount = appSource.match(visualLiteralPattern)?.length ?? 0;

    expect(currentCount).toBeLessThanOrEqual(6);
  });
});
