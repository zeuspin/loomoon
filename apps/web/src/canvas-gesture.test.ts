import { describe, expect, it } from "vitest";
import {
  beginCanvasTouch,
  beginTwoPointerNavigation,
  cancelCanvasTouch,
  createCameraFrameBatcher,
  endCanvasTouch,
  idleCanvasTouchGesture,
  moveCanvasTouch,
  updateTwoPointerNavigation,
  wheelCameraChange,
} from "./canvas-gesture.js";

describe("two-pointer canvas navigation", () => {
  it("tracks a same-direction movement one-to-one without changing scale", () => {
    const gesture = beginTwoPointerNavigation(
      [{ id: 1, x: 100, y: 100 }, { id: 2, x: 300, y: 100 }],
      { position: { x: 20, y: 30 }, scale: 1 },
    );

    expect(updateTwoPointerNavigation(gesture, [
      { id: 1, x: 140, y: 160 },
      { id: 2, x: 340, y: 160 },
    ], { minScale: 0.25, maxScale: 1.8 })).toEqual({
      position: { x: 60, y: 90 },
      scale: 1,
    });
  });

  it("zooms around the moving midpoint while keeping its canvas point anchored", () => {
    const gesture = beginTwoPointerNavigation(
      [{ id: 1, x: 100, y: 100 }, { id: 2, x: 300, y: 100 }],
      { position: { x: 50, y: 20 }, scale: 1 },
    );

    expect(updateTwoPointerNavigation(gesture, [
      { id: 1, x: 50, y: 160 },
      { id: 2, x: 450, y: 160 },
    ], { minScale: 0.25, maxScale: 1.8 })).toEqual({
      position: { x: -20, y: 16 },
      scale: 1.8,
    });
  });

  it("clamps zoom-out and treats coincident starting points as pan-only", () => {
    const zoom = beginTwoPointerNavigation(
      [{ id: 1, x: 100, y: 100 }, { id: 2, x: 300, y: 100 }],
      { position: { x: 0, y: 0 }, scale: 1 },
    );
    expect(updateTwoPointerNavigation(zoom, [
      { id: 1, x: 195, y: 100 },
      { id: 2, x: 205, y: 100 },
    ], { minScale: 0.25, maxScale: 1.8 }).scale).toBe(0.25);

    const pan = beginTwoPointerNavigation(
      [{ id: 3, x: 40, y: 50 }, { id: 4, x: 40, y: 50 }],
      { position: { x: 5, y: 10 }, scale: 1.2 },
    );
    expect(updateTwoPointerNavigation(pan, [
      { id: 3, x: 70, y: 90 },
      { id: 4, x: 70, y: 90 },
    ], { minScale: 0.25, maxScale: 1.8 })).toEqual({
      position: { x: 35, y: 50 },
      scale: 1.2,
    });
  });
});

describe("canvas wheel routing", () => {
  it("pans on an unmodified pixel wheel gesture", () => {
    expect(wheelCameraChange({
      camera: { position: { x: 50, y: 20 }, scale: 1 },
      deltaMode: 0,
      deltaX: 24,
      deltaY: -10,
      metaKey: false,
      ctrlKey: false,
      pointer: { x: 300, y: 200 },
      viewportHeight: 800,
      minScale: 0.25,
      maxScale: 1.8,
    })).toEqual({ position: { x: 26, y: 30 }, scale: 1 });
  });

  it("normalizes line-mode wheel movement", () => {
    expect(wheelCameraChange({
      camera: { position: { x: 0, y: 0 }, scale: 1 },
      deltaMode: 1,
      deltaX: 2,
      deltaY: 3,
      metaKey: false,
      ctrlKey: false,
      pointer: { x: 0, y: 0 },
      viewportHeight: 800,
      minScale: 0.25,
      maxScale: 1.8,
    })).toEqual({ position: { x: -32, y: -48 }, scale: 1 });
  });

  it("zooms around the pointer for control or command wheel input", () => {
    const base = {
      camera: { position: { x: 50, y: 20 }, scale: 1 },
      deltaMode: 0,
      deltaX: 0,
      deltaY: -100,
      pointer: { x: 250, y: 220 },
      viewportHeight: 800,
      minScale: 0.25,
      maxScale: 1.8,
    };
    const control = wheelCameraChange({ ...base, ctrlKey: true, metaKey: false });
    const command = wheelCameraChange({ ...base, ctrlKey: false, metaKey: true });

    expect(control.scale).toBeCloseTo(1.2214, 4);
    expect(control.position).toEqual(command.position);
    expect((250 - control.position.x) / control.scale).toBeCloseTo(200, 8);
    expect((220 - control.position.y) / control.scale).toBeCloseTo(200, 8);
  });

  it("limits a single modified wheel update and respects scale bounds", () => {
    const result = wheelCameraChange({
      camera: { position: { x: 0, y: 0 }, scale: 1.79 },
      deltaMode: 2,
      deltaX: 0,
      deltaY: -10,
      metaKey: true,
      ctrlKey: false,
      pointer: { x: 100, y: 100 },
      viewportHeight: 900,
      minScale: 0.25,
      maxScale: 1.8,
    });
    expect(result.scale).toBe(1.8);
  });

  it("presents every camera update immediately but commits only the latest value per frame", () => {
    const frames: Array<() => void> = [];
    const presented: Array<{ position: { x: number; y: number }; scale: number }> = [];
    const committed: Array<{ position: { x: number; y: number }; scale: number }> = [];
    const batcher = createCameraFrameBatcher({
      commit: (camera) => committed.push(camera),
      present: (camera) => presented.push(camera),
      requestFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
    });
    const first = { position: { x: -10, y: -20 }, scale: 1 };
    const second = { position: { x: -25, y: -40 }, scale: 1 };

    batcher.update(first);
    batcher.update(second);

    expect(presented).toEqual([first, second]);
    expect(committed).toEqual([]);
    expect(frames).toHaveLength(1);

    frames[0]!();
    expect(committed).toEqual([second]);
  });
});

describe("canvas touch lifecycle", () => {
  const camera = { position: { x: 20, y: 30 }, scale: 1 };

  it("promotes a single gesture before starting two-pointer navigation", () => {
    const first = beginCanvasTouch(idleCanvasTouchGesture(), { id: 7, x: 100, y: 120 }, camera);
    expect(first.effect).toEqual({ kind: "begin-single", point: { id: 7, x: 100, y: 120 } });

    const second = beginCanvasTouch(first.gesture, { id: 9, x: 300, y: 120 }, camera);
    expect(second.effect).toEqual({ kind: "finish-single", pointerId: 7 });
    expect(second.gesture.kind).toBe("two-pointer-navigation");
  });

  it("uses pointer identifiers rather than input order while navigating", () => {
    const first = beginCanvasTouch(idleCanvasTouchGesture(), { id: 7, x: 100, y: 100 }, camera);
    const second = beginCanvasTouch(first.gesture, { id: 9, x: 300, y: 100 }, camera);
    const moved = moveCanvasTouch(second.gesture, { id: 9, x: 340, y: 160 }, { minScale: 0.25, maxScale: 1.8 });
    const movedAgain = moveCanvasTouch(moved.gesture, { id: 7, x: 140, y: 160 }, { minScale: 0.25, maxScale: 1.8 });

    expect(movedAgain.effect).toEqual({
      camera: { position: { x: 60, y: 90 }, scale: 1 },
      kind: "navigate",
    });
  });

  it("does not restart a single gesture from the finger left after navigation", () => {
    const first = beginCanvasTouch(idleCanvasTouchGesture(), { id: 1, x: 100, y: 100 }, camera);
    const second = beginCanvasTouch(first.gesture, { id: 2, x: 300, y: 100 }, camera);
    const oneLeft = endCanvasTouch(second.gesture, 2);

    expect(oneLeft.gesture.kind).toBe("awaiting-all-pointers-up");
    expect(oneLeft.effect).toEqual({ kind: "none" });
    expect(moveCanvasTouch(oneLeft.gesture, { id: 1, x: 180, y: 150 }, { minScale: 0.25, maxScale: 1.8 }).effect).toEqual({ kind: "none" });
    expect(endCanvasTouch(oneLeft.gesture, 1).gesture).toEqual({ kind: "idle" });
  });

  it("finishes an ordinary single gesture and resets cancelled input", () => {
    const started = beginCanvasTouch(idleCanvasTouchGesture(), { id: 4, x: 10, y: 20 }, camera);
    const moved = moveCanvasTouch(started.gesture, { id: 4, x: 30, y: 50 }, { minScale: 0.25, maxScale: 1.8 });
    expect(moved.effect).toEqual({ kind: "move-single", point: { id: 4, x: 30, y: 50 } });
    expect(endCanvasTouch(moved.gesture, 4)).toEqual({
      effect: { kind: "finish-single", pointerId: 4 },
      gesture: { kind: "idle" },
    });

    const cancelled = cancelCanvasTouch(started.gesture);
    expect(cancelled).toEqual({
      effect: { kind: "cancel-single", pointerId: 4 },
      gesture: { kind: "idle" },
    });
  });
});
