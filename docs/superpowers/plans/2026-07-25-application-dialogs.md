# Application Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace native browser prompts with Loomoon-styled, accessible application dialogs.

**Architecture:** Add reusable visual primitives to `@loomoon/ui`, while keeping dialog state and API mutations in the Web application. A small reducer-style dialog descriptor selects create, rename, delete, or text-edit behavior.

**Tech Stack:** React 19, TypeScript, `@loomoon/ui`, CSS design tokens, Vitest SSR tests.

## Global Constraints

- No `window.prompt` or `window.confirm`.
- White surface, 4px radius, light shadow, design tokens only.
- Enter submits input dialogs; Esc cancels; input is focused on open.
- Business API calls remain in `apps/web`.

---

### Task 1: Reusable dialog primitives

**Files:**
- Modify: `packages/ui/src/components.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/components.test.tsx`

- [ ] Add failing SSR tests for dialog title, description, input error and dangerous action.
- [ ] Run UI tests and observe the expected failure.
- [ ] Implement `Dialog` and `DialogField` with keyboard and focus behavior.
- [ ] Run UI tests, typecheck and build.

### Task 2: Web dialog state and mutations

**Files:**
- Modify: `apps/web/src/app.tsx`
- Test: `apps/web/src/dialog-state.test.ts`
- Create: `apps/web/src/dialog-state.ts`

- [ ] Add failing tests for create, rename, delete and text-edit descriptors.
- [ ] Implement typed dialog descriptors and validation.
- [ ] Replace native prompts with dialog state and existing API/Canvas operations.
- [ ] Run Web tests, typecheck and build.

### Task 3: Browser acceptance

**Files:**
- Modify: `docs/development/agent-sidebar-acceptance.md`
- Modify: `docs/development/acceptance-matrix.md`

- [ ] Create a project through the application dialog.
- [ ] Rename it, verify persistence, then delete it through the danger dialog.
- [ ] Verify Esc/cancel and empty validation.
- [ ] Confirm no browser errors or warnings.
- [ ] Run full repository tests, typecheck, build and `git diff --check`.
