# Image Generator Seed and Model Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair legacy image-model selections and add reliable random/fixed seed behavior across the generator UI, API, provider, and persisted results.

**Architecture:** Extend the shared generator contract with a normalized seed mode, keep catalog and seed validation at the API boundary, and resolve a cryptographically random seed independently for every generated image. Add pure web helpers for model migration and seed-mode transitions so UI behavior is testable without coupling it to the canvas component.

**Tech Stack:** TypeScript, React, Fastify, Vitest, Node.js `crypto`, pnpm workspaces.

## Global Constraints

- Random seeds are independent cryptographically secure integers from `0` through `2147483647`; no base-seed sequence.
- Fixed seed mode permits exactly one output image.
- Unknown direct API model IDs remain rejected; only loaded projects are migrated to the first available model.
- Do not create a branch or push code.

---

### Task 1: Shared seed contract and server validation

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/image-model-catalog.ts`
- Test: `apps/api/src/image-model-catalog.test.ts`

**Interfaces:**
- Produces: `ImageSeedMode = "random" | "fixed"`, optional `seed` fields on generator snapshots/configs.
- Produces: normalized legacy input defaults to random; fixed mode requires an integer seed and `outputCount === 1`.

- [ ] Add failing catalog tests for random defaults, valid fixed seeds, out-of-range seeds, and fixed multi-output rejection.
- [ ] Run `pnpm --filter @loomoon/api test -- image-model-catalog.test.ts` and verify the new assertions fail for missing behavior.
- [ ] Extend contracts and implement minimal normalization/validation.
- [ ] Re-run the focused test and verify it passes.

### Task 2: Provider seed serialization and service seed allocation

**Files:**
- Modify: `packages/bailian-provider/src/client.ts`
- Test: `packages/bailian-provider/src/client.test.ts`
- Modify: `apps/api/src/demo-service.ts`
- Test: `apps/api/src/demo-service.test.ts`

**Interfaces:**
- Consumes: normalized `seedMode` and optional fixed `seed`.
- Produces: provider generation option `seed?: number` serialized as `parameters.seed`.
- Produces: `createImageSeed(): number` using `crypto.randomInt(0, 2147483648)` for each random output.

- [ ] Add a failing provider test asserting `seed` is sent under `parameters`.
- [ ] Run the provider test and confirm the assertion fails.
- [ ] Add seed to the provider option type and request body; verify the provider test passes.
- [ ] Add failing service tests asserting distinct injected random seeds per output and fixed-seed passthrough.
- [ ] Run the service test and confirm failure is caused by missing seed allocation.
- [ ] Resolve each output seed independently, pass it to the provider, and store it on output nodes/history.
- [ ] Re-run the service tests and verify they pass.

### Task 3: Model migration and generator state helpers

**Files:**
- Modify: `apps/web/src/generator-node.ts`
- Test: `apps/web/src/generator-node.test.ts`
- Modify: `apps/web/src/app.tsx`

**Interfaces:**
- Produces: `resolveGeneratorModelId(modelId, catalog): string` preserving valid IDs and selecting the first available ID for stale values.
- Produces: fixed-mode transition that forces `outputCount: 1`; random mode does not restore an earlier count.

- [ ] Add failing helper tests for valid/stale/empty model IDs and random/fixed transitions.
- [ ] Run the focused web helper test and verify the intended failures.
- [ ] Implement the pure helpers and defaults.
- [ ] Normalize loaded image-generator nodes when the catalog or project changes, allowing the existing autosave path to persist migration.
- [ ] Re-run focused tests and verify they pass.

### Task 4: Seed controls in the image settings popover

**Files:**
- Modify: `apps/web/src/generator-overlay.tsx`
- Modify: `apps/web/src/enhancements.css`
- Test: `apps/web/src/generator-overlay.test.tsx`
- Test: `apps/web/src/style-contract.test.ts`

**Interfaces:**
- Consumes: generator `seedMode`, optional `seed`, and `onUpdateGenerator`.
- Produces: “随机/固定” controls, fixed integer input, and disabled multi-output buttons in fixed mode.

- [ ] Add failing interaction tests for switching to fixed, forcing one output, entering a seed, disabling multi-output, and returning to random.
- [ ] Run focused overlay tests and verify failures.
- [ ] Implement accessible controls and scoped styles.
- [ ] Re-run overlay and style tests and verify they pass.

### Task 5: Submission compatibility and verification

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/api.ts` only if serialization needs an explicit change.

**Interfaces:**
- Consumes: complete normalized generator configuration.
- Produces: API snapshots containing seed mode and fixed seed only when applicable.

- [ ] Ensure submission includes seed fields and legacy loaded nodes receive random defaults.
- [ ] Run focused tests for web, API, and provider workspaces.
- [ ] Run `pnpm typecheck` and resolve only errors caused by this feature.
- [ ] Run `pnpm build` and `pnpm test`.
- [ ] Inspect `git diff --check` and confirm no unrelated user changes were overwritten.
