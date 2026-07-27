# Canvas Image Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Lovart-inspired canvas image generator that switches among configured Bailian models, submits real generation through the existing Agent action pipeline, persists assets, and replaces its canvas placeholder with a collision-free result grid.

**Architecture:** Add a server-owned image-model catalog and validate every generator snapshot against it. A dedicated canvas-generator endpoint creates and immediately confirms a `generate_images` pending action with source metadata, while the existing executor/provider pipeline performs each output and persists results. The web app treats the generator as a persistent draft/running node, renders a large anchored composer and settings popover, then reconciles completed server nodes into the canvas.

**Tech Stack:** TypeScript ES modules, React 19, Vite, Konva, Fastify, Vitest, Pi Agent runtime, DashScope/Bailian multimodal generation, repository asset store.

## Global Constraints

- Use Node.js 24+ and pnpm 11+.
- Use TypeScript ES modules, two-space indentation, double quotes, and semicolons.
- Preserve `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Keep tests beside implementations as `*.test.ts` or `*.test.tsx`.
- Do not implement video generation, an account balance, charging, refunds, top-ups, or plans.
- Do not create a branch or push code.
- Preserve existing Agent creative-plan confirmation behavior; only the canvas-generator endpoint may immediately confirm its action.

---

## File Structure

- `packages/contracts/src/index.ts`: shared generator snapshot, model capability, action-source, and billing-extension contracts.
- `packages/config/src/env.ts`: parse the configured primary, fallback, and draft image model IDs.
- `apps/api/src/image-model-catalog.ts`: build the server-owned public model catalog and validate/normalize generator requests.
- `apps/api/src/image-model-catalog.test.ts`: catalog and parameter normalization tests.
- `packages/bailian-provider/src/client.ts`: accept a validated per-request model and generation parameters.
- `packages/bailian-provider/src/client.test.ts`: assert DashScope request mapping for model, quality, dimensions, and references.
- `apps/api/src/app.ts`: expose model catalog and authenticated canvas-generator submission routes.
- `apps/api/src/app.test.ts`: API authorization, validation, and immediate-confirmation tests.
- `apps/api/src/demo-service.ts`: execute generator-sourced batches and reconcile generator/result nodes.
- `apps/api/src/demo-service.test.ts`: real pipeline semantics, idempotency, partial failure, retry, and placement tests.
- `apps/web/src/api.ts`: typed catalog and generator submission clients.
- `apps/web/src/api.test.ts`: request/response contract tests.
- `apps/web/src/generator-node.ts`: generator defaults, config normalization, summary, and deterministic result-grid helpers.
- `apps/web/src/generator-node.test.ts`: settings normalization and grid tests.
- `apps/web/src/generator-overlay.tsx`: large composer, model picker, image settings popover, and accessible controls.
- `apps/web/src/generator-overlay.test.tsx`: UI states and interaction tests.
- `apps/web/src/app.tsx`: fetch catalog, submit generator batches, and reconcile returned project state.
- `apps/web/src/enhancements.css`: visual treatment for composer, settings popover, progress, and responsive behavior.

---

### Task 1: Shared Generator and Model Contracts

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/config/src/env.ts`
- Test: `packages/config/src/env.test.ts`

**Interfaces:**
- Produces: `ImageQuality`, `ImageSizePreset`, `ImageModelCapability`, `CanvasGeneratorSnapshot`, and `PendingActionSource`.
- Produces: parsed `BAILIAN_IMAGE_FALLBACK_MODEL` and `BAILIAN_DRAFT_IMAGE_MODEL` values for catalog construction.

- [ ] **Step 1: Write failing contract/config tests**

Add expectations that `parseServerEnv` returns all three image-model IDs from environment input and defaults optional fallback/draft IDs to the values in `.env.example`.

```ts
expect(env.BAILIAN_IMAGE_MODEL).toBe("wan2.7-image-pro");
expect(env.BAILIAN_IMAGE_FALLBACK_MODEL).toBe("qwen-image-2.0-pro-2026-06-22");
expect(env.BAILIAN_DRAFT_IMAGE_MODEL).toBe("wan2.7-image");
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm --filter @loomoon/config test`

Expected: FAIL because the fallback and draft model variables are not parsed.

- [ ] **Step 3: Add exact shared contracts and environment fields**

Define the public capability and immutable request snapshot without provider-specific fields:

```ts
export type ImageQuality = "auto" | "high" | "medium" | "low";
export type ImageSizePreset = "auto" | "1:1" | "3:2" | "2:3" | "4:3" | "3:4" | "9:16" |
  "1:1-2k" | "16:9-2k" | "9:16-2k" | "16:9-4k" | "9:16-4k" | "custom";

export interface ImageModelCapability {
  id: string;
  label: string;
  description: string;
  available: boolean;
  supportsReferences: boolean;
  qualities: ImageQuality[];
  sizePresets: ImageSizePreset[];
  maxOutputCount: number;
  costEstimate?: string;
}

export interface CanvasGeneratorSnapshot {
  prompt: string;
  modelId: string;
  quality: ImageQuality;
  sizePreset: ImageSizePreset;
  width?: number;
  height?: number;
  aspectRatio: string;
  outputCount: number;
  referenceAssetUrls: string[];
}
```

Extend pending action records with optional source, generator-node ID, config snapshot, `costEstimate`, and `billingReservationId`. Keep all new fields optional for persisted-data compatibility.

- [ ] **Step 4: Run contracts and config tests**

Run: `pnpm --filter @loomoon/contracts test && pnpm --filter @loomoon/config test`

Expected: PASS.

- [ ] **Step 5: Commit the focused change**

```bash
git add packages/contracts/src/index.ts packages/config/src/env.ts packages/config/src/env.test.ts
git commit -m "Add image generator model contracts."
```

### Task 2: Server-Owned Image Model Catalog

**Files:**
- Create: `apps/api/src/image-model-catalog.ts`
- Create: `apps/api/src/image-model-catalog.test.ts`
- Modify: `apps/api/src/main.ts`

**Interfaces:**
- Consumes: `ImageModelCapability`, `CanvasGeneratorSnapshot` and parsed model IDs from Task 1.
- Produces: `createImageModelCatalog(config): ImageModelCapability[]`.
- Produces: `normalizeGeneratorSnapshot(snapshot, catalog): CanvasGeneratorSnapshot` and throws `INVALID_GENERATOR_CONFIG` or `IMAGE_MODEL_UNAVAILABLE`.

- [ ] **Step 1: Write failing catalog and normalization tests**

Cover three configured models, hidden duplicate IDs, unavailable empty IDs, custom dimensions between 256 and 4096, allowed output counts 1/2/4, reference rejection for incapable models, and nearest legal fallback after model switching.

```ts
expect(catalog.map((model) => model.id)).toEqual([
  "wan2.7-image-pro",
  "qwen-image-2.0-pro-2026-06-22",
  "wan2.7-image",
]);
expect(normalizeGeneratorSnapshot({ ...snapshot, outputCount: 3 }, catalog)).toThrow;
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm --filter @loomoon/api test -- image-model-catalog.test.ts`

Expected: FAIL because the catalog module does not exist.

- [ ] **Step 3: Implement the catalog and validator**

Use explicit capability entries for pro, fallback, and draft roles. Deduplicate by ID, make the first configured model the default, and never trust label/capability values from the browser. Normalize presets to concrete provider dimensions only inside the API.

- [ ] **Step 4: Run catalog tests**

Run: `pnpm --filter @loomoon/api test -- image-model-catalog.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the focused change**

```bash
git add apps/api/src/image-model-catalog.ts apps/api/src/image-model-catalog.test.ts apps/api/src/main.ts
git commit -m "Add server image model catalog."
```

### Task 3: Per-Request Bailian Model and Size Mapping

**Files:**
- Modify: `packages/bailian-provider/src/client.ts`
- Create: `packages/bailian-provider/src/client.test.ts`
- Modify: `apps/api/src/main.ts`

**Interfaces:**
- Consumes: a server-validated generation request.
- Produces: `generateImage(prompt, imageDataUrls, options)` where `options` contains `modelId`, `width`, `height`, `quality`, and optional `bboxList`.

- [ ] **Step 1: Write failing provider request tests**

Inject `fetchImpl` and assert that selecting the fallback model changes `body.model`, custom `1024 × 1536` maps to `parameters.size = "1024*1536"`, reference data URLs precede prompt text, and the returned trace reports the selected model.

- [ ] **Step 2: Run provider tests and verify failure**

Run: `pnpm --filter @loomoon/bailian-provider test -- client.test.ts`

Expected: FAIL because `generateImage` always uses the constructor model and fixed `2K` size.

- [ ] **Step 3: Implement minimal per-request options**

Keep the constructor image model as a backward-compatible default. Only allow API code to pass a catalog-validated override. Preserve retries, provider request ID extraction, error normalization, watermark false, and `n: 1`.

- [ ] **Step 4: Run all provider tests**

Run: `pnpm --filter @loomoon/bailian-provider test`

Expected: PASS.

- [ ] **Step 5: Commit the focused change**

```bash
git add packages/bailian-provider/src/client.ts packages/bailian-provider/src/client.test.ts apps/api/src/main.ts
git commit -m "Support configured Bailian image models."
```

### Task 4: Trusted Canvas-Generator Submission Pipeline

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`
- Modify: `apps/api/src/agent-tools.ts`
- Modify: `apps/api/src/demo-agent-application.ts`
- Modify: `apps/api/src/local-generation-executor.ts`
- Modify: `apps/api/src/local-generation-executor.test.ts`

**Interfaces:**
- Consumes: `{ projectId, generatorNodeId, idempotencyKey, config }`.
- Produces: `GET /api/image-models` and authenticated `POST /api/projects/:projectId/generators/:generatorNodeId/generate`.
- Produces: a `generate_images` pending action with `source: "canvas-generator"`, immutable config snapshot, and immediate server-side confirmation.

- [ ] **Step 1: Write failing route and executor tests**

Verify the catalog route omits secrets; invalid model/dimensions return 400; another user's project returns the existing non-enumerating authorization error; repeated idempotency keys return the same batch; direct generator submissions reach `confirmed` without a second client request; ordinary Agent actions remain `pending_confirmation`.

- [ ] **Step 2: Run focused API tests and verify failure**

Run: `pnpm --filter @loomoon/api test -- app.test.ts local-generation-executor.test.ts`

Expected: FAIL because the routes and source-aware confirmation do not exist.

- [ ] **Step 3: Implement model catalog and generator submission routes**

Authenticate first, load the project, verify the target is an `image-generator`, normalize against the server catalog, create the pending action, persist it, immediately confirm only when the server assigned `source: "canvas-generator"`, and enqueue through `LocalGenerationExecutor`.

- [ ] **Step 4: Preserve security and idempotency boundaries**

Do not accept `source`, confirmation state, billing IDs, provider model metadata, or cost from the client. Build those fields server-side. Store the idempotency key with the action and reuse the existing record on replay.

- [ ] **Step 5: Run API tests**

Run: `pnpm --filter @loomoon/api test -- app.test.ts local-generation-executor.test.ts agent-tools.test.ts`

Expected: PASS, including unchanged manual confirmation tests.

- [ ] **Step 6: Commit the focused change**

```bash
git add apps/api/src/app.ts apps/api/src/app.test.ts apps/api/src/agent-tools.ts apps/api/src/demo-agent-application.ts apps/api/src/local-generation-executor.ts apps/api/src/local-generation-executor.test.ts
git commit -m "Add trusted canvas generation submissions."
```

### Task 5: Result Replacement, Grid Layout, and Retry Semantics

**Files:**
- Modify: `apps/api/src/demo-service.ts`
- Modify: `apps/api/src/demo-service.test.ts`
- Modify: `packages/canvas-domain/src/layout.ts`
- Modify: `packages/canvas-domain/src/layout.test.ts`

**Interfaces:**
- Consumes: confirmed canvas-generator action and validated snapshot.
- Produces: deterministic result nodes in which output zero replaces the generator node ID/geometry and later outputs occupy collision-free positions to its right.

- [ ] **Step 1: Write failing lifecycle and layout tests**

Cover one result replacing the generator in place, two results in one row, four results in two columns, collision shifting the whole grid right, generator configuration retained in generation history, one failed output producing `partially-failed`, and retry creating only the failed output.

- [ ] **Step 2: Run focused service/domain tests and verify failure**

Run: `pnpm --filter @loomoon/canvas-domain test -- layout.test.ts && pnpm --filter @loomoon/api test -- demo-service.test.ts`

Expected: FAIL because the current generator handler creates browser-side mock results and the server candidate path does not replace a generator.

- [ ] **Step 3: Add deterministic canvas-domain placement helper**

Implement a pure helper accepting anchor geometry, output count, gap, and occupied rectangles. Return one row for count two and two columns for count four; preserve the anchor rectangle for index zero and shift the complete grid until it does not overlap unrelated nodes.

- [ ] **Step 4: Execute and materialize each result independently**

Pass the action's model and dimension options to Bailian. Persist each provider result through `AssetStore` before changing its node to `image`. Keep request ID, resolved model, source generator ID, batch ID, and immutable history snapshot.

- [ ] **Step 5: Implement partial failure and retry**

Retain successful results and failed slot records. A retry action targets failed output indexes only and reuses their planned geometry. Never regenerate completed indexes.

- [ ] **Step 6: Run service and domain tests**

Run: `pnpm --filter @loomoon/canvas-domain test && pnpm --filter @loomoon/api test -- demo-service.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the focused change**

```bash
git add apps/api/src/demo-service.ts apps/api/src/demo-service.test.ts packages/canvas-domain/src/layout.ts packages/canvas-domain/src/layout.test.ts
git commit -m "Replace generators with image result grids."
```

### Task 6: Web API and Generator State

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/api.test.ts`
- Modify: `apps/web/src/generator-node.ts`
- Modify: `apps/web/src/generator-node.test.ts`

**Interfaces:**
- Consumes: Task 1 contracts and Task 4 routes.
- Produces: `fetchImageModels()`, `submitCanvasGenerator(projectId, nodeId, config, idempotencyKey)`, `normalizeConfigForModel`, `generatorSettingsSummary`, and result reconciliation helpers.

- [ ] **Step 1: Write failing API and state tests**

Assert request paths and bodies, model-switch fallback behavior, custom dimension validation, quality/size/count summary text such as `中 · auto · 1 张`, and stable idempotency key reuse while the same submit attempt is active.

- [ ] **Step 2: Run focused Web tests and verify failure**

Run: `pnpm --filter @loomoon/web test -- api.test.ts generator-node.test.ts`

Expected: FAIL because the typed endpoints and settings helpers do not exist.

- [ ] **Step 3: Implement typed API clients and pure state helpers**

Keep network code out of React components. Normalize against the selected model capabilities and preserve valid user choices. Use Chinese display labels while storing stable English enum values.

- [ ] **Step 4: Run focused Web tests**

Run: `pnpm --filter @loomoon/web test -- api.test.ts generator-node.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the focused change**

```bash
git add apps/web/src/api.ts apps/web/src/api.test.ts apps/web/src/generator-node.ts apps/web/src/generator-node.test.ts
git commit -m "Add canvas generator client state."
```

### Task 7: Lovart-Inspired Generator Composer and Settings Popover

**Files:**
- Modify: `apps/web/src/generator-overlay.tsx`
- Modify: `apps/web/src/generator-overlay.test.tsx`
- Modify: `apps/web/src/enhancements.css`

**Interfaces:**
- Consumes: model catalog, selected model, normalized config, submission state, and callbacks from Task 6.
- Produces: accessible composer controls with reference upload, prompt, settings summary/popover, model picker, cost-extension display, progress, and submit.

- [ ] **Step 1: Write failing interaction tests**

Render the overlay with two model capabilities. Verify the settings summary, open/close behavior, quality selection, width/height inputs, aspect lock, preset cards, model switching, disabled invalid submit, file upload, and no cost deduction copy.

- [ ] **Step 2: Run the component test and verify failure**

Run: `pnpm --filter @loomoon/web test -- generator-overlay.test.tsx`

Expected: FAIL because the large composer and settings controls do not exist.

- [ ] **Step 3: Build focused components**

Split internal responsibilities into `GeneratorPrompt`, `GeneratorModelPicker`, and `ImageSettingsPopover` within the file unless the file exceeds a maintainable size, then create `image-settings-popover.tsx` and a colocated test. Use semantic buttons/radios/labels, keyboard Escape dismissal, focus return, and outside-click dismissal.

- [ ] **Step 4: Apply the approved visual system**

Use a white panel, one-pixel neutral border, 32px outer radius, restrained shadow, 16px spacing rhythm, black primary text/action, muted gray controls, and a single Loomoon accent for focus. Match the reference information hierarchy without using Lovart assets.

- [ ] **Step 5: Add responsive behavior**

At narrow canvas widths, cap the composer to `calc(100vw - 24px)` and make the settings preset grid two columns. Honor `prefers-reduced-motion` and keep all text/control contrast accessible.

- [ ] **Step 6: Run component and style-contract tests**

Run: `pnpm --filter @loomoon/web test -- generator-overlay.test.tsx style-contract.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the focused change**

```bash
git add apps/web/src/generator-overlay.tsx apps/web/src/generator-overlay.test.tsx apps/web/src/enhancements.css
git commit -m "Build canvas image generator composer."
```

### Task 8: App Integration and Server Reconciliation

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/agent-event-sync.ts`
- Modify: `apps/web/src/agent-event-sync.test.ts`
- Modify: `apps/web/src/generator-overlay.test.tsx`

**Interfaces:**
- Consumes: Task 6 API functions and Task 7 composer.
- Produces: model loading, direct generation submission, project refresh/event reconciliation, progress rendering, retry, and completed result replacement in the live canvas.

- [ ] **Step 1: Write failing integration-state tests**

Verify catalog loads once, submit changes generator to `submitting`, server acknowledgement changes it to `running`, SSE/project updates replace the generator rather than browser-created mock results, refresh restores running state, and retry targets failed outputs.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm --filter @loomoon/web test -- agent-event-sync.test.ts generator-overlay.test.tsx`

Expected: FAIL because `app.tsx` currently creates mock result nodes locally.

- [ ] **Step 3: Remove browser-side mock completion**

Replace the current timer/result creation in `submitGenerator` with the typed API call. Reconcile authoritative server canvas updates without overwriting newer successful nodes with stale local snapshots.

- [ ] **Step 4: Connect progress and retry controls**

Show compact task progress in the composer while its generator remains. When output zero succeeds, let the server image node replace the generator. Preserve partial failure metadata for a retry action without moving successful images.

- [ ] **Step 5: Run all Web tests**

Run: `pnpm --filter @loomoon/web test`

Expected: PASS.

- [ ] **Step 6: Commit the focused change**

```bash
git add apps/web/src/app.tsx apps/web/src/agent-event-sync.ts apps/web/src/agent-event-sync.test.ts apps/web/src/generator-overlay.test.tsx
git commit -m "Connect canvas generator to real tasks."
```

### Task 9: End-to-End Verification and Documentation

**Files:**
- Modify: `.env.example` only if model comments need clarification.
- Modify: `docs/development/demo-acceptance.md`
- Modify: `scripts/verify-mock-e2e.mts`

**Interfaces:**
- Consumes: the complete generator flow.
- Produces: repeatable mock verification for 1/2/4 outputs and documented real-provider smoke steps.

- [ ] **Step 1: Extend mock end-to-end verification**

Create a generator, fetch the catalog, submit four outputs, wait for idle, assert no generator node remains, assert four succeeded image nodes, verify index zero kept anchor geometry, and verify all asset URLs are Loomoon asset URLs.

- [ ] **Step 2: Run repository verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm demo:verify:mock
```

Expected: all commands exit 0.

- [ ] **Step 3: Run a configured-provider smoke check when credentials are available**

Run `pnpm env:check`, start API/Web, generate one low-cost draft image, and verify the stored node includes a provider request ID, resolved model, and Loomoon asset URL. Do not print keys or commit `.env`.

- [ ] **Step 4: Update acceptance documentation**

Document model switching, settings presets, reference generation, direct submission semantics, first-result replacement, multi-result grid, partial failure retry, and the fact that cost is display-only in this release.

- [ ] **Step 5: Commit verification artifacts**

```bash
git add scripts/verify-mock-e2e.mts docs/development/demo-acceptance.md .env.example
git commit -m "Verify canvas image generation flow."
```

## Self-Review

- Spec coverage: Tasks 1–9 cover the model catalog, true provider selection, settings UI, direct trusted Agent action, persisted assets, first-result replacement, multi-image layout, recovery, partial failure, retry, and billing extension fields.
- Placeholder scan: no deferred implementation placeholders are present; future billing is an explicit non-goal with typed extension fields.
- Type consistency: `CanvasGeneratorSnapshot`, `ImageModelCapability`, `modelId`, `quality`, `sizePreset`, `outputCount`, `source`, and `generatorNodeId` names remain consistent across tasks.
