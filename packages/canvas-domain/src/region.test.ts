import { describe, expect, it } from "vitest";
import { displayRectToImageBbox } from "./region.js";

describe("displayRectToImageBbox", () => {
  it("maps a displayed selection to original image pixels and clips overflow", () => {
    expect(
      displayRectToImageBbox(
        { x: 50, y: 25, width: 100, height: 50 },
        { width: 200, height: 100 },
        { width: 2000, height: 1000 }
      )
    ).toEqual([500, 250, 1500, 750]);

    expect(
      displayRectToImageBbox(
        { x: -20, y: -10, width: 260, height: 140 },
        { width: 200, height: 100 },
        { width: 2000, height: 1000 }
      )
    ).toEqual([0, 0, 2000, 1000]);
  });

  it("rejects an empty selection", () => {
    expect(() =>
      displayRectToImageBbox(
        { x: 20, y: 20, width: 0, height: 10 },
        { width: 200, height: 100 },
        { width: 2000, height: 1000 }
      )
    ).toThrow("EMPTY_REGION");
  });
});
