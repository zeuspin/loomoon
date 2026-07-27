# Loomoon Xingliu-Style UI Replica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Loomoon’s web interface as the approved Xingliu-style responsive product while preserving the existing real project, canvas, Agent, confirmation, upload, history, SSE, and mock-provider flows.

**Architecture:** Split the current monolithic `App` into pure routing/auth/intent/content state modules plus focused React page components. Keep the current API and Agent runtime adapters as the only bridge to real backend behavior; place UGC, membership, notification, profile, video, and unsupported model behavior behind a typed mock content repository.

**Tech Stack:** React 19, TypeScript ES modules, Vite 7, Konva/react-konva, Vitest, existing `@loomoon/*` workspace packages, CSS custom properties and responsive CSS.

## Global Constraints

- Use Node.js 24+ and pnpm 11+.
- Use TypeScript ES modules, two-space indentation, double quotes, and semicolons.
- Preserve `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Tests remain colocated as `*.test.ts` or `*.test.tsx`.
- Do not add React Router or another runtime dependency.
- Preserve the existing API, Agent Runtime, Agent UI, canvas persistence, SSE, and confirmation contracts.
- Unauthenticated users may scroll, type, and observe rotating prompts; every click is protected.
- Deferred actions resume exactly once after successful email/password login.
- Use Loomoon naming and assets; do not copy the Xingliu trademark.
- Mock unsupported features through typed repositories and explicit mock states.
- Support desktop, tablet, and mobile layouts.
- Do not create a branch or push code.

---

### Task 1: Route, deferred intent, and mock content foundations

**Files:**
- Create: `apps/web/src/app-route.ts`
- Create: `apps/web/src/app-route.test.ts`
- Create: `apps/web/src/deferred-intent.ts`
- Create: `apps/web/src/deferred-intent.test.ts`
- Create: `apps/web/src/mock-content.ts`
- Create: `apps/web/src/mock-content.test.ts`

**Interfaces:**
- Produces: `AppRoute`, `parseAppRoute(url: URL): AppRoute`, `hrefForRoute(route: AppRoute): string`
- Produces: `DeferredIntent`, `DeferredIntentState`, `queueDeferredIntent`, `consumeDeferredIntent`
- Produces: `InspirationCase`, `InspirationCategory`, `MembershipPlan`, `MockNotice`, `MockProfile`, `mockContentRepository`

- [ ] **Step 1: Write failing route tests**

```ts
it("parses case and canvas routes", () => {
  expect(parseAppRoute(new URL("https://loomoon.local/case/new-year"))).toEqual({
    kind: "case",
    caseId: "new-year",
  });
  expect(parseAppRoute(new URL("https://loomoon.local/canvas?projectId=p1"))).toEqual({
    kind: "canvas",
    projectId: "p1",
  });
});
```

- [ ] **Step 2: Run route tests and verify RED**

Run: `pnpm --filter @loomoon/web test -- app-route.test.ts`  
Expected: FAIL because `app-route.ts` does not exist.

- [ ] **Step 3: Implement route parsing and href generation**

Use a discriminated union for `home`, `items`, `canvas`, `profile`, and `case`; unknown paths return `home`.

- [ ] **Step 4: Write failing deferred-intent tests**

```ts
it("consumes a queued intent exactly once", () => {
  const queued = queueDeferredIntent(undefined, {
    kind: "submit-prompt",
    prompt: "设计海报",
  });
  const first = consumeDeferredIntent(queued);
  expect(first.intent?.kind).toBe("submit-prompt");
  expect(first.state).toBeUndefined();
  expect(consumeDeferredIntent(first.state).intent).toBeUndefined();
});
```

- [ ] **Step 5: Run deferred-intent tests and verify RED**

Run: `pnpm --filter @loomoon/web test -- deferred-intent.test.ts`  
Expected: FAIL because `deferred-intent.ts` does not exist.

- [ ] **Step 6: Implement immutable deferred-intent state**

Use a unique `id`, queue timestamp, and exact union from the approved design. Consumption must clear state.

- [ ] **Step 7: Write failing mock repository contract tests**

Assert that every category has cases, every case has at least one result and replay step, membership has four plans, and mock capability flags are explicit.

- [ ] **Step 8: Run repository tests and verify RED**

Run: `pnpm --filter @loomoon/web test -- mock-content.test.ts`  
Expected: FAIL because `mock-content.ts` does not exist.

- [ ] **Step 9: Implement deterministic mock content**

Use local audit screenshots and existing demo asset URLs where available. Keep fallback gradients in CSS only for missing mock thumbnails.

- [ ] **Step 10: Run Task 1 tests**

Run: `pnpm --filter @loomoon/web test -- app-route.test.ts deferred-intent.test.ts mock-content.test.ts`  
Expected: PASS.

### Task 2: Responsive application shell and authentication interception

**Files:**
- Create: `apps/web/src/app-shell.tsx`
- Create: `apps/web/src/app-shell-state.ts`
- Create: `apps/web/src/app-shell-state.test.ts`
- Create: `apps/web/src/login-dialog.tsx`
- Create: `apps/web/src/app-shell.css`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Consumes: Task 1 route and deferred-intent types
- Produces: `AppShell`, `LoginDialog`, `protectedClickDecision`, `resumeIntentAfterLogin`

- [ ] **Step 1: Write failing authentication decision tests**

Cover public typing/scrolling, protected click queueing, active-user immediate execution, passive login, failed login retention, and one-time resume.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @loomoon/web test -- app-shell-state.test.ts`  
Expected: FAIL because shell state functions do not exist.

- [ ] **Step 3: Implement pure shell state functions**

Do not place authentication decisions inside visual components.

- [ ] **Step 4: Build `LoginDialog` around existing `api.login`**

Desktop uses a Loomoon visual panel plus email/password form. Mobile uses a single-column card. Preserve form values and display `ApiError` messages.

- [ ] **Step 5: Build `AppShell`**

Add desktop side rail, mobile header/hamburger, top-right auth controls, protected navigation, History API route synchronization, modal focus handling, and global membership/notice/about overlays.

- [ ] **Step 6: Replace `App` bootstrap with the shell**

Keep existing authentication bootstrap and pass the existing project/canvas workspace into the canvas route rather than deleting it.

- [ ] **Step 7: Run shell tests and typecheck**

Run: `pnpm --filter @loomoon/web test -- app-shell-state.test.ts && pnpm --filter @loomoon/web typecheck`  
Expected: PASS.

### Task 3: Logged-out/logged-in home, recent projects, and inspiration grid

**Files:**
- Create: `apps/web/src/home-page.tsx`
- Create: `apps/web/src/home-state.ts`
- Create: `apps/web/src/home-state.test.ts`
- Create: `apps/web/src/home-page.css`
- Create: `apps/web/src/inspiration-case.tsx`
- Modify: `apps/web/src/app-shell.tsx`

**Interfaces:**
- Consumes: `ProjectSummary[]`, `mockContentRepository`, `DeferredIntent`
- Produces: `HomePage`, `InspirationCaseOverlay`, `rotatePrompt`, `filterInspirationCases`, `buildRemixIntent`

- [ ] **Step 1: Write failing home-state tests**

Test prompt rotation pause rules, authentication-dependent sections, category filtering, case selection, replay step progression, and remix intent construction.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @loomoon/web test -- home-state.test.ts`  
Expected: FAIL because `home-state.ts` does not exist.

- [ ] **Step 3: Implement pure home-state functions**

Prompt rotation returns the current prompt without timers; React owns timer lifecycle.

- [ ] **Step 4: Implement exact home layout**

Logged-out: hero/composer/inspiration. Logged-in: hero/composer/recent projects/inspiration. Disable prompt animation for focus, non-empty input, and reduced motion.

- [ ] **Step 5: Implement responsive inspiration**

Desktop grid, mobile horizontal categories and two-column masonry-like layout using CSS columns or balanced grid without layout JavaScript.

- [ ] **Step 6: Implement case overlay and replay**

Use URL-backed state, thumbnails, main preview, author/statistics/prompt/model/result panel, mock replay timer, remix action, and responsive mobile information drawer.

- [ ] **Step 7: Connect prompt and remix execution**

After login, create a real project, create a real Agent session, send the real prompt, and navigate to its canvas.

- [ ] **Step 8: Run home tests and typecheck**

Run: `pnpm --filter @loomoon/web test -- home-state.test.ts && pnpm --filter @loomoon/web typecheck`  
Expected: PASS.

### Task 4: Projects, profile, membership, notices, and about surfaces

**Files:**
- Create: `apps/web/src/projects-page.tsx`
- Create: `apps/web/src/profile-page.tsx`
- Create: `apps/web/src/global-overlays.tsx`
- Create: `apps/web/src/content-surfaces.test.tsx`
- Create: `apps/web/src/content-surfaces.css`
- Modify: `apps/web/src/app-shell.tsx`

**Interfaces:**
- Consumes: existing project API and Task 1 mock repository
- Produces: `ProjectsPage`, `ProfilePage`, `MembershipDialog`, `NoticePanel`, `AboutMenu`

- [ ] **Step 1: Write failing content-surface tests**

Verify four membership plans, profile tabs, notice read state, project create card, project actions, and mobile action visibility.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @loomoon/web test -- content-surfaces.test.tsx`  
Expected: FAIL because content surfaces do not exist.

- [ ] **Step 3: Implement project surfaces with real API callbacks**

Reuse existing create/rename/delete confirmation flows and do not duplicate API request code.

- [ ] **Step 4: Implement profile and overlays**

Use mock repository data and explicit “演示数据” status for unsupported writes/payment.

- [ ] **Step 5: Run content tests and typecheck**

Run: `pnpm --filter @loomoon/web test -- content-surfaces.test.tsx && pnpm --filter @loomoon/web typecheck`  
Expected: PASS.

### Task 5: Canvas workspace extraction and tool system

**Files:**
- Create: `apps/web/src/canvas-page.tsx`
- Create: `apps/web/src/canvas-tools.ts`
- Create: `apps/web/src/canvas-tools.test.ts`
- Create: `apps/web/src/canvas-tool-rail.tsx`
- Create: `apps/web/src/canvas-context-toolbar.tsx`
- Create: `apps/web/src/generator-panel.tsx`
- Create: `apps/web/src/canvas-page.css`
- Modify: `apps/web/src/app.tsx`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: existing canvas state functions and project API
- Produces: `CanvasTool`, `CanvasToolState`, `createShapeNode`, `createDrawingNode`, `CanvasPage`, `CanvasToolRail`, `CanvasContextToolbar`, `GeneratorPanel`

- [ ] **Step 1: Write failing canvas tool tests**

Test tool switching, shape-node construction, centered insertion, drawing point accumulation, generator configuration, and mobile drawer state.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @loomoon/web test -- canvas-tools.test.ts`  
Expected: FAIL because tool state does not exist.

- [ ] **Step 3: Extend canvas contracts minimally**

Add only the fields and node variants required for shapes and drawing. Maintain backward compatibility with existing project JSON.

- [ ] **Step 4: Implement tool state and node factories**

Factories generate deterministic defaults while accepting caller-provided IDs and viewport center.

- [ ] **Step 5: Extract existing canvas workspace into `CanvasPage`**

Move behavior without changing API semantics. Keep selection, move, zoom, history, upload, save, SSE, retry, and region edit.

- [ ] **Step 6: Implement tool rail and secondary menus**

Selection, add/upload/artboard, shapes, text, pencil/pen, image generator, and video generator. Unsupported video/pen flows reach explicit mock result states.

- [ ] **Step 7: Implement context toolbar**

Render contextual controls for image, text, shape, and multi-selection; connect existing operations first and local-only properties second.

- [ ] **Step 8: Implement generator panel**

Prompt, references, mode, ratio, quantity, model preference, cost hint, and submit through the real Agent confirmation flow.

- [ ] **Step 9: Implement mobile tool dock and drawers**

Keep canvas interactive while secondary controls are open and respect safe-area insets.

- [ ] **Step 10: Run canvas tests, existing canvas tests, and typecheck**

Run: `pnpm --filter @loomoon/web test -- canvas-tools.test.ts canvas-state.test.ts && pnpm --filter @loomoon/web typecheck`  
Expected: PASS.

### Task 6: Xingliu-style Agent conversation shell and canvas linkage

**Files:**
- Create: `apps/web/src/agent-panel-state.ts`
- Create: `apps/web/src/agent-panel-state.test.ts`
- Create: `apps/web/src/agent-panel.tsx`
- Create: `apps/web/src/agent-composer.tsx`
- Create: `apps/web/src/agent-file-list.tsx`
- Create: `apps/web/src/agent-model-preferences.tsx`
- Create: `apps/web/src/agent-panel.css`
- Modify: `apps/web/src/agent-sidebar-adapter.ts`
- Modify: `apps/web/src/canvas-page.tsx`
- Modify: `packages/agent-ui/src/message-mapper.ts`
- Modify: `packages/agent-ui/src/model.ts`

**Interfaces:**
- Consumes: `AgentSession`, `PersistentAgentMessage`, `PersistentAgentRun`, canvas selection
- Produces: `AgentPanelState`, `mapAgentTimeline`, `buildComposerReferences`, `AgentPanel`, `AgentComposer`, `AgentFileList`, `AgentModelPreferences`

- [ ] **Step 1: Write failing Agent panel state tests**

Cover dated timeline grouping, user/assistant/result/status items, session switching, search, file-to-node linkage, selection references, model preferences, online mock state, collapse, and mobile drawer height.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @loomoon/web test -- agent-panel-state.test.ts`  
Expected: FAIL because panel state does not exist.

- [ ] **Step 3: Implement timeline and composer reference mapping**

Preserve existing run/message status semantics and do not create a separate fake conversation model.

- [ ] **Step 4: Implement Agent panel header**

New session, searchable history, mock sharing, generated file list, collapse/reopen.

- [ ] **Step 5: Implement message stream**

User bubbles, date separators, assistant text, references, model labels, generated media, run status, confirmation, partial failure, retry, cancel, and feedback.

- [ ] **Step 6: Implement composer**

Attachment, `@` resource/model search, online toggle, model preference popover, selected-node chips, send/stop.

- [ ] **Step 7: Link message and file results to canvas nodes**

Clicking a result selects and centers the matching node; canvas selection updates composer references.

- [ ] **Step 8: Implement mobile Agent drawer**

Collapsed, half, and full states; keep composer visible with the software keyboard.

- [ ] **Step 9: Run Agent tests and typecheck**

Run: `pnpm --filter @loomoon/web test -- agent-panel-state.test.ts agent-sidebar-adapter.test.ts && pnpm --filter @loomoon/agent-ui test && pnpm --filter @loomoon/web typecheck`  
Expected: PASS.

### Task 7: Visual integration, accessibility, and repository verification

**Files:**
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/flat.css`
- Modify: `apps/web/src/enhancements.css`
- Modify: `packages/design-tokens/src/tokens.css`
- Modify: `docs/development/demo-acceptance.md`
- Create: `apps/web/src/replica-style-contract.test.ts`

**Interfaces:**
- Consumes: all prior page components and approved visual tokens
- Produces: stable responsive visual contract and updated manual acceptance checklist

- [ ] **Step 1: Write failing style-contract tests**

Assert required selectors, focus-visible treatment, reduced-motion rule, safe-area use, mobile breakpoints, Agent drawer states, and no legacy full-screen login replacement.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @loomoon/web test -- replica-style-contract.test.ts`  
Expected: FAIL until final styles are present.

- [ ] **Step 3: Consolidate approved visual tokens**

Apply white page background, `#f4f5f6` workspace, `#111111` primary text, `#8d9199` secondary text, `#e2e3e5` borders, approved radii, shadows, spacing, and motion.

- [ ] **Step 4: Remove conflicting legacy layout rules**

Keep rules still used by login/dialog/history behavior; delete only selectors proven unused by repository search.

- [ ] **Step 5: Add accessibility and motion handling**

Focus visibility, semantic labels, dialog focus, minimum mobile targets, reduced motion, color-independent statuses.

- [ ] **Step 6: Update manual acceptance documentation**

Document logged-out protection, deferred resume, case replay/remix, responsive views, canvas tools, Agent sessions/files/models, and mock boundaries.

- [ ] **Step 7: Run focused Web verification**

Run: `pnpm --filter @loomoon/web test && pnpm --filter @loomoon/web typecheck && pnpm --filter @loomoon/web build`  
Expected: PASS.

- [ ] **Step 8: Run repository verification**

Run: `pnpm test && pnpm typecheck && pnpm build && pnpm demo:verify:mock`  
Expected: PASS.

- [ ] **Step 9: Review the implementation against the specification**

Check every completion criterion in `docs/superpowers/specs/2026-07-26-xingliu-ui-replica-design.md` and record any remaining mock-only capability in the final handoff.
