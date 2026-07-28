# Canvas Gesture Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Loomoon's infinite canvas predictable on Mac and iPad with two-pointer pan/zoom, tool-owned single-pointer gestures, and safe draw-to-navigation transitions.

**Architecture:** Add a pure gesture module that owns active pointer bookkeeping, two-pointer camera math, and wheel normalization. Keep React/Konva integration in `app.tsx`: it converts browser touch events to pure gesture inputs and continues using the existing node, marquee, shape, and drawing state.

**Tech Stack:** TypeScript, React 19, Konva/react-konva, Vitest, Pointer/Touch Events.

## Global Constraints

- Two-pointer navigation has priority over every canvas tool.
- Draw mode uses one finger, Apple Pencil, or the mouse and never delegates the same gesture to a node.
- A two-pointer gesture must return to zero active touches before another single-touch gesture may start.
- Scale remains between `0.25` and `1.8`.
- Do not add canvas rotation, inertia, rubber-banding, or three-finger shortcuts.
- Do not create a branch, commit, or push.
- Preserve unrelated working-tree changes.

---

### Task 1: Pure camera gesture and wheel math

**Files:**
- Create: `apps/web/src/canvas-gesture.ts`
- Create: `apps/web/src/canvas-gesture.test.ts`

**Interfaces:**
- Produces: `beginTwoPointerNavigation`, `updateTwoPointerNavigation`, `wheelCameraChange`, `TwoPointerNavigation`, `CameraTransform`.
- Consumes: screen-space points, camera position, scale, wheel deltas and modifier keys.

- [ ] **Step 1: Write failing two-pointer camera tests**

Test literal outcomes for pure pan, centered zoom, combined pan/zoom, scale clamps, and coincident start points. A broken center calculation, wrong scale ratio, or missing clamp must fail at least one test.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @loomoon/web test -- canvas-gesture.test.ts`

Expected: FAIL because `canvas-gesture.js` does not exist.

- [ ] **Step 3: Implement minimal two-pointer camera math**

Record the starting midpoint, distance, camera, scale, and canvas point below the midpoint. On update, calculate `nextScale = clamp(startScale * currentDistance / startDistance)` and position the anchored canvas point below the current midpoint. Treat a start distance below one pixel as pan-only.

- [ ] **Step 4: Write failing wheel routing tests**

Assert that plain pixel wheel input offsets camera by both axes, while `ctrlKey` or `metaKey` returns an anchored continuous zoom. Include line-mode normalization and a large-delta clamp.

- [ ] **Step 5: Implement wheel routing and verify GREEN**

Use pixel, line (`16px`), and page (viewport-height) normalization. Plain wheel input pans by negative deltas. Modified wheel input converts clamped vertical delta to an exponential scale factor and reuses anchored zoom math.

Run: `pnpm --filter @loomoon/web test -- canvas-gesture.test.ts`

Expected: PASS.

### Task 2: Gesture lifecycle and draw interruption

**Files:**
- Modify: `apps/web/src/canvas-gesture.ts`
- Modify: `apps/web/src/canvas-gesture.test.ts`

**Interfaces:**
- Produces: `CanvasTouchGesture`, `beginCanvasTouch`, `moveCanvasTouch`, `endCanvasTouch`, and gesture effects describing `begin-single`, `move-single`, `finish-single`, `cancel-single`, `navigate`, or `none`.
- Consumes: touch identifiers/positions and current camera transform.

- [ ] **Step 1: Write failing lifecycle tests**

Test one-to-two-touch promotion, effective single gesture finalization, two-to-one waiting, zero-touch reset, touch identifier stability, and cancellation. A regression that restarts drawing from the remaining finger must fail.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @loomoon/web test -- canvas-gesture.test.ts`

Expected: FAIL because lifecycle exports are missing.

- [ ] **Step 3: Implement the minimal lifecycle reducer**

Keep active touches by identifier. Promote the single gesture before starting navigation; emit `finish-single` so the React layer can commit an effective draw and discard an ineffective one using its existing threshold. Once navigation loses a touch, emit no single-pointer effects until all touches end.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter @loomoon/web test -- canvas-gesture.test.ts`

Expected: PASS.

### Task 3: React/Konva integration

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/canvas-controller.test.ts`

**Interfaces:**
- Consumes: Task 1 camera math and Task 2 lifecycle effects.
- Produces: device behavior observable through the existing Stage and Canvas controller.

- [ ] **Step 1: Add a failing object-ownership regression test**

Extend `canvas-controller.test.ts` so draw-mode input beginning on a node leaves selection and node position unchanged, while select-mode node input still moves the selection. This guards the integration's dispatch rule without mocking Konva.

- [ ] **Step 2: Verify RED or characterize existing coverage**

Run: `pnpm --filter @loomoon/web test -- canvas-controller.test.ts`

If the behavior is already covered and passes, retain the existing test rather than duplicate it; the new pure lifecycle tests provide the missing RED coverage.

- [ ] **Step 3: Integrate touch lifecycle with Stage handlers**

Track touch coordinates from `TouchEvent.changedTouches`/`touches`, feed lifecycle effects to the existing draw, marquee, shape, and camera actions, and prevent Konva Stage dragging for touch navigation. Commit or discard a draw before promotion and ignore the remaining finger until all touches lift.

- [ ] **Step 4: Replace wheel behavior**

Use `wheelCameraChange`: plain wheel pans; `Ctrl`/`Meta` wheel zooms around the stage pointer. Preserve the scale limits.

- [ ] **Step 5: Constrain browser touch handling**

Add `touch-action: none` to `.canvas-shell` so the browser does not scroll or zoom the page while a canvas gesture is active.

- [ ] **Step 6: Run focused verification**

Run: `pnpm --filter @loomoon/web test -- canvas-gesture.test.ts canvas-controller.test.ts canvas-state.test.ts`

Expected: PASS.

### Task 4: Full web verification

**Files:**
- Modify only files required to correct failures caused by Tasks 1-3.

**Interfaces:**
- Consumes: completed gesture implementation.
- Produces: verified web workspace.

- [ ] **Step 1: Run all web tests**

Run: `pnpm --filter @loomoon/web test`

Expected: PASS with zero failing tests.

- [ ] **Step 2: Run strict type checking**

Run: `pnpm --filter @loomoon/web typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run repository diff checks**

Run: `git diff --check -- apps/web/src docs/superpowers`

Expected: no whitespace errors. Review `git diff` to ensure no unrelated files were changed by this implementation.
