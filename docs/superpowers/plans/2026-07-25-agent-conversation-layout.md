# Agent Conversation Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Agent composer visible and present Lovart-style lightweight user/Agent conversation roles.

**Architecture:** Keep assistant-ui primitives inside `@loomoon/agent-ui`. Add explicit role-aware message presentation around `MessagePrimitive`, then make the thread a two-row layout whose viewport alone scrolls and whose composer remains pinned.

**Tech Stack:** React, TypeScript, assistant-ui, CSS design tokens, Vitest SSR tests, Vite.

## Global Constraints

- Agent messages are left-aligned with avatar and name, without a bubble.
- User messages are right-aligned in a light brand-color bubble.
- The composer remains visible while only the message viewport scrolls.
- Existing 2–4px radius tokens, light theme, tool behavior, upload, selection, confirmation, and send flow remain unchanged.
- `apps/web` must not import `@assistant-ui/*`.

---

### Task 1: Role-aware message presentation

**Files:**
- Modify: `packages/agent-ui/src/agent-sidebar.tsx`
- Test: `packages/agent-ui/src/agent-sidebar.test.tsx`

**Interfaces:**
- Consumes: assistant-ui `MessagePrimitive` and runtime message role.
- Produces: `.lm-agent-message-row`, `.lm-agent-avatar`, `.lm-agent-author`, and `.lm-agent-message-content` markup.

- [ ] Add an SSR test containing both an assistant and a user message and assert the Agent avatar/name and role-specific row attributes.
- [ ] Run `pnpm --filter @loomoon/agent-ui test` and verify the new assertion fails.
- [ ] Render the assistant identity only for Agent messages and expose the runtime role through role-specific message roots.
- [ ] Run the package tests and verify they pass.

### Task 2: Pinned composer and lightweight conversation CSS

**Files:**
- Modify: `packages/agent-ui/src/styles.css`
- Test: `packages/agent-ui/src/style-contract.test.ts`

**Interfaces:**
- Consumes: the role-aware classes from Task 1.
- Produces: a two-row thread layout with a scrollable viewport and pinned composer.

- [ ] Add a source contract test asserting the thread uses grid rows, the viewport has `min-height:0` and overflow, and the composer is non-shrinking/sticky.
- [ ] Run the package tests and verify the test fails before CSS changes.
- [ ] Implement the layout and Lovart-style Agent/user presentation using existing design tokens.
- [ ] Run package tests, typecheck, and build.

### Task 3: Browser and repository verification

**Files:**
- Modify: `docs/development/agent-sidebar-acceptance.md`

**Interfaces:**
- Consumes: the completed conversation layout.
- Produces: browser evidence at 1394×1216 and repeatable regression evidence.

- [ ] Reload `http://localhost:5173/` and verify the composer is visible with long image history.
- [ ] Verify Agent messages are avatar/name content rows and user messages are right-side bubbles.
- [ ] Check browser console errors and capture a screenshot.
- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm build`, and `git diff --check`.
- [ ] Record the browser acceptance result.
