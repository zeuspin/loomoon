# Design Agent Result Stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep generated images exclusively on the canvas and make creative directions selectable in the Agent sidebar.

**Architecture:** The message mapper will return conversation messages plus only the current actionable plan/confirmation state; it will never project `generationHistory` into sidebar entries. Direction selection remains local UI state until the final action, and the selected direction is passed through the confirm callback so the backend can validate and execute four tasks for that direction.

**Tech Stack:** React, TypeScript, assistant-ui, Vitest, Fastify, local JSON project state.

## Global Constraints

- Generated image thumbnails and full prompts must never render in the Agent sidebar.
- Images remain visible through canvas nodes and project SSE.
- Direction selection must not call a Provider.
- No selection means two directions with two tasks each.
- One selected direction means four tasks for that direction.

---

### Task 1: Remove generation history from the sidebar projection

**Files:**
- Modify: `packages/agent-ui/src/message-mapper.ts`
- Modify: `packages/agent-ui/src/model.ts`
- Test: `packages/agent-ui/src/message-mapper.test.ts`

**Interfaces:**
- Consumes: `mapProjectToAgentEntries(project: DemoProject)`
- Produces: entries containing messages and only the current actionable plan/confirmation, never `kind: "generation"`.

- [ ] Write a failing mapper test asserting that multiple `generationHistory` records produce zero generation entries.
- [ ] Run `pnpm --filter @loomoon/agent-ui test -- src/message-mapper.test.ts` and verify the generation entry assertion fails.
- [ ] Remove generation mapping and the generation entry union from production code.
- [ ] Run the focused test and verify it passes.

### Task 2: Add accessible direction selection

**Files:**
- Modify: `packages/agent-ui/src/tool-ui.tsx`
- Modify: `packages/agent-ui/src/agent-sidebar.tsx`
- Modify: `packages/agent-ui/src/styles.css`
- Test: `packages/agent-ui/src/agent-sidebar.test.tsx`

**Interfaces:**
- Produces: `onConfirm(id: string, directionId?: string): Promise<void>`.
- Direction cards use `aria-pressed` and a selected modifier class.

- [ ] Write a failing render test asserting both directions are buttons and expose `aria-pressed="false"`.
- [ ] Run the focused test and verify it fails because directions are static elements.
- [ ] Add local selected-direction state, clickable cards, selected styling and conditional primary-action copy.
- [ ] Run the focused test and verify it passes.

### Task 3: Carry selection through confirmation and generation

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/api.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/demo-service.ts`
- Test: `apps/api/src/demo-service.test.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Confirm request body: `{ pendingActionId: string, directionId?: string }`.
- `DemoService.confirm(projectId, confirmationId, directionId?)` validates direction ownership.

- [ ] Write a failing service test proving a selected direction generates four placeholders for that direction.
- [ ] Run the focused service test and verify the old two-plus-two behavior fails it.
- [ ] Extend confirm input, validate the direction, and retarget the four existing placeholders without invoking the Provider before confirmation.
- [ ] Pass `directionId` through web and API callbacks.
- [ ] Run API and web tests.

### Task 4: Verify the corrected sidebar and canvas result flow

**Files:**
- Verify: `packages/agent-ui/src/*`
- Verify: `apps/web/src/*`
- Verify: `apps/api/src/*`

- [ ] Run `pnpm --filter @loomoon/agent-ui test`.
- [ ] Run `pnpm --filter @loomoon/api test`.
- [ ] Run `pnpm --filter @loomoon/web test`.
- [ ] Run `pnpm typecheck` and `pnpm build`.
- [ ] In the browser, verify no generated thumbnails or prompts appear in the sidebar, both directions are selectable, and existing images remain on the canvas.

