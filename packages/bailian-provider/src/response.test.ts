import { describe, expect, it } from "vitest";
import { extractImageUrls, parseJsonObject } from "./response.js";

describe("extractImageUrls", () => {
  it("extracts image outputs from DashScope multimodal choices", () => {
    const urls = extractImageUrls({
      output: {
        choices: [
          { message: { content: [{ type: "image", image: "https://example.com/a.png" }] } }
        ]
      }
    });

    expect(urls).toEqual(["https://example.com/a.png"]);
  });
});

describe("parseJsonObject", () => {
  it("accepts JSON wrapped in a markdown fence", () => {
    expect(parseJsonObject("```json\n{\"summary\":\"ok\"}\n```")).toEqual({ summary: "ok" });
  });
});
