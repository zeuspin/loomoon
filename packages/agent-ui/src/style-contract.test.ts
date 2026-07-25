import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("./styles.css", import.meta.url)),
  "utf8",
);

describe("Agent sidebar layout contract", () => {
  test("keeps the composer outside the scrolling message viewport", () => {
    expect(css).toMatch(
      /\.lm-agent-thread\{[^}]*display:grid[^}]*grid-template-rows:minmax\(0,1fr\) auto/,
    );
    expect(css).toMatch(
      /\.lm-agent-viewport\{[^}]*min-height:0[^}]*overflow-y:auto/,
    );
    expect(css).toMatch(
      /\.lm-agent-composer\{[^}]*position:relative[^}]*z-index:1/,
    );
  });

  test("styles Agent content and user bubbles as separate visual roles", () => {
    expect(css).toContain(".lm-agent-message-row--assistant");
    expect(css).toContain(".lm-agent-avatar");
    expect(css).toContain(".lm-agent-author");
    expect(css).toContain(".lm-agent-message-row--user");
  });
});
