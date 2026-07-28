import { describe, expect, it } from "vitest";

import { canvasTheme, serializePanelState } from "./token-contract";

describe("theme and panel contracts", () => {
  it("does not serialize transient panel state", () => {
    const panel = {
      placement: { kind: "docked" as const, edge: "left" as const, offset: 80, size: 320 },
      visibility: "peek" as const,
      persistence: "auto" as const,
      interaction: {
        kind: "dragging" as const,
        origin: { kind: "floating" as const, x: 0, y: 80, width: 320, height: 500 },
      },
    };
    expect(serializePanelState(panel)).toEqual({
      placement: panel.placement,
      visibility: "collapsed",
      persistence: "auto",
    });
  });

  it("exposes numeric Konva theme values", () => {
    document.documentElement.style.setProperty("--canvas-selection-stroke-width", "2");
    document.documentElement.style.setProperty("--motion-panel-duration-ms", "210");
    expect(canvasTheme()).toMatchObject({ selectionStrokeWidth: 2, panelDurationMs: 210 });
  });
});
