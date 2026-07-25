# Agent Selection Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure Pi knows which canvas images were attached to the current user message before it chooses a tool.

**Architecture:** Agent Coordinator will create a model-only prompt containing the original user text plus a trusted Selection Snapshot summary. Persisted and user-visible messages remain unchanged.

**Tech Stack:** TypeScript, Pi Agent Core, Vitest, Fastify.

## Global Constraints

- Only project-scoped node IDs may enter the model context.
- Never include URLs, filesystem paths or object-storage keys.
- Tools continue to use the immutable message Selection Snapshot.

---

### Task 1: Add selection-aware model prompt

**Files:**
- Modify: `apps/api/src/agent-coordinator.ts`
- Test: `apps/api/src/agent-coordinator.test.ts`

**Interfaces:**
- Produces: `buildAgentPrompt(content: string, selectedNodeIds: string[]): string`.

- [ ] Add a failing test that captures the prompt passed to `completeWithTrace`.
- [ ] Verify a two-image selection is absent from the current prompt.
- [ ] Implement a model-only trusted selection summary.
- [ ] Verify the test passes and persisted user content remains unchanged.

### Task 2: Regression verification

**Files:**
- Verify: `apps/api/src/*`

- [ ] Run API tests and typecheck.
- [ ] Run full workspace tests, typecheck and build.
- [ ] Restart the API development process.

