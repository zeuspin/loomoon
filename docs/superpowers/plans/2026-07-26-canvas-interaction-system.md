# Canvas Interaction System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent, mutually exclusive infinite-canvas tool system with generator-node overlays and an object layer panel.

**Architecture:** Extract pure tool transitions, node operations, generator configuration, and layer operations from `app.tsx`; keep Konva responsible for rendering while a single controller decides what every pointer gesture means. Extend the shared Canvas node contract through optional backward-compatible fields, then migrate legacy nodes on load.

**Tech Stack:** TypeScript, React 19, Vite, Konva/react-konva, Vitest, Remix Icon, Fastify API contracts.

## Global Constraints

- One top-level tool owns pointer events at a time.
- Switching tools preserves selection; creation selects the new object; only blank-canvas click or second-level Escape clears selection.
- A Canvas object is one layer item; named layer groups are out of scope.
- Persist paths, generator configuration, visibility, lock state, and ordering.
- Do not create a branch, commit, or push without explicit permission.
- Preserve strict TypeScript options including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

---

### Task 1: Canvas tool state machine

**Files:**
- Create: `apps/web/src/canvas-tool-state.ts`
- Create: `apps/web/src/canvas-tool-state.test.ts`
- Modify: `apps/web/src/app.tsx`

**Interfaces:**
- Produces: `CanvasTool`, `CanvasInteraction`, `activateCanvasTool`, `temporaryHandDown`, `temporaryHandUp`, `canNodeReceivePointer`, `toolAfterCreation`.
- Consumes: no application state; all functions are pure.

- [ ] **Step 1: Write failing transition tests**

```ts
expect(canNodeReceivePointer("draw")).toBe(false);
expect(canNodeReceivePointer("hand")).toBe(false);
expect(canNodeReceivePointer("select")).toBe(true);
expect(temporaryHandUp(temporaryHandDown("draw"))).toEqual({ active: "draw", suspended: undefined });
expect(toolAfterCreation("shape")).toBe("select");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @loomoon/web test -- canvas-tool-state.test.ts`

Expected: FAIL because `canvas-tool-state.js` does not exist.

- [ ] **Step 3: Implement the pure state machine**

```ts
export type CanvasTool = "select" | "hand" | "draw" | "shape" | "text" | "image-generator" | "video-generator";
export type ToolState = { active: CanvasTool; suspended?: CanvasTool };
export function canNodeReceivePointer(tool: CanvasTool) { return tool === "select" || tool === "text"; }
export function toolAfterCreation() { return "select" as const; }
```

Implement temporary-hand entry/exit and explicit cancellation without optional-property violations.

- [ ] **Step 4: Route Stage and CanvasObject events through the active tool**

`Stage.draggable` is true only for Hand. `CanvasObject.draggable` is true only for Select and unlocked nodes. Draw, Hand and creation tools must set Konva object listeners to `listening={false}` or return before selection/move callbacks.

- [ ] **Step 5: Add shortcuts and input-focus guards**

Implement V/H/P/T/R, Space temporary Hand, Escape and Delete guards. Ignore shortcuts when `event.target` is an input, textarea, select or contenteditable element.

- [ ] **Step 6: Run focused and existing Canvas tests**

Run: `pnpm --filter @loomoon/web test -- canvas-tool-state.test.ts canvas-state.test.ts`

Expected: PASS.

### Task 2: Persistent Canvas node union and operations

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/canvas-domain/src/canvas-node.ts`
- Create: `packages/canvas-domain/src/canvas-node.test.ts`
- Modify: `packages/canvas-domain/src/index.ts`
- Modify: `apps/web/src/canvas-tools.ts`
- Modify: API validation/persistence files located by `rg "CanvasNode" apps/api packages/persistence`.

**Interfaces:**
- Produces: discriminated Canvas nodes for `shape`, `path`, `image-generator`, and `video-generator`; `normalizeCanvasNode`, `isNodeVisible`, `isNodeEditable`.
- Consumes: legacy `CanvasNode` payloads from storage and API.

- [ ] **Step 1: Write failing migration and rule tests**

```ts
expect(normalizeCanvasNode(legacyImage)).toMatchObject({ visible: true, locked: false, rotation: 0 });
expect(isNodeEditable({ ...node, locked: true })).toBe(false);
expect(isNodeVisible({ ...node, visible: false })).toBe(false);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @loomoon/canvas-domain test -- canvas-node.test.ts`

Expected: FAIL because normalization APIs do not exist.

- [ ] **Step 3: Extend contracts backward-compatibly**

Add optional persisted fields `name`, `visible`, `rotation`, `points`, `stroke`, `strokeWidth`, `generator`, and `sourceGeneratorId`. Define `GeneratorConfig` with `prompt`, `referenceNodeIds`, `referenceAssetUrls`, `modelId`, `aspectRatio`, `outputCount`, and `status`.

- [ ] **Step 4: Implement normalization and update API schemas**

Legacy payloads receive deterministic default names and default interaction fields. API/persistence must round-trip new fields unchanged.

- [ ] **Step 5: Verify domain, contract and API tests**

Run: `pnpm --filter @loomoon/canvas-domain test && pnpm --filter @loomoon/contracts typecheck && pnpm --filter @loomoon/api test`

Expected: PASS.

### Task 3: Draw, shape, text and camera gestures

**Files:**
- Create: `apps/web/src/canvas-controller.ts`
- Create: `apps/web/src/canvas-controller.test.ts`
- Create: `apps/web/src/canvas-stage.tsx`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/canvas-state.ts`

**Interfaces:**
- Consumes: Task 1 `CanvasTool` and Task 2 node union.
- Produces: `reduceCanvasPointerEvent(state, event)`, persistent path points, shape previews, selection moves and camera changes.

- [ ] **Step 1: Write failing gesture-conflict tests**

```ts
expect(dragImageWithTool("hand", state)).toMatchObject({ nodeX: 10, cameraX: 120 });
expect(dragImageWithTool("draw", state)).toMatchObject({ nodeX: 10, pathCount: 1 });
expect(dragImageWithTool("select", state)).toMatchObject({ nodeX: 90, cameraX: 0 });
```

Use real reducer inputs rather than DOM mocks.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @loomoon/web test -- canvas-controller.test.ts`

Expected: FAIL because the reducer does not exist.

- [ ] **Step 3: Implement pointer reducer and coordinate conversion**

Handle pointer down/move/up for canvas, node and selection targets. Commit paths only when at least two sampled points remain after simplification. Complete shapes with minimum dimensions and return to Select.

- [ ] **Step 4: Extract `CanvasStage` and make renderer declarative**

`CanvasStage` renders normalized visible nodes and dispatches target-aware pointer events. It must not change tool state directly.

- [ ] **Step 5: Implement text editing lifecycle and wheel rules**

Create text at click position, edit in an HTML overlay, finish with Meta/Ctrl+Enter, cancel with Escape. Two-finger/ordinary wheel pans; Meta/Ctrl+wheel zooms around the pointer.

- [ ] **Step 6: Verify gesture tests and browser regressions**

Run: `pnpm --filter @loomoon/web test -- canvas-controller.test.ts canvas-state.test.ts`

Expected: PASS.

### Task 4: Generator node and anchored form

**Files:**
- Create: `apps/web/src/generator-node.ts`
- Create: `apps/web/src/generator-node.test.ts`
- Create: `apps/web/src/generator-overlay.tsx`
- Create: `apps/web/src/generator-overlay.test.tsx`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/enhancements.css`

**Interfaces:**
- Consumes: Task 2 generator node/config and Task 3 viewport transforms.
- Produces: `createGeneratorNode`, `updateGeneratorConfig`, `validateGeneratorConfig`, `generatorOverlayPlacement`, `GeneratorOverlay`.

- [ ] **Step 1: Write failing generator tests**

```ts
expect(createGeneratorNode("image", center)).toMatchObject({ type: "image-generator", generator: { aspectRatio: "1:1", outputCount: 4 } });
expect(validateGeneratorConfig({ ...config, prompt: "" })).toEqual({ valid: false, reason: "请输入提示词" });
expect(generatorOverlayPlacement(bottomNode, viewport).side).toBe("top");
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @loomoon/web test -- generator-node.test.ts generator-overlay.test.tsx`

Expected: FAIL because generator modules do not exist.

- [ ] **Step 3: Implement generator creation, validation and placement**

Create at the current viewport center, select it, then return to Select. Compute overlay coordinates from node bounds, camera and scale; flip above when the bottom safe area is insufficient.

- [ ] **Step 4: Implement the locked overlay form**

Render prompt textarea, reference thumbnails/upload, model picker, aspect ratio, output count and submit. Draft changes update the selected generator node so deselection/reselection restores them.

- [ ] **Step 5: Implement Mock lifecycle**

Submit transitions `draft → submitting → running → succeeded`, creates result placeholders tied by `sourceGeneratorId`, and disables repeat submit. Failure preserves all configuration and exposes Retry.

- [ ] **Step 6: Verify focused tests**

Run: `pnpm --filter @loomoon/web test -- generator-node.test.ts generator-overlay.test.tsx`

Expected: PASS.

### Task 4A: Live generator overlay transform

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/src/generator-overlay.tsx`
- Modify: `apps/web/src/generator-overlay.test.tsx`
- Modify: `apps/web/src/app.tsx`

**Interfaces:**
- Consumes: the selected generator `Konva.Group`, Stage camera transform, and the existing `GeneratorOverlay` form.
- Produces: `generatorOverlayTransform`, a Konva `<Html />` portal mounted inside the generator group, live drag/resize anchoring, and one persisted node update per completed gesture.

- [x] **Step 1: Write failing live-transform tests**

Use a real `Konva.Group` and `Konva.Rect`. Move and scale the group without changing any React node record, then assert that `generatorOverlayTransform` derives the current screen position from the live Konva transform. Also assert that the returned form scale remains `1` and that bottom-edge collision flips the form above the live node bounds.

- [x] **Step 2: Run the focused tests and verify RED**

Run: `pnpm --filter @loomoon/web test -- generator-overlay.test.tsx canvas-transform.test.ts`

Expected: FAIL because `generatorOverlayTransform` and the portal-backed overlay do not exist.

- [x] **Step 3: Add the Konva HTML portal dependency**

Add `react-konva-utils` at a version compatible with the installed React 19, Konva 10 and react-konva 19 packages. Do not replace or upgrade the existing renderer packages.

- [x] **Step 4: Mount the generator form in the live node transform tree**

Render `<Html />` as a child of the focused generator group. Its transform callback reads the current group screen bounds on every Konva draw, horizontally centers the form, flips it above the node when necessary, and clamps it to the viewport safe area. Override DOM scale and rotation so the form remains screen-aligned and readable while its anchor follows drag, resize, rotation, stage pan and zoom.

- [x] **Step 5: Preserve gesture and persistence boundaries**

Keep Konva responsible for transient pointer-frame transforms. During the gesture, do not append history entries or persist the project. On `dragend` or `transformend`, normalize the final position and dimensions into the Canvas node once, append one undo snapshot, clear the transient transform, and let the existing debounced save run once.

- [x] **Step 6: Verify focused and complete Web checks**

Run: `pnpm --filter @loomoon/web test -- generator-overlay.test.tsx canvas-transform.test.ts canvas-state.test.ts`

Run: `pnpm --filter @loomoon/web test && pnpm --filter @loomoon/web typecheck`

Expected: PASS with no new warnings or errors.

- [x] **Step 7: Verify interaction in Chrome**

At desktop and mobile widths, drag and resize the focused image generator while confirming that the image frame and prompt form remain attached throughout the gesture. Verify that text entry, selects and reference upload do not initiate node drag; confirm deselect/reselect, undo and page reload retain the final committed bounds.

---

### Task 5: Object layers panel

**Files:**
- Create: `apps/web/src/layer-state.ts`
- Create: `apps/web/src/layer-state.test.ts`
- Create: `apps/web/src/layers-panel.tsx`
- Create: `apps/web/src/layers-panel.test.tsx`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/enhancements.css`

**Interfaces:**
- Consumes: Task 2 normalized nodes and existing selection IDs.
- Produces: `layerItemsForNodes`, `reorderLayer`, `toggleLayerVisibility`, `toggleLayerLock`, `deleteLayer`, `LayersPanel`.

- [ ] **Step 1: Write failing layer-operation tests**

```ts
expect(layerItemsForNodes([back, front]).map(x => x.id)).toEqual(["front", "back"]);
expect(reorderLayer([back, front], "back", 0).map(x => x.id)).toEqual(["front", "back"]);
expect(deleteLayer([{ ...back, locked: true }], "back")).toHaveLength(1);
expect(toggleLayerVisibility([front], "front")[0]?.visible).toBe(false);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @loomoon/web test -- layer-state.test.ts`

Expected: FAIL because layer operations do not exist.

- [ ] **Step 3: Implement immutable layer operations**

Panel index zero maps to the final render-array element. Locked nodes cannot be deleted. Hidden nodes remain in the list but are excluded from render, hit testing, export and Agent image selection.

- [ ] **Step 4: Implement LayersPanel and bottom-left trigger**

Rows contain drag handle, type/thumbnail, editable name, eye, lock and delete/more controls. Selection synchronizes both directions. Implement pointer drag ordering plus Move Up/Move Down buttons for keyboard and touch accessibility.

- [ ] **Step 5: Add history entries for all layer mutations**

Use the same operation history as node edits so reorder, hide, lock, rename and delete undo and redo correctly.

- [ ] **Step 6: Verify focused tests**

Run: `pnpm --filter @loomoon/web test -- layer-state.test.ts layers-panel.test.tsx`

Expected: PASS.

### Task 6: Integration, mobile behavior and visual QA

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/enhancements.css`
- Modify: `apps/web/src/style-contract.test.ts`
- Modify: `design-qa.md`
- Create/update screenshots under `docs/design-qa-assets/`.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: finished desktop/mobile Canvas experience.

- [ ] **Step 1: Add integration tests for input priority**

Cover Draw over image, Hand over image, temporary Space Hand, form-focus shortcut suppression, generator focus restore, and hidden-layer exclusion.

- [ ] **Step 2: Implement mobile gestures and drawers**

Single pointer follows current tool; two active pointers suspend the tool and control the camera. Render Layers as a bottom drawer and GeneratorOverlay as a bottom workbench.

- [ ] **Step 3: Run complete repository verification**

Run: `pnpm test && pnpm typecheck && pnpm build`

Expected: all commands exit 0. The existing Vite bundle-size warning is non-blocking.

- [ ] **Step 4: Execute Chrome interaction matrix**

Verify Select/Hand/Draw over the same image; generator create/deselect/reselect/move/submit; layer reorder/hide/lock/delete/undo; shortcuts; and mobile breakpoint behavior.

- [ ] **Step 5: Capture side-by-side QA evidence**

Save default toolbar, open Layers panel, selected generator and mobile screenshots. Compare each state with the corresponding Xingliu reference at the same viewport and update `design-qa.md` with P0–P3 findings.

---

## Plan self-review

- Spec coverage: tool state machine, input priority, persistent paths, generators, layers, history, Agent filtering, mobile and visual QA are mapped to Tasks 1–6.
- Type consistency: `CanvasTool`, normalized node fields, generator configuration and layer ordering are defined before consumers.
- Scope: named layer groups, advanced generator parameters and continuous-create lock remain intentionally outside this plan.
- Commit steps are omitted because repository instructions prohibit commits without explicit permission.
