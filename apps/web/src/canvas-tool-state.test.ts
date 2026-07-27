import { describe, expect, it } from "vitest";
import {
  activateCanvasTool,
  canNodeReceivePointer,
  keyboardIsOwnedByEditor,
  temporaryHandDown,
  temporaryHandUp,
  toolAfterCreation,
  type ToolState,
} from "./canvas-tool-state.js";

describe("Canvas tool ownership", () => {
  it("prevents hand and draw modes from delegating pointer events to image nodes", () => {
    expect(canNodeReceivePointer("select")).toBe(true);
    expect(canNodeReceivePointer("text")).toBe(true);
    expect(canNodeReceivePointer("hand")).toBe(false);
    expect(canNodeReceivePointer("draw")).toBe(false);
    expect(canNodeReceivePointer("shape")).toBe(false);
  });

  it("keeps exactly one active tool after an explicit transition", () => {
    const initial: ToolState = { active: "select" };

    expect(activateCanvasTool(initial, "draw")).toEqual({ active: "draw" });
    expect(activateCanvasTool({ active: "draw", suspended: "select" }, "hand")).toEqual({ active: "hand" });
  });

  it("temporarily activates hand and restores the prior tool", () => {
    const hand = temporaryHandDown({ active: "draw" }, false);

    expect(hand).toEqual({ active: "hand", suspended: "draw" });
    expect(temporaryHandUp(hand)).toEqual({ active: "draw" });
  });

  it("does not activate temporary hand while form or text input owns the keyboard", () => {
    expect(temporaryHandDown({ active: "draw" }, true)).toEqual({ active: "draw" });
  });

  it("gives IME composition exclusive keyboard ownership even when the target is retargeted", () => {
    expect(keyboardIsOwnedByEditor(null, true)).toBe(true);
  });

  it("returns creation tools to select after creating one object", () => {
    expect(toolAfterCreation("shape")).toBe("select");
    expect(toolAfterCreation("text")).toBe("select");
    expect(toolAfterCreation("image-generator")).toBe("select");
    expect(toolAfterCreation("draw")).toBe("draw");
  });
});
