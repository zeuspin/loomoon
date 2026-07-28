# Creoor Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, mock-backed Creoor fashion-design Agent workbench in `creoor/` with a Konva infinite canvas, dockable UI panels, semantic theming, image-aware actions, explicit Agent references, and anchored generator forms.

**Architecture:** `react-konva` renders canvas content through a fixed four-layer stage, while React DOM renders panels, menus, forms, and Agent UI. A reducer-backed document store is the source of truth; coordinate adapters bridge canvas and screen space, and a typed in-memory Mock API plus local persistence supplies all server-like behavior.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Konva 10, react-konva 19, Vitest 3, Testing Library, `@testing-library/jest-dom`, jsdom, Lucide React/Lucide Animated components, CSS custom properties, localStorage.

## Global Constraints

- Create the frontend under repository-root `creoor/`; do not modify or reuse Loomoon UI implementation files.
- Use Node.js 24+, pnpm 11.9.0, React 19, Konva 10, and react-konva 19.
- All backend behavior is mocked; do not call a real authentication, AI, image, audio, or video service.
- Konva renders canvas content only. React DOM renders all panels, menus, inputs, forms, tooltips, and dialogs.
- React document state is authoritative; never persist `stage.toJSON()` as the product document.
- Use 3–4 fixed Konva rendering layers. User-visible layers are logical groups inside the content layer.
- UI components may not contain raw colors, font sizes, shadows, radii, animation durations, or arbitrary `z-index` values; consume theme tokens.
- Implement the light theme now while preserving semantic token contracts for dark and high-contrast themes.
- Desktop interactive targets are at least 36px; iPad/touch targets are at least 44px.
- Support `prefers-reduced-motion` and do not rely on color alone for selection, errors, or generation status.
- Every task follows test-driven development and ends in a focused commit.

---

## Planned File Structure

```text
creoor/
  index.html                         # Vite entry document
  package.json                       # Creoor scripts and dependencies
  tsconfig.json                      # Strict TypeScript configuration
  vite.config.ts                     # React/Vitest/jsdom configuration
  src/
    main.tsx                         # React root
    app/CreoorApp.tsx                # Workbench composition
    app/app.css                      # Layout using semantic tokens only
    theme/primitives.css             # Raw primitive values; only permitted raw visual values
    theme/semantic.css               # Semantic aliases and light theme
    theme/components.css             # Component and state token aliases
    theme/token-contract.ts          # Typed token names for Konva and JS animation use
    theme/token-guard.test.ts         # Prevent raw visual constants outside theme files
    domain/types.ts                  # Canvas, panel, image, Agent, generator domain types
    domain/document-reducer.ts       # Pure document mutations and history
    domain/document-reducer.test.ts  # Reducer/history tests
    data/fixtures.ts                 # Fashion-specific mock records
    data/mock-api.ts                 # Typed delayed/failing mock service
    data/mock-api.test.ts            # Mock lifecycle tests
    data/persistence.ts              # Versioned localStorage adapter
    data/persistence.test.ts         # Migration and recovery tests
    canvas/CanvasStage.tsx           # Konva Stage and fixed layers
    canvas/coordinates.ts            # Screen/canvas transforms
    canvas/coordinates.test.ts       # Zoom-safe transform tests
    canvas/gestures.ts               # Wheel, touch, and pen normalization
    canvas/gestures.test.ts           # Pointer and pinch tests
    canvas/SelectionOverlay.tsx       # Transformer, box selection, guides
    canvas/snapping.ts               # Grid/object/rotation snap calculations
    canvas/snapping.test.ts           # Snap threshold tests
    canvas/LogicalLayerRenderer.tsx   # Render logical layer tree
    canvas/GeneratorNode.tsx          # Konva generator placeholder/result
    panels/DockablePanel.tsx          # Shared docking/floating/collapse shell
    panels/panel-layout.ts            # Panel placement and collision logic
    panels/panel-layout.test.ts       # Dock, clamp, and restore tests
    panels/UserProjectPanel.tsx       # User/project card
    panels/CanvasUtilityPanel.tsx     # Minimap/grid/layers/shortcuts/zoom
    panels/AgentPanel.tsx             # Conversation/session container
    tools/ToolRail.tsx                # Compact/expanded tool rail
    tools/BrushPopover.tsx             # Brush secondary panel
    tools/tool-registry.ts             # Tool metadata and shortcuts
    images/image-capabilities.ts       # Tag-to-action registry and intersections
    images/image-capabilities.test.ts  # Single/multi-selection action tests
    images/ImageActionMenu.tsx         # Contextual action menu
    images/LibraryPanel.tsx            # History/private/public fashion libraries
    agent/references.ts                # Stable @ reference parsing/resolution
    agent/references.test.ts           # Rename/delete/local-region tests
    agent/ReferenceTray.tsx            # Input reference thumbnails
    agent/AgentComposer.tsx            # Prompt, skills, voice mock, @ picker
    agent/ConversationList.tsx         # Mock clarification/result flow
    generators/GeneratorForm.tsx       # Anchored DOM form
    generators/anchor-placement.ts     # Flip/clamp anchor placement
    generators/anchor-placement.test.ts# Viewport placement tests
    generators/generator-state.ts      # Generator state machine
    generators/generator-state.test.ts # Queue/fail/retry/cancel tests
    test/setup.ts                       # jsdom setup and browser API stubs
    test/render-app.tsx                 # Shared render helper
```

## Task 1: Scaffold Creoor and Enforce the Theme Contract

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `creoor/package.json`
- Create: `creoor/tsconfig.json`
- Create: `creoor/vite.config.ts`
- Create: `creoor/index.html`
- Create: `creoor/src/main.tsx`
- Create: `creoor/src/app/CreoorApp.tsx`
- Create: `creoor/src/app/app.css`
- Create: `creoor/src/theme/primitives.css`
- Create: `creoor/src/theme/semantic.css`
- Create: `creoor/src/theme/components.css`
- Create: `creoor/src/theme/token-contract.ts`
- Create: `creoor/src/theme/token-guard.test.ts`
- Create: `creoor/src/test/setup.ts`

**Interfaces:**
- Produces: CSS variables such as `--surface-canvas`, `--panel-floating-bg`, `--text-primary`, `--space-3`, `--radius-panel`, `--motion-panel-ms`, plus `canvasTheme(): CanvasTheme` for Konva-only values.
- Consumes: nothing.

- [ ] **Step 1: Write the failing theme guard test**

```ts
// creoor/src/theme/token-guard.test.ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function files(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("visual token contract", () => {
  it("keeps raw visual values inside theme files", () => {
    const src = join(process.cwd(), "src");
    const offenders = files(src)
      .filter((path) => /\.(css|tsx)$/.test(path))
      .filter((path) => !path.includes(`${join("src", "theme")}`))
      .filter((path) => /#[0-9a-f]{3,8}\b|rgba?\(|shadow:\s|z-index:\s*\d+/i.test(readFileSync(path, "utf8")))
      .map((path) => relative(process.cwd(), path));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify scaffolding is missing**

Run: `pnpm --dir creoor test src/theme/token-guard.test.ts`

Expected: FAIL because `creoor/package.json` does not exist.

- [ ] **Step 3: Create the Vite package and test configuration**

Add `creoor` to `pnpm-workspace.yaml` and create this package contract:

```json
{
  "name": "@creoor/web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit && vite build"
  },
  "dependencies": {
    "konva": "^10.0.0",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-konva": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "jsdom": "^26.0.0",
    "typescript": "^5.9.0",
    "vite": "^7.0.0",
    "vitest-canvas-mock": "^0.3.3",
    "vitest": "^3.2.0"
  }
}
```

Configure Vitest with `environment: "jsdom"` and `setupFiles: ["./src/test/setup.ts"]`. The setup file must contain:

```ts
import "@testing-library/jest-dom/vitest";
import "vitest-canvas-mock";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub;
```

- [ ] **Step 4: Implement four-level tokens and the typed Konva bridge**

```ts
// creoor/src/theme/token-contract.ts
export interface CanvasTheme {
  canvasBackground: string;
  gridDot: string;
  selection: string;
  guide: string;
  danger: string;
  snapDistancePx: number;
}

export function canvasTheme(): CanvasTheme {
  const css = getComputedStyle(document.documentElement);
  return {
    canvasBackground: css.getPropertyValue("--surface-canvas").trim(),
    gridDot: css.getPropertyValue("--canvas-grid-dot").trim(),
    selection: css.getPropertyValue("--border-selection").trim(),
    guide: css.getPropertyValue("--border-guide").trim(),
    danger: css.getPropertyValue("--status-danger").trim(),
    snapDistancePx: Number(css.getPropertyValue("--canvas-snap-distance")) || 6,
  };
}
```

Only `primitives.css` contains raw values. `semantic.css` aliases primitives, and `components.css` aliases semantic roles for docked/floating/collapsed/active states.

- [ ] **Step 5: Render the empty themed workbench shell**

Implement `CreoorApp` with a full viewport canvas region and four empty panel slots. Import all theme styles from `main.tsx`.

- [ ] **Step 6: Run validation**

Run: `pnpm install && pnpm --dir creoor test && pnpm --dir creoor typecheck && pnpm --dir creoor build`

Expected: all commands PASS.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml creoor
git commit -m "feat(creoor): scaffold themed workbench"
```

## Task 2: Define the Document Store, Mock API, and Persistence

**Files:**
- Create: `creoor/src/domain/types.ts`
- Create: `creoor/src/domain/document-reducer.ts`
- Create: `creoor/src/domain/document-reducer.test.ts`
- Create: `creoor/src/data/fixtures.ts`
- Create: `creoor/src/data/mock-api.ts`
- Create: `creoor/src/data/mock-api.test.ts`
- Create: `creoor/src/data/persistence.ts`
- Create: `creoor/src/data/persistence.test.ts`
- Modify: `creoor/src/app/CreoorApp.tsx`

**Interfaces:**
- Produces: `CreoorDocument`, `CanvasNode`, `LogicalLayer`, `PanelLayout`, `AgentSession`, `GeneratorRecord`, `documentReducer(state, action)`, `mockApi`, and `loadDocument()/saveDocument()`.
- Consumes: theme-independent TypeScript only.

- [ ] **Step 1: Write reducer tests for add, reorder, undo, and redo**

```ts
it("reorders logical layers and restores the order with undo", () => {
  const initial = fixtureDocument(["layer-a", "layer-b"]);
  const changed = documentReducer(initial, { type: "layer/reorder", id: "layer-b", toIndex: 0 });
  expect(changed.present.layerOrder).toEqual(["layer-b", "layer-a"]);
  const undone = documentReducer(changed, { type: "history/undo" });
  expect(undone.present.layerOrder).toEqual(["layer-a", "layer-b"]);
});
```

- [ ] **Step 2: Run reducer tests and verify failure**

Run: `pnpm --dir creoor test src/domain/document-reducer.test.ts`

Expected: FAIL because the reducer is missing.

- [ ] **Step 3: Implement normalized domain types and bounded history**

Use node maps plus ordered ID arrays. Store canvas coordinates, not screen coordinates. Limit undo history to 100 snapshots and exclude ephemeral hover/drag preview state.

- [ ] **Step 4: Write Mock API lifecycle tests**

```ts
it("emits queued, generating, and completed generator states", async () => {
  const states: string[] = [];
  await mockApi.runGenerator("generator-1", (state) => states.push(state.status), { delayMs: 1 });
  expect(states).toEqual(["queued", "generating", "completed"]);
});
```

- [ ] **Step 5: Implement fixtures and typed Mock API**

Provide two Agent sessions, fashion images covering every tag family, seven library categories, public/private sources, generator success/failure/partial fixtures, and deterministic `delayMs`/`fail` options for tests.

- [ ] **Step 6: Write persistence recovery tests**

Test valid versioned data, malformed JSON fallback, and panel positions clamped after viewport changes.

- [ ] **Step 7: Implement versioned local persistence**

Use key `creoor.document.v1`. Save only durable document/layout data, debounce saves by 250ms, and recover to fixtures on invalid data without throwing from render.

- [ ] **Step 8: Run and commit**

Run: `pnpm --dir creoor test src/domain src/data && pnpm --dir creoor typecheck`

Expected: PASS.

```bash
git add creoor/src/domain creoor/src/data creoor/src/app/CreoorApp.tsx
git commit -m "feat(creoor): add document store and mock data"
```

## Task 3: Build the Konva Stage, Coordinates, and Input Gestures

**Files:**
- Create: `creoor/src/canvas/coordinates.ts`
- Create: `creoor/src/canvas/coordinates.test.ts`
- Create: `creoor/src/canvas/gestures.ts`
- Create: `creoor/src/canvas/gestures.test.ts`
- Create: `creoor/src/canvas/CanvasStage.tsx`
- Create: `creoor/src/canvas/LogicalLayerRenderer.tsx`
- Modify: `creoor/src/app/CreoorApp.tsx`

**Interfaces:**
- Produces: `ViewportTransform`, `canvasToScreen(point, viewport)`, `screenToCanvas(point, viewport)`, `zoomAtPointer(viewport, pointer, factor)`, and `<CanvasStage document dispatch />`.
- Consumes: `CreoorDocument`, `CanvasNode`, `canvasTheme()`.

- [ ] **Step 1: Write coordinate round-trip and pointer-centered zoom tests**

```ts
it("preserves the canvas point beneath the pointer while zooming", () => {
  const viewport = { x: 100, y: 50, scale: 1 };
  const pointer = { x: 400, y: 300 };
  const before = screenToCanvas(pointer, viewport);
  const next = zoomAtPointer(viewport, pointer, 2);
  expect(screenToCanvas(pointer, next)).toEqual(before);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --dir creoor test src/canvas/coordinates.test.ts`

Expected: FAIL because coordinate functions are missing.

- [ ] **Step 3: Implement pure coordinate and zoom helpers**

Clamp scale to `0.1–4`. Keep all snapping thresholds in screen pixels and convert them to canvas units with `threshold / scale`.

- [ ] **Step 4: Write gesture normalization tests**

Test wheel zoom, one-finger pan, two-finger midpoint/distance, Pencil pointer metadata, and refusal to pan while the pen tool is active.

- [ ] **Step 5: Implement the fixed layer stage**

Render background, content, interaction, and temporary Konva Layers. Set `listening={false}` on the background layer. Render fixture image/text/stroke nodes through `LogicalLayerRenderer`.

- [ ] **Step 6: Connect wheel, touch, and pointer events**

Use Konva touch events for pinch/pan and native `pointerdown/move/up` on the Stage container for `pointerType === "pen"`, pressure, tiltX, and tiltY.

- [ ] **Step 7: Run and commit**

Run: `pnpm --dir creoor test src/canvas/coordinates.test.ts src/canvas/gestures.test.ts && pnpm --dir creoor typecheck`

Expected: PASS.

```bash
git add creoor/src/canvas creoor/src/app/CreoorApp.tsx
git commit -m "feat(creoor): add Konva infinite canvas"
```

## Task 4: Add Selection, Snapping, Logical Layers, and Alignment

**Files:**
- Create: `creoor/src/canvas/snapping.ts`
- Create: `creoor/src/canvas/snapping.test.ts`
- Create: `creoor/src/canvas/SelectionOverlay.tsx`
- Modify: `creoor/src/canvas/CanvasStage.tsx`
- Modify: `creoor/src/canvas/LogicalLayerRenderer.tsx`
- Modify: `creoor/src/domain/document-reducer.ts`
- Modify: `creoor/src/domain/document-reducer.test.ts`
- Create: `creoor/src/panels/CanvasUtilityPanel.tsx`

**Interfaces:**
- Produces: `calculateSnap(dragRect, candidates, options): SnapResult`, `alignSelection(ids, mode)`, selection rectangle, transformer, guide rendering, and logical layer controls.
- Consumes: coordinate helpers, document reducer, theme bridge.

- [ ] **Step 1: Write snap tests**

```ts
it("uses a zoom-independent six screen-pixel threshold", () => {
  const result = calculateSnap(rect(49, 10, 20, 20), [guideX(50)], { scale: 2, thresholdPx: 6, grid: 8 });
  expect(result.x).toBe(50);
  expect(result.guides).toEqual([{ axis: "x", value: 50, kind: "object" }]);
});
```

Cover grid, stage edge, object edge/center, rotation increments, disabled snapping, and no candidate inside threshold.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --dir creoor test src/canvas/snapping.test.ts`

Expected: FAIL because snapping is missing.

- [ ] **Step 3: Implement pure snapping and alignment calculations**

Return proposed coordinates plus visible guide descriptors. Never mutate Konva nodes inside calculation functions.

- [ ] **Step 4: Implement click, Shift multi-select, box select, and Transformer**

Keep selected IDs in React state. During drag render guides in the interaction Layer; commit coordinates to the reducer on drag end.

- [ ] **Step 5: Implement logical layer controls**

Add rename, hide, lock, group, ungroup, reorder, undo, and redo actions in `CanvasUtilityPanel`. Render hidden nodes as absent and locked nodes as non-listening.

- [ ] **Step 6: Add alignment commands**

Implement left/center/right, top/middle/bottom, horizontal distribution, and vertical distribution for two or more selected nodes.

- [ ] **Step 7: Run and commit**

Run: `pnpm --dir creoor test src/canvas/snapping.test.ts src/domain/document-reducer.test.ts && pnpm --dir creoor typecheck`

Expected: PASS.

```bash
git add creoor/src/canvas creoor/src/domain creoor/src/panels/CanvasUtilityPanel.tsx
git commit -m "feat(creoor): add selection snapping and layers"
```

## Task 5: Implement Dockable Panels and Saved Layouts

**Files:**
- Create: `creoor/src/panels/panel-layout.ts`
- Create: `creoor/src/panels/panel-layout.test.ts`
- Create: `creoor/src/panels/DockablePanel.tsx`
- Create: `creoor/src/panels/UserProjectPanel.tsx`
- Create: `creoor/src/panels/AgentPanel.tsx`
- Modify: `creoor/src/panels/CanvasUtilityPanel.tsx`
- Modify: `creoor/src/app/CreoorApp.tsx`
- Modify: `creoor/src/theme/components.css`

**Interfaces:**
- Produces: `placePanel(layout, viewport, occupied): PanelLayout`, `DockablePanelProps`, and desktop/iPad saved layouts.
- Consumes: persistence adapter and semantic/component tokens.

- [ ] **Step 1: Write panel geometry tests**

```ts
it("docks to the left edge and removes the outer radius state", () => {
  const next = placePanel(floating({ x: 3, y: 120, width: 240 }), viewport(1200, 800), []);
  expect(next.mode).toBe("docked");
  expect(next.edge).toBe("left");
  expect(next.x).toBe(0);
});
```

Cover all edges, collision avoidance, viewport clamping, Agent width limits, collapsed placement, and restore-default.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --dir creoor test src/panels/panel-layout.test.ts`

Expected: FAIL because layout functions are missing.

- [ ] **Step 3: Implement `DockablePanel` states**

Use a pointer-captured DOM drag handle. Show edge previews while dragging. Support `docked`, `floating`, `collapsed`, `peek`, `pinned`, and `dragging`. Clicking canvas blank space closes only `peek` panels.

- [ ] **Step 4: Implement collision avoidance and Agent resizing**

Clamp Agent width to 300–560px on desktop and 280–420px on iPad. Resolve docked collisions by placing the later panel after the occupied segment along the same edge.

- [ ] **Step 5: Apply state-specific themed visuals and motion**

Use component tokens for edge radii, borders, backgrounds, shadows, blur, 180–240ms transitions, and reduced-motion overrides.

- [ ] **Step 6: Persist desktop and iPad layouts**

Use `matchMedia("(pointer: coarse)")` plus viewport width to choose the profile. Save global defaults and optional project overrides.

- [ ] **Step 7: Run and commit**

Run: `pnpm --dir creoor test src/panels/panel-layout.test.ts src/data/persistence.test.ts && pnpm --dir creoor typecheck`

Expected: PASS.

```bash
git add creoor/src/panels creoor/src/app/CreoorApp.tsx creoor/src/theme/components.css creoor/src/data/persistence.ts
git commit -m "feat(creoor): add dockable workbench panels"
```

## Task 6: Build the Expandable Tool Rail and Brush Popover

**Files:**
- Create: `creoor/src/tools/tool-registry.ts`
- Create: `creoor/src/tools/ToolRail.tsx`
- Create: `creoor/src/tools/BrushPopover.tsx`
- Modify: `creoor/src/app/CreoorApp.tsx`
- Modify: `creoor/src/theme/components.css`

**Interfaces:**
- Produces: `ToolDefinition { id, label, shortcut, icon, panel }`, compact/expanded rail, and detachable brush settings.
- Consumes: `DockablePanel`, document actions, theme tokens.

- [ ] **Step 1: Write component tests for compact, expanded, and keyboard behavior**

```tsx
it("shows labels and shortcuts only when expanded", async () => {
  render(<ToolRail expanded={false} onExpandedChange={() => {}} />);
  expect(screen.queryByText("画笔")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "展开工具栏" }));
  expect(screen.getByText("画笔")).toBeVisible();
  expect(screen.getByText("P")).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --dir creoor test src/tools`

Expected: FAIL because tool components are missing.

- [ ] **Step 3: Implement the registry and rail**

Register select, hand, brush, text, upload, image generator, history, libraries, and inspiration actions. Use Lucide Animated where available and Lucide fallback with matching stroke width.

- [ ] **Step 4: Implement `BrushPopover`**

Provide width, color role, opacity, and preset controls. Anchor to the brush button, allow dragging into a standalone floating panel, and retain settings when temporarily closed.

- [ ] **Step 5: Implement input-specific animation triggers**

Play once on hover for fine pointers and on activation for coarse pointers. Disable transform animation under reduced motion.

- [ ] **Step 6: Run and commit**

Run: `pnpm --dir creoor test src/tools && pnpm --dir creoor typecheck`

Expected: PASS.

```bash
git add creoor/src/tools creoor/src/app/CreoorApp.tsx creoor/src/theme/components.css
git commit -m "feat(creoor): add expandable creative tools"
```

## Task 7: Add Fashion Libraries and Image-Aware Action Menus

**Files:**
- Create: `creoor/src/images/image-capabilities.ts`
- Create: `creoor/src/images/image-capabilities.test.ts`
- Create: `creoor/src/images/ImageActionMenu.tsx`
- Create: `creoor/src/images/LibraryPanel.tsx`
- Modify: `creoor/src/data/fixtures.ts`
- Modify: `creoor/src/app/CreoorApp.tsx`

**Interfaces:**
- Produces: `ImageTag`, `ImageAction`, `actionsForImage(tags)`, `intersectionForSelection(images)`, `allActionsWithApplicability(images)`, contextual DOM menu, and history/private/public libraries.
- Consumes: selected node IDs, coordinate adapter, Mock image metadata.

- [ ] **Step 1: Write capability resolution tests**

```ts
it("returns common actions for a portrait product-image multi-selection", () => {
  const result = intersectionForSelection([
    image(["portrait", "model", "garment"]),
    image(["product", "garment"]),
  ]);
  expect(result.map((action) => action.id)).toEqual(expect.arrayContaining(["upscale", "remove-background", "change-garment"]));
  expect(result.map((action) => action.id)).not.toContain("relight-portrait");
});
```

Cover pattern, portrait, sketch, product, casual photo, fabric, and multi-tag union/intersection.

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --dir creoor test src/images/image-capabilities.test.ts`

Expected: FAIL because the registry is missing.

- [ ] **Step 3: Implement the action registry**

Include all universal, garment, pattern, portrait, sketch, product, casual-photo, and fabric actions in the approved specification. Each action declares applicable tags and a Chinese label.

- [ ] **Step 4: Implement `ImageActionMenu`**

Anchor the DOM menu near the selected Konva image using `canvasToScreen`. Single selection shows union plus universal actions; multi-selection defaults to intersection. The “全部” tab shows applicability counts and requires confirmation before partial execution.

- [ ] **Step 5: Implement `LibraryPanel`**

Rename assets to history and expose 模特、服装、鞋履、箱包、配饰、面料、纹样. Add private/public filters and “保存到我的图库”. Dragging a library card onto the canvas creates an image node.

- [ ] **Step 6: Run and commit**

Run: `pnpm --dir creoor test src/images && pnpm --dir creoor typecheck`

Expected: PASS.

```bash
git add creoor/src/images creoor/src/data/fixtures.ts creoor/src/app/CreoorApp.tsx
git commit -m "feat(creoor): add fashion image capabilities"
```

## Task 8: Implement Multi-Selection Context and Explicit Agent References

**Files:**
- Create: `creoor/src/agent/references.ts`
- Create: `creoor/src/agent/references.test.ts`
- Create: `creoor/src/agent/ReferenceTray.tsx`
- Create: `creoor/src/agent/AgentComposer.tsx`
- Create: `creoor/src/agent/ConversationList.tsx`
- Modify: `creoor/src/panels/AgentPanel.tsx`
- Modify: `creoor/src/canvas/SelectionOverlay.tsx`
- Modify: `creoor/src/domain/document-reducer.ts`

**Interfaces:**
- Produces: `parseReferences(text, candidates)`, `resolveReference(id, document)`, stable reference records, selection context bar, per-session context, and Mock clarification flow.
- Consumes: selected canvas nodes, Mock API, canvas coordinate adapter.

- [ ] **Step 1: Write reference stability tests**

```ts
it("keeps a stable reference after its image is renamed", () => {
  const reference = createReference({ objectId: "image-1", label: "图1" });
  const renamed = renameObject(fixtureDocument(), "image-1", "红色连衣裙正面");
  expect(resolveReference(reference, renamed)).toMatchObject({ objectId: "image-1", currentLabel: "红色连衣裙正面" });
});
```

Also test deleted-object snapshots, current selection, annotated region, and session isolation.

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --dir creoor test src/agent/references.test.ts`

Expected: FAIL because reference functions are missing.

- [ ] **Step 3: Implement selection context actions**

Add “添加到当前会话”, “生成带批注截图”, “仅分析”, alignment, grouping, and batch actions. Use Konva `toCanvas()` for the selected region and keep the resulting preview in Mock memory only.

- [ ] **Step 4: Implement reference tray and `@` picker**

Show thumbnail, stable number, short name, origin, and remove control. Parse `@图1`, named images, current selection, annotated regions, and attribute suffixes such as `的版型` or `的纹样`.

- [ ] **Step 5: Implement isolated sessions and Mock conversation flow**

Provide multiple sessions with separate reference sets and messages. When a prompt is ambiguous, return one to three clarification chips. Do not read canvas objects unless explicitly referenced.

- [ ] **Step 6: Add visual cross-highlighting**

Hovering or focusing a reference highlights the associated canvas object/region in the interaction Layer. Selecting a canvas object highlights the matching tray item.

- [ ] **Step 7: Run and commit**

Run: `pnpm --dir creoor test src/agent src/domain/document-reducer.test.ts && pnpm --dir creoor typecheck`

Expected: PASS.

```bash
git add creoor/src/agent creoor/src/panels/AgentPanel.tsx creoor/src/canvas/SelectionOverlay.tsx creoor/src/domain/document-reducer.ts
git commit -m "feat(creoor): add explicit agent references"
```

## Task 9: Build Generator Nodes and Anchored DOM Forms

**Files:**
- Create: `creoor/src/generators/generator-state.ts`
- Create: `creoor/src/generators/generator-state.test.ts`
- Create: `creoor/src/generators/anchor-placement.ts`
- Create: `creoor/src/generators/anchor-placement.test.ts`
- Create: `creoor/src/canvas/GeneratorNode.tsx`
- Create: `creoor/src/generators/GeneratorForm.tsx`
- Modify: `creoor/src/canvas/LogicalLayerRenderer.tsx`
- Modify: `creoor/src/app/CreoorApp.tsx`
- Modify: `creoor/src/data/mock-api.ts`

**Interfaces:**
- Produces: generator state reducer, `placeAnchor(nodeRect, formSize, viewport)`, Konva placeholder/result node, and anchored/detached DOM form.
- Consumes: Mock API, coordinate adapter, document reducer, DockablePanel behavior.

- [ ] **Step 1: Write generator state tests**

```ts
it("retains parameters and references after failure and retry", () => {
  const failed = transition(configuredGenerator(), { type: "failed", message: "Mock timeout" });
  const retried = transition(failed, { type: "retry" });
  expect(retried.status).toBe("queued");
  expect(retried.prompt).toBe(failed.prompt);
  expect(retried.referenceIds).toEqual(failed.referenceIds);
});
```

Cover empty, configured, queued, generating, partial, completed, paused, cancelled, failed, and retrying transitions.

- [ ] **Step 2: Write anchor placement tests**

Test below-by-default, flip above, shift left/right, viewport clamp, maximum form width, and detached mode.

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm --dir creoor test src/generators`

Expected: FAIL because generator logic is missing.

- [ ] **Step 4: Implement the Konva generator node**

Render title, dimensions, placeholder, progress, stage copy, error affordance, and completed fixture. Treat the node and anchored form as one selection/move unit for snapping.

- [ ] **Step 5: Implement the DOM generator form**

Include references, selection input, prompt, model, ratio, resolution, skill, Mock voice button, submit, collapse, expand, and detach. Use the coordinate adapter on every viewport/node change and flip the form to remain visible.

- [ ] **Step 6: Connect Mock lifecycle and copy behavior**

Copying duplicates parameters and reference IDs but sets status to `configured`; it never starts generation until submit.

- [ ] **Step 7: Run and commit**

Run: `pnpm --dir creoor test src/generators src/data/mock-api.test.ts && pnpm --dir creoor typecheck`

Expected: PASS.

```bash
git add creoor/src/generators creoor/src/canvas/GeneratorNode.tsx creoor/src/canvas/LogicalLayerRenderer.tsx creoor/src/data/mock-api.ts creoor/src/app/CreoorApp.tsx
git commit -m "feat(creoor): add anchored generator nodes"
```

## Task 10: Complete iPad Adaptation, Error Recovery, and Accessibility

**Files:**
- Modify: `creoor/src/app/app.css`
- Modify: `creoor/src/theme/components.css`
- Modify: `creoor/src/canvas/gestures.ts`
- Modify: `creoor/src/panels/DockablePanel.tsx`
- Modify: `creoor/src/agent/AgentComposer.tsx`
- Modify: `creoor/src/images/ImageActionMenu.tsx`
- Modify: `creoor/src/generators/GeneratorForm.tsx`
- Create: `creoor/src/app/CreoorApp.test.tsx`
- Create: `creoor/src/test/render-app.tsx`

**Interfaces:**
- Produces: responsive desktop/iPad workbench, keyboard operation, reduced-motion behavior, local error recovery, and an integrated acceptance suite.
- Consumes: all previous tasks.

- [ ] **Step 1: Write integrated accessibility and recovery tests**

```tsx
it("recovers a failed generator without losing its prompt", async () => {
  renderCreoor({ generatorScenario: "failure" });
  await userEvent.type(screen.getByRole("textbox", { name: "创作要求" }), "生成轻薄夏季连衣裙");
  await userEvent.click(screen.getByRole("button", { name: "开始生成" }));
  expect(await screen.findByText("生成失败")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "重试生成" }));
  expect(screen.getByRole("textbox", { name: "创作要求" })).toHaveValue("生成轻薄夏季连衣裙");
});
```

Add tests for keyboard opening/closing, Escape, focus restoration, deleted references, restore layout, and reduced-motion class application.

- [ ] **Step 2: Run integrated tests and verify failure**

Run: `pnpm --dir creoor test src/app/CreoorApp.test.tsx`

Expected: FAIL on missing accessibility/recovery behavior.

- [ ] **Step 3: Implement iPad layout and gesture conflict rules**

Use coarse-pointer media queries for 44px targets. Keep panel drag handles distinct from canvas gestures. Pen draws only when the brush tool is active; finger gestures pan/zoom; form inputs suppress canvas shortcuts.

- [ ] **Step 4: Implement keyboard and focus behavior**

Provide accessible names for icon-only buttons, visible focus rings, Escape to close transient layers, arrow-key navigation inside toolbars, shortcuts disabled while typing, and focus restoration to the invoking control.

- [ ] **Step 5: Implement local error states**

Add retry for recognition and generation, preserve inputs/references, clamp invalid panel positions, show deleted-reference snapshots, and avoid full-screen blocking errors.

- [ ] **Step 6: Apply reduced motion and contrast safeguards**

Disable elastic/transform transitions under reduced motion. Ensure selected/error/generating states include icon, text, or pattern in addition to color.

- [ ] **Step 7: Run full verification**

Run: `pnpm --dir creoor test && pnpm --dir creoor typecheck && pnpm --dir creoor build`

Expected: all commands PASS with no token-guard violations.

- [ ] **Step 8: Perform visual acceptance at target sizes**

Run: `pnpm --dir creoor dev --host 0.0.0.0`

Verify these exact viewports in the browser:

- Desktop: 1440×900.
- Wide desktop: 1920×1080.
- iPad landscape: 1194×834.
- iPad Pro landscape: 1366×1024.

At each size verify panel docking/floating/collapse, Agent resize, blank-canvas dismissal, pinch/pan or emulated touch, image action menu placement, `@` highlighting, generator form flipping, and no clipped controls.

- [ ] **Step 9: Commit**

```bash
git add creoor
git commit -m "feat(creoor): complete responsive workbench prototype"
```

## Task 11: Final Specification Trace and Handoff

**Files:**
- Create: `creoor/README.md`
- Create: `docs/development/creoor-acceptance.md`
- Modify: `README.md`

**Interfaces:**
- Produces: exact run instructions, Mock scenario catalog, acceptance checklist, architecture boundary notes, and known first-release exclusions.
- Consumes: completed prototype and design specification.

- [ ] **Step 1: Write the acceptance matrix**

Map each requirement in `docs/superpowers/specs/2026-07-28-creoor-workbench-design.md` to a test file or a numbered manual browser step. Include desktop, iPad, reduced motion, failure, retry, partial result, and restore-layout coverage.

- [ ] **Step 2: Document local commands and Mock scenarios**

Document:

```text
pnpm install
pnpm --dir creoor dev
pnpm --dir creoor test
pnpm --dir creoor typecheck
pnpm --dir creoor build
```

List the success, empty, recognition failure, generation failure, partial generation, and slow-network fixture switches.

- [ ] **Step 3: Document architecture boundaries and exclusions**

State that Konva owns canvas content, DOM owns product UI, React state is authoritative, and the prototype excludes real login/AI/collaboration, full landing page, advanced Pencil brush tuning, and complete dark/high-contrast themes.

- [ ] **Step 4: Run final clean verification**

Run: `pnpm --dir creoor test && pnpm --dir creoor typecheck && pnpm --dir creoor build && git diff --check`

Expected: all commands PASS and `git diff --check` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add README.md creoor/README.md docs/development/creoor-acceptance.md
git commit -m "docs: add creoor prototype handoff"
```
