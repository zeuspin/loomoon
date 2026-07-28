# Creoor Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, mock-backed Creoor fashion-design workbench whose two approved golden paths run end to end on desktop and iPad Safari.

**Architecture:** React DOM owns product UI and accessibility; react-konva owns canvas rendering through four fixed layers. `ProjectDocument`, workspace/session state, ephemeral interaction state, metadata persistence, and IndexedDB Blob storage are separate contracts. A single interaction controller arbitrates mouse, touch, and Pencil input, while a typed overlay adapter bridges Canvas, Stage, Client, and DOM portal coordinates.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Konva 10, react-konva 19, Vitest 3 with V8 coverage, Testing Library, Playwright, axe-core, jsdom, IndexedDB via `idb`, self-hosted Noto Sans SC/Inter WOFF2, CSS custom properties, PostCSS/TypeScript token guards, Motion, Lucide React plus vendored MIT Lucide Animated components.

## Global Constraints

- Create the frontend under repository-root `creoor/`; do not reuse Loomoon UI implementation files.
- Use Node.js 24+, pnpm 11.9.0, React 19, Konva 10, and react-konva 19.
- Mock-only: no real authentication, AI, image/video generation, microphone request, or user-asset network upload.
- Konva renders canvas content only; React DOM renders panels, forms, menus, dialogs, Agent UI, and the accessibility mirror.
- Persist metadata separately from binary assets. Documents store stable `assetId`; Blob data lives in IndexedDB.
- Only `ProjectDocument` canvas commands enter undo/redo. Layout, hover, selection preview, session switching, and async progress do not.
- Use four fixed Konva render layers; user-visible layers are a validated logical tree inside the content layer.
- UI code consumes theme tokens. Raw visual constants are allowed only in primitive token files.
- Implement light theme now; preserve semantic contracts for dark and high-contrast themes.
- Desktop targets are at least 36×36 CSS px; coarse-pointer targets are at least 44×44 CSS px.
- Support reduced motion, WCAG 2.2 AA, keyboard alternatives, iPad safe areas, VisualViewport, and soft keyboards.
- All browser tests wait for bundled fonts and durable state readiness; no runtime font or icon network requests are allowed.
- Every task uses TDD, runs its scoped tests plus typecheck, and ends in a focused commit.

## Requirement Traceability

| Requirement | Implementation tasks | Required evidence |
| --- | --- | --- |
| CR-PROD-001 | 0, 5, 8, 9, 12 | Both golden paths, signed screenshots and anonymized target-designer usability evidence |
| CR-DATA-001 | 1, 2, 3, 7, 9, 10 | Entity ownership, project CRUD, persistence and session-switch tests |
| CR-DATA-002 | 2, 3, 7, 9, 12 | IndexedDB round-trip, recovery, reachability GC, privacy and deletion UI tests |
| CR-PANEL-001 | 1, 7, 11, 12 | State transitions, four-panel browser behavior and keyboard alternatives |
| CR-PANEL-002 | 2, 7, 11, 12 | Profile persistence, mixed-input and responsive-device tests |
| CR-THEME-001 | 0, 1, 7, 11, 12 | Signed visual contract, local fonts, token graph, computed styles and screenshots |
| CR-CANVAS-001 | 3, 4, 6, 10, 11 | Tree invariants, coordinates, renderer integration and DOM mirror |
| CR-CANVAS-002 | 3, 4, 5, 6, 10 | Authoring, history, selection, alignment and generator editing tests |
| CR-CANVAS-003 | 6, 10 | Snap tables, minimap, zoom/grid/shortcut and generator snapping tests |
| CR-INPUT-001 | 4, 11, 12 | Pointer/wheel arbitration, mixed-device and browser tests |
| CR-INPUT-002 | 4, 12 | Synthetic controller tests plus real iPad/Pencil evidence |
| CR-IMAGE-001 | 5 | Import/recognition/tag-correction tests |
| CR-IMAGE-002 | 8, 9 | Capability contract, direct action and Agent-gated non-destructive action E2E |
| CR-AGENT-001 | 1, 3, 9 | Session CRUD, explicit payload isolation and clarification-gating tests |
| CR-AGENT-002 | 2, 3, 9 | Live/frozen/region refresh, deletion choice and reachable-asset tests |
| CR-LIB-001 | 2, 3, 8 | History/library persistence, reachability and provenance tests |
| CR-GEN-001 | 3, 10 | Full transition table and stale-event tests |
| CR-EXPORT-001 | 5, 8, 9, 12 | Selection/whole-work/annotation exports and real-browser CORS evidence |
| CR-A11Y-001 | 6, 7, 9, 10, 11, 12 | Canvas mirror, keyboard, focus, computed contrast and WCAG-tagged axe evidence |
| CR-PERF-001 | 12 | Recorded performance benchmark |
| CR-TEST-001 | 0, 1, 11, 12, 13 | Atomic trace gate, test runtimes, axe, three-browser, signed visual and device evidence |

---

## Task 0: Freeze Acceptance and Visual Evidence Before Code

**Files:**
- Create: `docs/development/creoor-acceptance.md`
- Create: `docs/development/creoor-acceptance.json`
- Create: `docs/development/creoor-performance-environment.md`
- Create: `docs/development/creoor-usability-protocol.md`
- Create: `docs/design/creoor-visual-baseline.md`
- Create: `docs/design/creoor-visual-approval-manifest.json`
- Create: `docs/governance/creoor-approval-policy.md`
- Create: `scripts/check-creoor-acceptance.mjs`
- Create: `scripts/check-creoor-acceptance.test.mjs`

**Interfaces:**
- Produces: parent/atomic requirement matrix, release/waiver policy, evidence directories, fixed environments and viewports, usability protocol, fixture names, visual approval workflow and borrow/do-not-copy rules.
- Consumes: `docs/superpowers/specs/2026-07-28-creoor-workbench-design.md`.

- [ ] **Step 1: Create the acceptance matrix with all 21 parent IDs and every atomic clause**

Use `creoor-acceptance.json` as the machine-readable source and generate the Markdown summary from it. Each row contains `parentCr`, unique `clause`, `task`, `automatedTest`, `manualStep`, `environment`, one `threshold`, `evidence[]` with content SHA-256, `gate`, `status`, and optional `waiverReceipt`. `Gate` is `release | waivable`; `Status` is `planned | passed | failed | waived`. Populate every parent and clause from §16; status starts `planned`, never blank. Parent rows are generated summaries only.

Mark the two golden paths, data loss/recovery, explicit Agent isolation, three-browser golden paths, WCAG, real iPad/Pencil and performance thresholds as `release`. A waiver is legal only for a clause marked `waivable` before Task 1 and must contain the fields and approvals in specification §15.2.

- [ ] **Step 2: Record the visual baseline contract**

Document the approved warm neutral palette, selected Noto Sans SC/Inter distribution versions, official source/license URLs and expected upstream checksums, panel radii, Miora-inspired spatial traits, forbidden copying, deterministic fixture names, and fixed viewports 1280×720, 1440×900, 1920×1080, 1194×834, 1366×1024. Task 0 approves the font selection contract, not files that do not exist yet. Task 1 must land those exact assets, verify their bytes against the frozen checksums and then record committed-file hashes. Freeze the rule that the first implementation is not automatically an approved screenshot baseline.

The visual manifest schema records fixture/version hash, font hashes, Chromium/OS/container version, viewport, masks, screenshot SHA-256 and a signed approval receipt. Baseline creation or update is rejected without product-owner approval; a plaintext approver name is never sufficient.

- [ ] **Step 3: Freeze usability and performance environments**

Copy specification §15.1 into a moderator protocol. Record the actual desktop benchmark hardware and Chromium build, plus the exact two iPad models, iPadOS/Safari builds, Pencil models, display zoom and access plan. Performance/iPad clauses cannot pass with blank or substituted environment fields. Do not collect participant identity or assets.

- [ ] **Step 4: Implement the acceptance and approval verifier**

`check-creoor-acceptance.mjs` supports `--phase=plan` and `--phase=release`. Both phases parse the specification and JSON source, require exactly 21 unique parent IDs, identical unique atomic-clause sets, one row per clause, legal gate/status combinations, non-empty fields and valid task mappings. Release additionally requires every release clause passed, every evidence path present with matching SHA-256, all waivers unexpired and complete, and all visual/waiver receipts cryptographically valid.

Approval identity comes from protected CI variables `CREOOR_BASELINE_COMMIT` and `CREOOR_APPROVER_PUBLIC_KEYS`, not editable repository text. Release mode verifies the Task 0 baseline commit is an ancestor, its acceptance gate classifications are unchanged, and Ed25519 receipt signatures match an allowed product/technical key. If protected variables or a valid receipt are absent, release mode fails; local development may use plan mode but cannot claim release acceptance. Document repository-owner setup and key rotation in the governance policy.

Test duplicate/missing parents, duplicate/missing clauses, empty thresholds, missing/hash-mismatched evidence, illegal `release+waived`, post-baseline gate downgrade, expired/incomplete waiver, unknown signer, bad signature and changed visual manifest. Run: `node --test scripts/check-creoor-acceptance.test.mjs && node scripts/check-creoor-acceptance.mjs --phase=plan`.

- [ ] **Step 5: Obtain baseline-contract approval and commit**

Product owner approves the acceptance schema, visual/font-source contract and recorded environments. Committed font-file hashes are verified in Task 1; candidate implementation screenshots remain unsigned until Task 12.

```bash
git add docs/development/creoor-acceptance.md docs/development/creoor-acceptance.json docs/development/creoor-performance-environment.md docs/development/creoor-usability-protocol.md docs/design/creoor-visual-baseline.md docs/design/creoor-visual-approval-manifest.json docs/governance/creoor-approval-policy.md scripts/check-creoor-acceptance.mjs scripts/check-creoor-acceptance.test.mjs
git commit -m "docs(creoor): establish acceptance baseline"
```

Repository owner then pins that exact commit as protected `CREOOR_BASELINE_COMMIT`, configures allowed approver public keys, and reruns plan mode in protected CI. Task 1 must not start until the protected run succeeds.

## Task 1: Scaffold Creoor, Core Contracts, Theme Governance, and Test Runtimes

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `creoor/package.json`
- Create: `creoor/tsconfig.json`
- Create: `creoor/vite.config.ts`
- Create: `creoor/vitest.config.ts`
- Create: `creoor/playwright.config.ts`
- Create: `creoor/index.html`
- Create: `creoor/src/main.tsx`
- Create: `creoor/src/app/CreoorApp.tsx`
- Create: `creoor/src/app/CreoorApp.test.tsx`
- Create: `creoor/src/app/app.css`
- Create: `creoor/src/assets/fonts/NotoSansSC-Variable.woff2`
- Create: `creoor/src/assets/fonts/Inter-Variable.woff2`
- Create: `creoor/src/assets/fonts/NotoSansSC-OFL.txt`
- Create: `creoor/src/assets/fonts/Inter-OFL.txt`
- Create: `creoor/src/contracts/types.ts`
- Create: `creoor/src/theme/primitives.css`
- Create: `creoor/src/theme/semantic.css`
- Create: `creoor/src/theme/components.css`
- Create: `creoor/src/theme/token-contract.ts`
- Create: `creoor/scripts/check-theme-tokens.mjs`
- Create: `creoor/scripts/check-critical-coverage.mjs`
- Create: `creoor/scripts/check-critical-coverage.test.mjs`
- Create: `creoor/src/theme/token-contract.test.ts`
- Create: `creoor/src/theme/font-contract.test.ts`
- Create: `creoor/src/test/setup.ts`
- Create: `creoor/src/test/font-readiness.ts`
- Create: `creoor/e2e/smoke.spec.ts`
- Modify: `docs/design/creoor-visual-approval-manifest.json`

**Interfaces:**
- Produces: exact domain IDs/enums, orthogonal `PanelState`, coordinate branded types, generator events, image/reference types, CSS token graph, Vitest and Playwright runtimes.
- Consumes: Task 0 visual and acceptance contracts.

- [ ] **Step 1: Create the minimal package and test configuration**

Add `creoor` to the workspace. Include `@vitejs/plugin-react`, React/Konva, `idb`, `lucide-react`, `motion`, Vitest, `@vitest/coverage-v8`, Testing Library, `fake-indexeddb`, `vitest-canvas-mock`, `@playwright/test`, `@axe-core/playwright`, `axe-core`, `jest-axe`, PostCSS, TypeScript and `@types/node`. Add scripts `dev`, `test`, `test:e2e`, `test:visual`, `test:coverage`, `coverage:check-critical`, `acceptance:plan`, `acceptance:check`, `tokens:check`, `typecheck`, and `build`; `test:coverage` runs `vitest run --coverage` with the V8 provider, and acceptance scripts call the Task 0 verifier in plan/release mode.

Configure global branches/functions/lines/statements thresholds at 80%. `check-critical-coverage.mjs` reads the JSON coverage report and requires each exact path below to exist in the repository, appear in the report, and have branch coverage ≥90%; an empty or wrong glob is a failure:

- `src/canvas/coordinates.ts`
- `src/canvas/snapping.ts`
- `src/panels/panel-layout.ts`
- `src/agent/reference-model.ts`
- `src/agent/context-builder.ts`
- `src/storage/metadata-store.ts`
- `src/storage/asset-store.ts`
- `src/generators/generator-machine.ts`

Unit-test the checker against a missing path, a missing coverage entry, 89.99% and 90%. `coverage:check-critical` runs after `test:coverage` once all target files exist; Task 1 runs only its checker fixture tests. Any threshold failure returns non-zero, not merely a report.

- [ ] **Step 2: Write failing contract tests**

```ts
it("does not serialize transient panel state", () => {
  const panel: PanelState = {
    placement: { kind: "docked", edge: "left", offset: 80, size: 320 },
    visibility: "peek",
    persistence: "auto",
    interaction: {
      kind: "dragging",
      origin: { kind: "floating", x: 0, y: 80, width: 320, height: 500 },
    },
  };
  expect(serializePanelState(panel)).toEqual({
    placement: panel.placement,
    visibility: "collapsed",
    persistence: "auto",
  });
});
```

Define `ProjectId`, `AssetId`, `NodeId`, `SessionId`, `ReferenceId`, `RequestId`, `CanvasPoint`, `StageLocalPoint`, `ClientPoint`, `OverlayPoint`, `ToolId`, `GeneratorStatus`, `PanelState`, `ProjectDocument`, `WorkspaceState`, `SessionState`, and `EphemeralInteractionState` in this task.

Also test that the app shell mounts its Stage/overlay hosts, displays the local-only disclosure, and has no network font/icon requests. Exclude pure type declarations, test setup and the `main.tsx` bootstrap from coverage rather than lowering thresholds.

- [ ] **Step 3: Run the red test**

Run: `pnpm --dir creoor test src/theme/token-contract.test.ts`

Expected: FAIL because serialization and tokens are not implemented.

- [ ] **Step 4: Implement theme files, deterministic fonts, and typed Konva accessors**

Only `primitives.css` contains raw values. Obtain the exact Task 0-approved font distributions, verify their bytes and licenses against the frozen upstream checksums, commit them, and record committed-file SHA-256 values in the visual manifest. Define local `@font-face` rules and use them through font-family tokens; no runtime font network request is allowed. Semantic aliases reference primitives; component/state aliases reference semantic/component values. `canvasTheme()` uses unitless numeric tokens and throws in development when a required token is missing.

`font-contract.test.ts` waits for `document.fonts.ready`, asserts both required faces pass `document.fonts.check()`, verifies representative Chinese and Latin controls resolve to the expected family, and fails if a font asset or license file is missing.

- [ ] **Step 5: Implement AST-based theme guard**

The checker parses CSS with PostCSS and TS/TSX with the TypeScript compiler API. It rejects raw colors in any syntax, raw font-size/radius/shadow/blur/duration/z-index outside primitives, inline visual constants, and Konva raw `fill`/`stroke`. Include negative fixtures proving every prohibited class fails.

- [ ] **Step 6: Add browser smoke**

Install browser binaries explicitly with `pnpm --dir creoor exec playwright install chromium firefox webkit`; CI Linux uses the equivalent `--with-deps` bootstrap. Playwright starts Vite, waits for `document.fonts.ready` plus application readiness, and checks Chromium, Firefox and WebKit load the shell with zero page errors, console errors or font-network requests.

- [ ] **Step 7: Verify and commit**

Run: `pnpm install && pnpm --dir creoor exec playwright install chromium firefox webkit && pnpm --dir creoor test && pnpm --dir creoor test:coverage && pnpm --dir creoor tokens:check && pnpm --dir creoor typecheck && pnpm --dir creoor build && pnpm --dir creoor test:e2e --grep smoke`

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml creoor docs/design/creoor-visual-approval-manifest.json
git commit -m "feat(creoor): scaffold contracts theme and test runtimes"
```

## Task 2: Implement Asset Blob Storage and Versioned Metadata Persistence

**Files:**
- Create: `creoor/src/storage/asset-store.ts`
- Create: `creoor/src/storage/asset-store.test.ts`
- Create: `creoor/src/storage/asset-reachability.ts`
- Create: `creoor/src/storage/asset-reachability.test.ts`
- Create: `creoor/src/storage/metadata-store.ts`
- Create: `creoor/src/storage/metadata-store.test.ts`
- Create: `creoor/src/storage/schema.ts`
- Create: `creoor/src/storage/migrations.ts`
- Create: `creoor/src/storage/save-status.tsx`

**Interfaces:**
- Produces: `putAsset(blob, metadata): Promise<AssetId>`, `getAsset(id)`, `computeReachableAssetIds(metadata, volatileAssetIds)`, `collectGarbage(reachableAssetIds)`, `loadWorkspace()`, `saveWorkspace()`, `flushWorkspace()`, migration and quota errors. Manual retain/release counters are not authoritative.
- Consumes: IDs and persistence DTOs from Task 1.

- [ ] **Step 1: Write IndexedDB round-trip and GC tests**

Use `fake-indexeddb`. Store a 12 MB Blob and reload it through a new store instance. Reference the same `assetId` from two projects, a private-library item, a creation-history item and a session snapshot. Assert GC retains it while any persisted or supplied volatile reference remains and deletes it only after the final reference disappears. Unknown or missing assets must not corrupt metadata loading.

- [ ] **Step 2: Write persistence failure tests**

Cover v0→v1 migration, unknown future version, malformed JSON backup, missing field, `QuotaExceededError`, storage disabled, 100 rapid writes, and `pagehide` flush. Assert the last valid document is never overwritten by a failed write.

- [ ] **Step 3: Run red tests**

Run: `pnpm --dir creoor test src/storage`

Expected: FAIL because stores are missing.

- [ ] **Step 4: Implement stores and visible save status**

Use project-specific metadata keys and a project index. Debounce by 250ms, flush on visibility/pagehide, expose `saving/saved/failed`, and back up corrupted payloads before recovery. Object URLs are revoked after image disposal.

Asset creation is two-phase: persist Blob first, then commit metadata. A failed metadata commit may leave an orphan but must not delete previously reachable assets; startup reconciliation may collect the orphan. Deletion commits metadata first and runs GC only after that commit succeeds.

- [ ] **Step 5: Implement deletion contracts**

Support delete-project metadata and clear-all-local-data primitives. Compute reachability across every project document, session reference snapshot, project creation-history item, private-library item and supplied volatile history asset IDs. Never GC from local counters alone; Task 7 provides the visible destructive-action UI.

- [ ] **Step 6: Verify and commit**

Run: `pnpm --dir creoor test src/storage && pnpm --dir creoor typecheck`

```bash
git add creoor/src/storage
git commit -m "feat(creoor): add durable local asset storage"
```

## Task 3: Implement Project Document Tree, History, Sessions, and Async Task Contracts

**Files:**
- Create: `creoor/src/domain/document-tree.ts`
- Create: `creoor/src/domain/document-tree.test.ts`
- Create: `creoor/src/domain/history.ts`
- Create: `creoor/src/domain/history.test.ts`
- Create: `creoor/src/domain/history-assets.ts`
- Create: `creoor/src/domain/history-assets.test.ts`
- Create: `creoor/src/domain/project-reducer.ts`
- Create: `creoor/src/domain/project-reducer.test.ts`
- Create: `creoor/src/data/fixtures.ts`
- Create: `creoor/src/data/mock-task-runner.ts`
- Create: `creoor/src/data/mock-task-runner.test.ts`

**Interfaces:**
- Produces: validated `parentId/childIds` tree, `HistoryState<ProjectDocument>`, transactional commands, project/session fixtures, cancellable `MockTaskHandle` with `requestId`.
- Consumes: Task 1 contracts and Task 2 asset IDs.

- [ ] **Step 1: Write tree invariant tests**

Test unique IDs, one parent, ordered children, cycle rejection, inherited hidden/locked state, and group/ungroup preserving world transform through three nested levels.

- [ ] **Step 2: Write history transaction tests**

Assert 300 drag frames commit one history entry; text edit commits once on blur/confirm; new commands clear redo; only 100 history entries remain; layout, hover, selection preview, session switch, and generator progress never enter history.

Expose `assetIdsInHistory(history)` over `past`, `present` and `future`. Undoing a node must not make its Blob collectible while redo still references it. Once redo is cleared or bounded history evicts the final reference, that asset may become collectible.

- [ ] **Step 3: Write async race tests with fake timers**

Cancel prevents completed; retry ignores the old request; deleting a generator ignores late events; StrictMode-style duplicate start is idempotent; all timers are cleared after unmount.

- [ ] **Step 4: Implement minimal reducers and fixtures**

Provide two projects, multiple CRUD-capable sessions, fashion assets for every tag family, seven libraries, partial/failure generator fixtures, provenance and license fields. The application-level GC coordinator unions persisted reachability from Task 2 with `assetIdsInHistory()` before invoking `collectGarbage()`.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --dir creoor test src/domain src/data && pnpm --dir creoor typecheck`

```bash
git add creoor/src/domain creoor/src/data
git commit -m "feat(creoor): add document history and task contracts"
```

## Task 4: Build Coordinate Adapters, Interaction Controller, and Konva Stage

**Files:**
- Create: `creoor/src/canvas/coordinates.ts`
- Create: `creoor/src/canvas/coordinates.test.ts`
- Create: `creoor/src/canvas/interaction-controller.ts`
- Create: `creoor/src/canvas/interaction-controller.test.ts`
- Create: `creoor/src/canvas/wheel-normalizer.ts`
- Create: `creoor/src/canvas/wheel-normalizer.test.ts`
- Create: `creoor/src/canvas/CanvasStage.tsx`
- Create: `creoor/src/canvas/LogicalTreeRenderer.tsx`
- Create: `creoor/src/canvas/OverlayRoot.tsx`
- Create: `creoor/e2e/canvas-input.spec.ts`
- Modify: `creoor/src/app/CreoorApp.tsx`

**Interfaces:**
- Produces: typed coordinate conversions, `nodeClientRect()`, one-owner pointer sequences, four-layer Stage, shared DOM overlay root.
- Consumes: Task 1 coordinate/tool contracts and Task 3 document tree.

- [ ] **Step 1: Write coordinate tests**

Cover round trips at scale 0.1/1/4, pointer-centered zoom, non-zero Stage rect, page scroll, rotated node bounds, VisualViewport offset, soft keyboard and safe-area. Maximum round-trip error is 0.01 canvas unit.

- [ ] **Step 2: Write the full input matrix tests**

Table-drive select/hand/brush/lasso × mouse/single-touch/two-touch/Pencil. Also cover mouse-wheel zoom, trackpad wheel, `ctrlKey` pinch-wheel, `deltaMode` pixel/line/page normalization, pointer-centered zoom, space/middle-button pan, horizontal DOM-panel scrolling, input suppression, second pointer join/leave, pointer capture, cancel, blur and one-owner-only behavior.

- [ ] **Step 3: Implement adapters and controller**

Use a single native pointer boundary around Stage; Konva handlers may report hit targets but cannot start a parallel gesture state machine. Attach a non-passive wheel listener only to the canvas interaction surface. Normalize deltas before bounded exponential zoom, preserve the canvas point beneath the client pointer, and call `preventDefault()` only when the canvas owns the wheel sequence. DOM inputs, menus and scrollable panels retain native scrolling. Use `touch-action: none` only on the canvas interaction surface.

- [ ] **Step 4: Render fixed layers and overlay root**

Render background, content, interaction and temporary Layers. Background is non-listening. Update DOM overlays through ResizeObserver + VisualViewport + rAF, at most one write per frame.

- [ ] **Step 5: Run browser input smoke and commit**

Run: `pnpm --dir creoor test src/canvas/coordinates.test.ts src/canvas/interaction-controller.test.ts src/canvas/wheel-normalizer.test.ts && pnpm --dir creoor test:e2e e2e/canvas-input.spec.ts && pnpm --dir creoor typecheck`

```bash
git add creoor/src/canvas creoor/e2e/canvas-input.spec.ts creoor/src/app/CreoorApp.tsx
git commit -m "feat(creoor): add canvas coordinates and input arbitration"
```

## Task 5: Implement Image Import, Recognition, Text, Brush, Lasso, and Export Foundations

**Files:**
- Create: `creoor/src/assets/image-import.ts`
- Create: `creoor/src/assets/image-import.test.ts`
- Create: `creoor/src/assets/recognition.ts`
- Create: `creoor/src/assets/recognition.test.ts`
- Create: `creoor/src/canvas/authoring.ts`
- Create: `creoor/src/canvas/authoring.test.ts`
- Create: `creoor/src/canvas/CanvasExportService.ts`
- Create: `creoor/src/canvas/CanvasExportService.test.ts`
- Create: `creoor/src/components/RecognitionBadge.tsx`
- Create: `creoor/e2e/fixtures/cors-image-server.ts`
- Create: `creoor/e2e/import-authoring-export.spec.ts`
- Modify: `creoor/src/app/CreoorApp.tsx`
- Modify: `creoor/src/canvas/CanvasStage.tsx`
- Modify: `creoor/src/canvas/LogicalTreeRenderer.tsx`
- Modify: `creoor/src/domain/project-reducer.ts`
- Modify: `creoor/src/domain/project-reducer.test.ts`
- Modify: `creoor/src/storage/metadata-store.ts`

**Interfaces:**
- Produces: imported image assets/nodes, Mock recognition lifecycle and editable tags, text/stroke/lasso commands, CORS-safe PNG export.
- Consumes: Tasks 2–4.

- [ ] **Step 1: Write import and recognition tests**

Cover PNG/JPEG/WebP, EXIF orientation, supported HEIC decoding path, unsupported HEIC conversion message, recognition queued/success/empty/failure/retry, user tag override, refresh recovery and asset quota failure.

- [ ] **Step 2: Write authoring history tests**

Create/edit text; draw mouse and Pencil strokes; make lasso and annotation regions; commit each pointer sequence once; undo restores stable IDs and deletes only the last transaction.

- [ ] **Step 3: Write selection, whole-work, annotation, and CORS export tests**

Export selection bounds and whole-work visible-node union at pixelRatio 1 and 2 with transparent and canvas backgrounds. Assert 32 canvas-unit whole-work padding; include visible locked nodes; exclude hidden nodes, Transformer, guides, selection UI and DOM overlays. Cover persistent annotation snapshots, empty selection, empty document, maximum-pixel rejection, rotated nodes and write failure with zero document mutation and zero empty download.

Run a second-origin fixture without `Access-Control-Allow-Origin` in Chromium and WebKit. Assert admission rejects that URL before Stage insertion, the canvas remains untainted, and a subsequent same-origin selection and whole-work export still succeeds.

- [ ] **Step 4: Implement minimal foundations**

Wire import, authoring and export commands through the real `CreoorApp` → reducer → `LogicalTreeRenderer` path. Set `crossOrigin="anonymous"` before approved image sources. Public fixtures are same-origin. Mock recognition is visibly labeled “演示识别”; user tags override Mock tags. E2E may not invoke domain functions directly as a substitute for UI integration.

- [ ] **Step 5: Run golden-path foundation E2E**

Import image → recognition → correct tag → create text/stroke/annotation → export selection PNG → export whole-work PNG → reload and verify all durable objects. Assert both files use their specified bounds and contain no editor UI.

- [ ] **Step 6: Verify and commit**

Run: `pnpm --dir creoor test src/assets src/canvas/authoring.test.ts src/canvas/CanvasExportService.test.ts && pnpm --dir creoor test:e2e e2e/import-authoring-export.spec.ts && pnpm --dir creoor typecheck`

```bash
git add creoor/src/assets creoor/src/canvas creoor/src/components creoor/src/app/CreoorApp.tsx creoor/src/domain/project-reducer.ts creoor/src/domain/project-reducer.test.ts creoor/src/storage/metadata-store.ts creoor/e2e/import-authoring-export.spec.ts creoor/e2e/fixtures/cors-image-server.ts
git commit -m "feat(creoor): add core canvas authoring and import"
```

## Task 6: Add Selection, Snapping, Logical Layers, Minimap, and Canvas Utilities

**Files:**
- Create: `creoor/src/canvas/snapping.ts`
- Create: `creoor/src/canvas/snapping.test.ts`
- Create: `creoor/src/canvas/alignment.ts`
- Create: `creoor/src/canvas/alignment.test.ts`
- Create: `creoor/src/canvas/SelectionOverlay.tsx`
- Create: `creoor/src/panels/CanvasUtilityPanel.tsx`
- Create: `creoor/src/panels/LogicalLayerTree.tsx`
- Create: `creoor/e2e/canvas-editing.spec.ts`
- Modify: `creoor/src/app/CreoorApp.tsx`
- Modify: `creoor/src/canvas/CanvasStage.tsx`
- Modify: `creoor/src/canvas/LogicalTreeRenderer.tsx`
- Modify: `creoor/src/domain/project-reducer.ts`
- Modify: `creoor/src/domain/project-reducer.test.ts`

**Interfaces:**
- Produces: grid/object/center/rotation snapping, multi-select, Transformer normalization, alignment/distribution, accessible logical tree, minimap/navigation, grid/zoom/shortcut controls.
- Consumes: Tasks 3–5.

- [ ] **Step 1: Write table-driven geometry tests**

At scale 0.1/1/4 assert a 6 screen-pixel snap threshold. Test grid, object edge/center, rotation, disabled snapping, all alignment/distribution modes to 0.01 canvas-unit tolerance, Transformer min size and normalized width/height.

- [ ] **Step 2: Write tree and history integration tests**

Hidden nodes do not hit; locked nodes cannot transform; group/ungroup preserves world transforms; logical tree keyboard actions update Canvas; one drag is one undo item.

- [ ] **Step 3: Implement utilities**

Minimap shows world bounds and viewport rectangle, click navigates; grid toggle and size, snap toggle, zoom controls, fit selection, layer CRUD and shortcut help are functional rather than visual-only.

- [ ] **Step 4: Run browser editing E2E and commit**

Run: `pnpm --dir creoor test src/canvas/snapping.test.ts src/canvas/alignment.test.ts src/domain && pnpm --dir creoor test:e2e e2e/canvas-editing.spec.ts && pnpm --dir creoor typecheck`

```bash
git add creoor/src/canvas creoor/src/panels creoor/src/app/CreoorApp.tsx creoor/src/domain/project-reducer.ts creoor/src/domain/project-reducer.test.ts creoor/e2e/canvas-editing.spec.ts
git commit -m "feat(creoor): add canvas editing utilities"
```

## Task 7: Implement Orthogonal Dockable Panels and Tool Surfaces

**Files:**
- Create: `creoor/src/panels/panel-machine.ts`
- Create: `creoor/src/panels/panel-machine.test.ts`
- Create: `creoor/src/panels/panel-layout.ts`
- Create: `creoor/src/panels/panel-layout.test.ts`
- Create: `creoor/src/panels/DockablePanel.tsx`
- Create: `creoor/src/panels/UserProjectPanel.tsx`
- Create: `creoor/src/panels/UserProjectPanel.test.tsx`
- Create: `creoor/src/projects/project-controller.ts`
- Create: `creoor/src/projects/project-controller.test.ts`
- Create: `creoor/src/panels/DataManagementDialog.tsx`
- Create: `creoor/src/panels/DataManagementDialog.test.tsx`
- Create: `creoor/src/panels/AgentPanel.tsx`
- Create: `creoor/src/tools/tool-registry.ts`
- Create: `creoor/src/tools/ToolRail.tsx`
- Create: `creoor/src/tools/ToolRail.test.tsx`
- Create: `creoor/src/tools/BrushPopover.tsx`
- Create: `creoor/src/icons/animated/LICENSE`
- Create: `creoor/src/icons/animated/SelectAnimatedIcon.tsx`
- Create: `creoor/src/icons/animated/HandAnimatedIcon.tsx`
- Create: `creoor/src/icons/animated/BrushAnimatedIcon.tsx`
- Create: `creoor/src/icons/animated/LassoAnimatedIcon.tsx`
- Create: `creoor/src/icons/animated/TextAnimatedIcon.tsx`
- Create: `creoor/src/icons/animated/UploadAnimatedIcon.tsx`
- Create: `creoor/src/icons/animated/index.ts`
- Create: `creoor/e2e/panels-tools.spec.ts`
- Create: `creoor/e2e/projects-privacy.spec.ts`
- Modify: `creoor/src/app/CreoorApp.tsx`
- Modify: `creoor/src/app/app.css`
- Modify: `creoor/src/theme/components.css`
- Modify: `creoor/src/storage/metadata-store.ts`
- Modify: `creoor/src/storage/asset-reachability.ts`
- Modify: `creoor/src/data/mock-task-runner.ts`

**Interfaces:**
- Produces: legal panel transition machine, measured collision/clamp layout, four primary panels, compact/expanded tool rail and detachable brush settings.
- Consumes: Tasks 1–6 and persistence from Task 2.

- [ ] **Step 1: Test every legal and representative illegal transition**

Cover dock/floating + collapse/peek/pinned, blank click, Escape, drag/cancel/pointercancel, resize, refresh serialization and restoring pre-drag state.

- [ ] **Step 2: Test measured layout**

Use width and height. Cover four edges, collision avoidance, viewport resize, safe area, Agent widths 300–560 desktop and 280–420 iPad, and ≤1 CSS px geometry tolerance. Measure and test the resizable Agent panel shell created in this task; Task 9 fills it with session content.

- [ ] **Step 3: Implement project, privacy, primary-panel, and tool UI**

Mount exactly four primary surfaces in `CreoorApp`: `UserProjectPanel`, `ToolRail`, `CanvasUtilityPanel`, and a resizable `AgentPanel` shell. `UserProjectPanel` shows the current project, last-output thumbnail, recent/searchable projects, visible save state, an always-visible “仅存于此浏览器” badge and expandable shared-device guidance.

Implement these flows through `project-controller`, not component-local state: create, trimmed non-empty rename, duplicate-name disambiguation, switch-after-successful-flush, save-failure blocking switch, delete cancel/confirm, active Mock-task cancellation, cross-project/library asset preservation, last-project replacement and refresh recovery. Test cover selection and recomputation in the order successful derived result → imported image → themed fallback, with no Blob duplication. The controller commits metadata before reachable-asset GC and ignores cancelled-task late events. The project menu exposes delete-current-project; data management opens `DataManagementDialog` for clear-all-local-data. Destructive dialogs list exact scope, make zero writes on cancel, restore focus, and announce completion/failure through `aria-live`.

Register only tools whose behavior exists after Tasks 4–6: select, hand, brush, lasso/annotation, text and upload. Do not yet register image generator, history, libraries or public inspiration. Compact mode shows icons; expanded mode shows Chinese labels and shortcuts.

- [ ] **Step 4: Vendor animated icons**

Copy only used MIT Lucide Animated source components into `creoor/src/icons/animated/` and include the upstream license. Use the Task 1 `motion` runtime. Replace embedded color, duration and easing constants with typed theme/motion tokens so the token guard passes. Reduced motion renders static Lucide or necessary opacity-only feedback; there is no runtime CLI/network.

- [ ] **Step 5: Browser test and commit**

Browser assertions prove all four primary panels are mounted, Agent resize works, project/privacy flows are durable, and every visible tool performs a real action. Assert image-generator/history/library/inspiration entries are absent at this task boundary.

Run: `pnpm --dir creoor test src/panels src/projects src/tools && pnpm --dir creoor test:e2e e2e/panels-tools.spec.ts e2e/projects-privacy.spec.ts && pnpm --dir creoor typecheck`

```bash
git add creoor/src/panels creoor/src/projects creoor/src/tools creoor/src/icons creoor/src/app creoor/src/theme/components.css creoor/src/storage creoor/src/data/mock-task-runner.ts creoor/e2e/panels-tools.spec.ts creoor/e2e/projects-privacy.spec.ts
git commit -m "feat(creoor): add dockable panels and tools"
```

## Task 8: Implement Image Capability Actions, Provenance Libraries, and Non-Destructive Results

**Files:**
- Create: `creoor/src/images/capability-ast.ts`
- Create: `creoor/src/images/image-capabilities.ts`
- Create: `creoor/src/images/image-capabilities.test.ts`
- Create: `creoor/src/images/ImageActionMenu.tsx`
- Create: `creoor/src/images/ImageActionMenu.test.tsx`
- Create: `creoor/src/images/LibraryPanel.tsx`
- Create: `creoor/src/images/LibraryPanel.test.tsx`
- Create: `creoor/src/images/action-runner.ts`
- Create: `creoor/src/images/action-runner.test.ts`
- Create: `creoor/e2e/image-actions.spec.ts`
- Modify: `creoor/src/app/CreoorApp.tsx`
- Modify: `creoor/src/canvas/SelectionOverlay.tsx`
- Modify: `creoor/src/domain/project-reducer.ts`
- Modify: `creoor/src/domain/project-reducer.test.ts`
- Modify: `creoor/src/tools/tool-registry.ts`
- Modify: `creoor/src/storage/schema.ts`
- Modify: `creoor/src/storage/metadata-store.ts`
- Modify: `creoor/src/storage/asset-reachability.test.ts`

**Interfaces:**
- Produces: predicate AST, applicability IDs, menu union/intersection/all, creation-history/private/public IA, provenance and derived-node runner.
- Consumes: Tasks 2, 3, 5–7.

- [ ] **Step 1: Write exhaustive capability contract tests**

Enumerate 100% of approved tag and action IDs, Chinese labels and predicates. Cover unknown/empty/multi-tag images, single union, multi intersection, and `allActionsWithApplicability()` returning exact `applicableImageIds`.

- [ ] **Step 2: Write non-destructive runner tests**

Assert confirmation causes zero calls before approval; derived results preserve source, land to the right, keep original, undo removes derived result, and partial success allows per-item retry.

- [ ] **Step 3: Implement information architecture and provenance**

Separate undo/redo, project creation history, cross-project private library and read-only public library. Show source/license/portrait permission and “仅演示/可导出”. Saving to private library retains provenance. Persist creation-history and private-library asset references, include them in reachability GC, mount both surfaces, and only then register `history` and `libraries` in `tool-registry`.

- [ ] **Step 4: Run the complete direct image-action foundation E2E**

Import → recognize/correct → open the image capability menu → choose change-fabric → confirm applicability → Mock derived image beside source → compare → save library → export. Drive the real `CreoorApp`, reducer, renderer, storage and tool entry; do not call domain helpers directly. This validates direct actions; the approved Agent-clarification golden path is completed in Task 9.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --dir creoor test src/images && pnpm --dir creoor test:e2e e2e/image-actions.spec.ts && pnpm --dir creoor typecheck`

```bash
git add creoor/src/images creoor/src/app/CreoorApp.tsx creoor/src/canvas/SelectionOverlay.tsx creoor/src/domain/project-reducer.ts creoor/src/domain/project-reducer.test.ts creoor/src/tools/tool-registry.ts creoor/src/storage creoor/e2e/image-actions.spec.ts
git commit -m "feat(creoor): add non-destructive fashion actions"
```

## Task 9: Implement Agent Session CRUD and Durable Explicit References

**Files:**
- Create: `creoor/src/agent/reference-model.ts`
- Create: `creoor/src/agent/reference-model.test.ts`
- Create: `creoor/src/agent/context-builder.ts`
- Create: `creoor/src/agent/context-builder.test.ts`
- Create: `creoor/src/agent/mention-model.ts`
- Create: `creoor/src/agent/mention-model.test.ts`
- Create: `creoor/src/agent/conversation-runner.ts`
- Create: `creoor/src/agent/conversation-runner.test.ts`
- Create: `creoor/src/agent/ReferenceTray.tsx`
- Create: `creoor/src/agent/AgentComposer.tsx`
- Create: `creoor/src/agent/ConversationList.tsx`
- Create: `creoor/src/agent/ConversationList.test.tsx`
- Create: `creoor/src/agent/ClarificationMessage.tsx`
- Create: `creoor/src/domain/session-reducer.ts`
- Create: `creoor/src/domain/session-reducer.test.ts`
- Create: `creoor/e2e/agent-references.spec.ts`
- Create: `creoor/e2e/agent-clarification.spec.ts`
- Modify: `creoor/src/panels/AgentPanel.tsx`
- Modify: `creoor/src/app/CreoorApp.tsx`
- Modify: `creoor/src/images/action-runner.ts`
- Modify: `creoor/src/storage/schema.ts`
- Modify: `creoor/src/storage/metadata-store.ts`
- Modify: `creoor/src/storage/asset-reachability.ts`
- Modify: `creoor/src/storage/asset-reachability.test.ts`

**Interfaces:**
- Produces: session CRUD, structured mention tokens, live/frozen/region references, durable snapshots, explicit Mock payload builder, cancellable conversation runner, clarification messages with one to three typed action proposals, prompt expansion and skill selection.
- Consumes: Tasks 2–8.

- [ ] **Step 1: Write reference lifecycle tests**

Cover refresh, rename, source mutation, region snapshot and cross-session isolation. For source deletion, test preserve-snapshot, cascade-delete and cancel paths: no option is preselected; cancel makes zero mutations; preserve converts live references and marks the source deleted; cascade removes references from future Mock payloads and garbage-collects only unreachable snapshot Blobs. Cover clear-project GC separately.

- [ ] **Step 2: Prove explicit isolation**

Build a fixture with 100 canvas objects and 3 explicit references. Spy on Mock payload and assert exactly those three IDs/allowed attributes appear; unreferenced occurrence count is zero.

- [ ] **Step 3: Test structured Chinese mentions**

Return token range, reference ID, suffix and ambiguity. Cover duplicate names, longest match, `@图1的版型`, selection regions and IME composition without corrupting text.

- [ ] **Step 4: Test clarification gating and action handoff**

An ambiguous fashion prompt returns one to three clarification proposals. Each contains a stable proposal ID, explicit reference IDs, action ID and editable parameters. Selecting a proposal creates a pending action confirmation but makes zero image-action calls. Confirming applicability invokes `action-runner` exactly once with only the approved `applicableImageIds`. Cancel, session switch, retry and stale request events cannot execute a proposal.

- [ ] **Step 5: Implement session, conversation runner, and composer UI**

Wire the real `AgentPanel` shell, `CreoorApp`, session reducer, `action-runner` and persistence. Support new/rename/switch/delete, reference tray/count, prompt expansion, skill selection and Mock voice transcription without requesting microphone permission. Render normal, clarification, pending-confirmation, partial, failed and retry states. Clarification chips are keyboard accessible. Hover/focus cross-highlighting aligns within 2 CSS px. E2E may not call the runner or action domain functions directly.

- [ ] **Step 6: Run both approved Agent golden-path E2Es**

1. Import garment → recognize/correct → add explicit reference → send ambiguous change-fabric/change-pattern prompt → assert zero action calls → choose clarification → confirm applicability → assert one scoped action → derived result beside source → save library → export.
2. Draw annotation → create persistent region snapshot → structured `@` reference → send → reload → verify message and snapshot → test source deletion cancel, then preserve option.

- [ ] **Step 7: Verify and commit**

Run: `pnpm --dir creoor test src/agent src/domain/session-reducer.test.ts && pnpm --dir creoor test:e2e e2e/agent-references.spec.ts e2e/agent-clarification.spec.ts && pnpm --dir creoor typecheck`

```bash
git add creoor/src/agent creoor/src/domain/session-reducer.ts creoor/src/domain/session-reducer.test.ts creoor/src/panels/AgentPanel.tsx creoor/src/app/CreoorApp.tsx creoor/src/images/action-runner.ts creoor/src/storage creoor/e2e/agent-references.spec.ts creoor/e2e/agent-clarification.spec.ts
git commit -m "feat(creoor): add durable agent references"
```

## Task 10: Build Generator Nodes and Anchored DOM Forms

**Files:**
- Create: `creoor/src/generators/generator-machine.ts`
- Create: `creoor/src/generators/generator-machine.test.ts`
- Create: `creoor/src/generators/anchor-placement.ts`
- Create: `creoor/src/generators/anchor-placement.test.ts`
- Create: `creoor/src/canvas/GeneratorNode.tsx`
- Create: `creoor/src/generators/GeneratorForm.tsx`
- Create: `creoor/src/generators/GeneratorForm.test.tsx`
- Create: `creoor/src/generators/generator-integration.test.tsx`
- Create: `creoor/e2e/generator.spec.ts`
- Modify: `creoor/src/app/CreoorApp.tsx`
- Modify: `creoor/src/canvas/CanvasStage.tsx`
- Modify: `creoor/src/canvas/LogicalTreeRenderer.tsx`
- Modify: `creoor/src/canvas/SelectionOverlay.tsx`
- Modify: `creoor/src/domain/project-reducer.ts`
- Modify: `creoor/src/domain/project-reducer.test.ts`
- Modify: `creoor/src/canvas/snapping.ts`
- Modify: `creoor/src/tools/tool-registry.ts`
- Modify: `creoor/src/storage/schema.ts`

**Interfaces:**
- Produces: complete generator state/action table, requestId race protection, fixed-scale anchored/detached form and project-owned generator nodes.
- Consumes: Tasks 2–9.

- [ ] **Step 1: Test 100% legal transitions and representative illegal transitions**

Cover empty/configured/queued/generating/paused/partial/completed/failed/cancelled/retrying. Illegal transitions preserve state and report a development error. Fake timers must end with zero pending timers.

- [ ] **Step 2: Test every visible state action**

Assert queued cancel; generating pause/cancel; paused resume/cancel; partial accept/fill-missing/retry-all; failed retry/edit/delete; completed regenerate/copy/save/export; cancelled resubmit/delete.

- [ ] **Step 3: Test placement at 0.1×/1×/4×**

Use screen node bounds and 320–560px form limits; test below/above/side flip, VisualViewport, safe area, keyboard, detached mode and no flip oscillation.

Anchored-form placement is presentation state and never enters undo history. Detaching the form changes workspace/panel state without changing generator canvas geometry.

- [ ] **Step 4: Test generator canvas editing semantics**

Creating through the generator tool inserts a project-owned logical-tree node with stable `NodeId` and `GeneratorId`. Dragging updates its `CanvasPoint`, the DOM form follows within 2 CSS px, snapping uses Konva node bounds rather than the DOM form, and the complete drag creates one history transaction. Transformer commits normalized dimensions. Copy creates fresh IDs, preserves parameters/reference IDs, sets `configured`, clears `requestId` and starts zero Mock tasks. Delete aborts active work; late events are ignored. Undo/redo restores node and asset references. Reload preserves parameters/references and changes queued/generating to paused.

- [ ] **Step 5: Integrate the generator and stale-event protection**

Wire `GeneratorNode` into `LogicalTreeRenderer`, selection, snapping, project reducer, persistence and `CreoorApp`. Async progress is accepted only for the current requestId and never creates history entries; create/move/resize/copy/delete use normal history transactions. Register `image-generator` only after UI creation is wired. Copy returns to configured; refresh changes queued/generating to paused.

- [ ] **Step 6: Browser E2E and commit**

Drive create, configure, move/snap, detach/reattach, copy, run, cancel/retry, delete, undo/redo and reload through the real UI.

Run: `pnpm --dir creoor test src/generators src/domain/project-reducer.test.ts && pnpm --dir creoor test:e2e e2e/generator.spec.ts && pnpm --dir creoor typecheck`

```bash
git add creoor/src/generators creoor/src/canvas creoor/src/domain/project-reducer.ts creoor/src/domain/project-reducer.test.ts creoor/src/app/CreoorApp.tsx creoor/src/tools/tool-registry.ts creoor/src/storage/schema.ts creoor/e2e/generator.spec.ts
git commit -m "feat(creoor): add resilient generator nodes"
```

## Task 11: Complete Keyboard, Accessibility, and Responsive Degradation

**Files:**
- Create: `creoor/src/accessibility/CanvasMirror.tsx`
- Create: `creoor/src/accessibility/CanvasMirror.test.tsx`
- Create: `creoor/e2e/accessibility.spec.ts`
- Create: `creoor/e2e/responsive.spec.ts`
- Modify: `creoor/src/app/CreoorApp.tsx`
- Modify: `creoor/src/app/app.css`
- Modify: all interactive panels and menus from Tasks 6–10.

**Interfaces:**
- Produces: DOM mirror, keyboard alternatives, focus restoration, aria-live statuses, coarse/fine input adaptation, portrait/narrow fallback.
- Consumes: all UI tasks.

- [ ] **Step 1: Implement and test Canvas mirror**

Keyboard/screen reader users can locate, select, rename, hide, lock, delete, micro-move and reorder visible objects. Hidden nodes are not focusable; DOM order follows logical order.

- [ ] **Step 2: Add keyboard alternatives for panels**

Provide commands to move/dock panels, resize Agent, restore layout and close transient layers. Escape closes peek/menu and restores focus to invoker; pinned panels remain.

- [ ] **Step 3: Add responsive degradation**

Layout profile derives from available size and explicit preference, not one pointer query. `any-pointer/any-hover` adjusts targets and animation only. Test touch Windows, iPad external mouse, split screen, rotation, 200% zoom, safe area and soft keyboard. Narrow/portrait uses one-panel mode with a landscape suggestion.

- [ ] **Step 4: Run WCAG-tagged axe, computed contrast, and keyboard E2E**

In default, menu, error, generating and completed states, run axe with `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`, and `wcag22aa`; all returned violations are zero without impact filtering or disabling `color-contrast`. The Canvas DOM mirror is in scope. Assert actual computed foreground/background combinations meet 4.5:1 body or 3:1 large-text/control/focus thresholds, coarse/fine target sizes, `aria-live`, focus restoration and the complete keyboard golden path.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --dir creoor test src/accessibility && pnpm --dir creoor test:e2e e2e/accessibility.spec.ts e2e/responsive.spec.ts && pnpm --dir creoor typecheck`

```bash
git add creoor/src/accessibility creoor/src/app creoor/src/panels creoor/src/tools creoor/src/images creoor/src/agent creoor/src/generators creoor/e2e/accessibility.spec.ts creoor/e2e/responsive.spec.ts
git commit -m "feat(creoor): add accessible responsive interaction"
```

## Task 12: Run Cross-Browser Visual, Performance, and Real iPad Acceptance

**Files:**
- Create: `creoor/e2e/golden-paths.spec.ts`
- Create: `creoor/e2e/visual.spec.ts`
- Create: `creoor/e2e/performance.spec.ts`
- Create: `creoor/e2e/fixtures/performance-document.ts`
- Create: `creoor/e2e/fixtures/performance-trace.json`
- Create: `creoor/src/performance/benchmark-runner.ts`
- Create: `creoor/src/performance/benchmark-runner.test.ts`
- Create: `docs/development/creoor-ipad-evidence.md`
- Create: `docs/development/creoor-performance-evidence.md`
- Create: `docs/development/creoor-usability-evidence.md`
- Modify: `docs/development/creoor-acceptance.md`
- Modify: `docs/design/creoor-visual-approval-manifest.json`

**Interfaces:**
- Produces: three-browser evidence, screenshots/diffs, metrics, iPad/Pencil manual record, complete requirement matrix.
- Consumes: completed prototype.

- [ ] **Step 1: Run both golden paths in all browser projects**

Chromium, Firefox and WebKit must finish both approved golden paths from the real `CreoorApp` UI with zero uncaught exception, zero console error and zero failed assertion. The garment-variation path must assert no image action before Agent clarification and exactly one scoped action after confirmation.

- [ ] **Step 2: Capture deterministic visual baselines**

Use only the fixed `chromium-visual` CI project for pixel baselines; Firefox and WebKit keep functional and geometric assertions. Before capture, await `document.fonts.ready`, assert the committed Noto Sans SC and Inter files are active, assert zero font-network requests, and wait for durable app state. Capture all five fixed viewports with deterministic data and only manifest-declared masks. Assert no horizontal overflow, clipped controls, complete panel overlap or Konva-clipped DOM overlay.

The first candidate images and every later baseline change require product-owner review. Record fixture/version hash, font hashes, Chromium/OS/container version, viewport, masks, screenshot SHA-256 and a signed approval receipt in the manifest. A manifest or baseline hash change without a valid new signature fails. After approval, apply ≤0.2% pixel diff to each screenshot independently.

- [ ] **Step 3: Run performance fixture**

Use the production build, fixed random seed, Task 0 environments and the 1000-node/500-stroke/50-reference/20-generator fixture. Commit a 60-second trace whose events specify timestamp, action, target ID, start/end coordinates or scale, duration and settle point. The benchmark runner replays the exact same trace on desktop and iPad; unit tests assert duration, event count/order, fixed target resolution and trace hash. Manual Pencil gestures remain separate.

Desktop Chromium: 2 warmups, then 5 independent trace replays; rAF FPS, pointer-to-post-commit-rAF input latency, CDP `JSHeapUsedSize` after requested GC and app-ready TTI mark. The five-run median must meet FPS ≥55, input p95 <100ms, memory growth ≤20% and TTI <2s.

On each approved iPad class, run Safari Web Inspector plus application rAF/event logs after 2 warmups for 3 independent 60-second runs. The three-run median must meet FPS ≥45 and input p95 <150ms. Record iPad memory/TTI trend without comparing absolute values to desktop. Write raw samples, aggregation, fixture/build hash and environment identity to `creoor-performance-evidence.md`; changed hardware/browser requires a new approved baseline.

- [ ] **Step 4: Perform real iPad Safari + Pencil acceptance**

Use both Task 0 target device classes; 1194×834 and 1366×1024 are screen CSS sizes, not forced VisualViewport dimensions. Record exact model, iPadOS/Safari build, Pencil model, display zoom, toolbar state and actual VisualViewport. Repeat each approved gesture 20 times. Video/event logs must prove zoom-center drift ≤2px, no accidental drawing/page scroll/browser zoom, panel handles never move canvas, and Pencil draws only in brush/lasso modes. Every Pencil sequence includes `pointerType === "pen"`, at least one `pressure > 0` event and finite `tiltX/tiltY`. Any failure or unavailable target device leaves the release clause failed.

- [ ] **Step 5: Run target-designer usability acceptance**

Run specification §15.1 with at least five independent fashion designers. Record only anonymous participant IDs, task completion, elapsed time, critical errors, moderator interventions and conclusions in `creoor-usability-evidence.md`; retain no participant assets or identity. `CR-PROD-001.A04` passes only when every stated threshold passes.

- [ ] **Step 6: Complete atomic acceptance and waiver gates**

Every `release` clause is `passed`; it cannot be waived. Only clauses marked `waivable` before Task 1 may be `waived`, with measured value, impact, reason, cryptographic product/technical signatures, issue, evidence and expiry ≤14 days. Expired or incomplete waivers, any `planned`/`failed` release clause, missing evidence, or parent/atomic set mismatch blocks delivery.

- [ ] **Step 7: Verify locally, commit the candidate, then pass protected release CI**

Before commit, run: `pnpm --dir creoor test:coverage && pnpm --dir creoor coverage:check-critical && pnpm --dir creoor tokens:check && pnpm --dir creoor typecheck && pnpm --dir creoor build && pnpm --dir creoor test:e2e && pnpm --dir creoor acceptance:plan && git diff --check`. Plan mode validates clause sets, fields and every present evidence hash but does not pretend to possess protected signer identity.

```bash
git add creoor/e2e creoor/src/performance docs/development/creoor-acceptance.md docs/development/creoor-acceptance.json docs/development/creoor-ipad-evidence.md docs/development/creoor-performance-evidence.md docs/development/creoor-usability-evidence.md docs/design/creoor-visual-approval-manifest.json
git commit -m "test(creoor): complete cross-platform acceptance"
git status --porcelain # expected: no output
```

Push the candidate branch. Protected CI, with repository-owner variables, runs the same tests plus `pnpm --dir creoor acceptance:check`; configure it as a required merge check. Signature, baseline, waiver or release-status failures require a corrective commit and another protected run. Never require release mode to pass before the candidate commit exists.

## Task 13: Final Handoff Documentation

**Files:**
- Create: `creoor/README.md`
- Modify: `README.md`
- Modify: `docs/development/creoor-acceptance.md`

**Interfaces:**
- Produces: exact commands, Mock scenario catalog, storage/privacy disclosure, architecture boundaries, known exclusions and evidence links.
- Consumes: Task 12 results.

- [ ] **Step 1: Document commands and deterministic scenarios**

Document install/dev/test/coverage/E2E/token/typecheck/build commands and switches for success, empty, slow, recognition failure, generation failure, partial and quota failure. Include the one-time `pnpm --dir creoor exec playwright install chromium firefox webkit` bootstrap and Linux `--with-deps` variant. Document the committed font assets/licenses, Lucide Animated source/license, `motion` runtime, V8 coverage provider, exact visual-readiness wait, protected approval-variable setup, signed receipt flow, and how coverage/acceptance gates fail.

- [ ] **Step 2: Document privacy and data controls**

Explain local-only private meaning, IndexedDB/localStorage split, shared-device risk, delete project, clear all data, public fixture licensing and no microphone/network upload.

- [ ] **Step 3: Document architecture and exclusions**

State Konva/DOM boundary, state partitions, asset IDs, four layers, input controller, and exclusions: real AI/login/collaboration, full landing/inspiration, audio/video nodes, advanced Pencil tuning, complete dark/high-contrast themes.

- [ ] **Step 4: Final local verification, candidate commit, and protected check**

Before commit, run: `pnpm --dir creoor test:coverage && pnpm --dir creoor coverage:check-critical && pnpm --dir creoor tokens:check && pnpm --dir creoor typecheck && pnpm --dir creoor build && pnpm --dir creoor test:e2e && pnpm --dir creoor acceptance:plan && git diff --check`.

```bash
git add README.md creoor/README.md docs/development/creoor-acceptance.md
git commit -m "docs: hand off creoor workbench prototype"
git status --porcelain # expected: no output
```

Push the final candidate and require protected CI to run `pnpm --dir creoor acceptance:check` before merge or release. Local plan mode is not release evidence.
