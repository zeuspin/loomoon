# Agent Skills Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the headless Loomoon runtime that discovers official Pi-compatible skills, routes explicit and Auto requests to one primary skill, persists multi-turn skill state, performs at most five dynamic clarification rounds, and exposes paid tools only after a version-bound plan confirmation.

**Architecture:** Add portable skill contracts and a generic registry in `packages/agent-runtime`, while API-owned repositories persist `SkillRun` state beside existing agent state. `AgentCoordinator` performs summary-only routing, binds an immutable skill snapshot, runs structured requirement decisions, and constructs Pi agents with phase-specific tool intersections. Existing agent runs remain one-response execution traces; a `SkillRun` spans multiple agent runs and links confirmed pending actions to the exact skill plan.

**Tech Stack:** TypeScript ES modules, TypeBox, Pi Agent Core, Fastify, Vitest, JSON persistence, pnpm monorepo.

## Global Constraints

- Node.js 24+ and pnpm 11+.
- TypeScript uses two spaces, double quotes, semicolons, strict mode, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.
- Local NodeNext imports include `.js` where required.
- Skills are official and server-owned; users cannot upload, edit, or supply skill instructions.
- The initial runtime supports image capabilities only and introduces no video behavior.
- One `SkillRun` has exactly one primary skill; one project has at most one active non-terminal `SkillRun`.
- Auto is summary-only and selects one skill, recommends candidates, or uses the base agent.
- Clarification is dynamically reassessed after every answer and emits at most five clarification rounds.
- Paid tools are absent before a valid plan confirmation.
- Skill IDs remain strings and must not become concrete TypeScript unions or coordinator branches.
- Skill files are Pi/Agent Skills compatible; Loomoon extensions live in `runtime.json`.
- No general filesystem tool is exposed to the model.
- Preserve unrelated dirty-worktree changes and stage only files listed by each task.

---

## File Structure

### New runtime files

- `packages/agent-runtime/src/skill-types.ts`: portable skill, routing, requirement, plan, and run-state types.
- `packages/agent-runtime/src/skill-registry.ts`: generic registry interface and immutable in-memory implementation.
- `packages/agent-runtime/src/skill-loader.ts`: safe filesystem package parsing and validation.
- `packages/agent-runtime/src/skill-state.ts`: `SkillRun` creation and transition rules.
- `packages/agent-runtime/src/skill-routing.ts`: summary-only routing prompt, parsing, and decision validation.
- `packages/agent-runtime/src/skill-decision.ts`: structured requirement/clarification/plan decision parsing and validation.
- `packages/agent-runtime/src/skill-context.ts`: active-skill system context and restricted reference lookup.

### New API files

- `apps/api/src/skill-run-repository.ts`: persistence interface backed by existing per-user JSON state.
- `apps/api/src/skill-orchestrator.ts`: multi-turn skill routing, clarification, planning, confirmation, and cancellation.
- `apps/api/src/skill-tool-policy.ts`: phase-aware tool-name intersection.
- `apps/api/src/official-skill-source.ts`: configured official skill source used by server startup.

### Modified files

- `packages/contracts/src/index.ts`: persisted `SkillRun`, clarification record, invocation, and pending-action linkage.
- `packages/agent-runtime/src/index.ts`: exports for the runtime modules.
- `packages/agent-runtime/src/pi-runtime.ts`: per-request system prompt and tool selection remain explicit and testable.
- `apps/api/src/agent-repository.ts`: store skill runs and clarification records in the same atomic user document.
- `apps/api/src/agent-coordinator.ts`: delegate new task messages to the skill orchestrator and preserve current base-agent behavior.
- `apps/api/src/agent-tools.ts`: accept an allowed-name set and remove fixed four-image wording/limits where the confirmed plan supplies bounds.
- `apps/api/src/demo-agent-application.ts`: bind pending actions to skill run and plan metadata without concrete skill branches.
- `apps/api/src/app.ts`: public skill discovery and skill-run control endpoints; invocation input on messages.
- `apps/api/src/main.ts`: construct registry, router, decision model, repository, orchestrator, and base prompt.

## Task 1: Add Skill and SkillRun Contracts

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/skill-contracts.test.ts`

**Interfaces:**
- Produces: `SkillInvocation`, `SkillRunStatus`, `PersistedSkillSnapshot`, `SkillRun`, `SkillClarificationRound`, `SkillExecutionPlan`, and optional `skillRunId`, `skillPlanVersion`, `skillPlanInputHash` fields on `PendingAgentAction`.
- Consumes: existing `EntityId`, `AgentStateDocument`, and pending-action contracts.

- [ ] **Step 1: Write failing serialization-shape tests**

Create `skill-contracts.test.ts` with a representative skill run and assert that `structuredClone` preserves the discriminated status, invocation mode, requirement provenance, five-round limit, plan version, and snapshot fields. Add an `AgentStateDocument` fixture containing `skillRuns` and `skillClarificationRounds` so compilation fails before the contracts exist.

```ts
const run: SkillRun = {
  id: "skill-run-1",
  userId: "user-1",
  projectId: "project-1",
  agentSessionId: "session-1",
  skillId: "brand-visual-system",
  skillVersion: "1.0.0",
  skillDigest: "sha256:abc",
  invocationMode: "explicit",
  status: "collecting",
  clarificationRound: 0,
  maxClarificationRounds: 5,
  requirements: {},
  requirementSources: {},
  unresolvedIssues: [],
  assumptions: [],
  snapshot: {
    instructions: "# Brand Visual System",
    requirementSchema: {},
    planSchema: {},
    referenceIds: [],
    declaredTools: ["get_canvas_context"]
  },
  version: 1,
  createdAt: "2026-07-27T00:00:00.000Z",
  updatedAt: "2026-07-27T00:00:00.000Z"
};
```

- [ ] **Step 2: Run the contract test and verify type failure**

Run: `pnpm --filter @loomoon/contracts test -- skill-contracts.test.ts`

Expected: FAIL because the skill contracts and document collections are not exported.

- [ ] **Step 3: Add the minimal persisted contracts**

Add JSON-safe requirement values, issue priorities/input kinds, assumption records, generic plan stages/actions/outputs, immutable snapshot data, clarification records, and lifecycle timestamps. Extend `AgentStateDocument` with:

```ts
skillRuns: SkillRun[];
skillClarificationRounds: SkillClarificationRound[];
```

Keep all `skillId` fields as `string`. Make new pending-action linkage optional for old persisted documents.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `pnpm --filter @loomoon/contracts test -- skill-contracts.test.ts && pnpm --filter @loomoon/contracts typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the contract change**

```bash
git add packages/contracts/src/index.ts packages/contracts/src/skill-contracts.test.ts
git commit -m "Add agent skill runtime contracts."
```

## Task 2: Implement SkillRun Lifecycle Rules

**Files:**
- Create: `packages/agent-runtime/src/skill-state.ts`
- Create: `packages/agent-runtime/src/skill-state.test.ts`
- Modify: `packages/agent-runtime/src/index.ts`

**Interfaces:**
- Consumes: `SkillRun`, `PersistedSkillSnapshot`, and `SkillInvocation` from `@loomoon/contracts`.
- Produces: `createSkillRun(input)`, `transitionSkillRun(run, status, now?)`, `recordClarificationRound(run, now?)`, and `isTerminalSkillRun(status)`.

- [ ] **Step 1: Write failing lifecycle tests**

Cover creation at version 1, legal transitions, illegal transitions, the five-round maximum, transition from `blocked` back to `collecting`, and terminal timestamp behavior.

```ts
expect(() => recordClarificationRound({
  ...run,
  clarificationRound: 5
})).toThrow("SKILL_CLARIFICATION_LIMIT");
```

- [ ] **Step 2: Run the tests and verify missing exports**

Run: `pnpm --filter @loomoon/agent-runtime test -- skill-state.test.ts`

Expected: FAIL because `skill-state.js` does not exist.

- [ ] **Step 3: Implement the state machine**

Use these transitions:

```ts
const transitions = {
  collecting: ["collecting", "planning", "blocked", "cancelled", "failed"],
  planning: ["collecting", "awaiting_confirmation", "blocked", "cancelled", "failed"],
  awaiting_confirmation: ["collecting", "executing", "cancelled", "failed"],
  executing: ["completed", "completed_with_errors", "cancelled", "failed"],
  blocked: ["collecting", "cancelled", "failed"],
  completed: [],
  completed_with_errors: [],
  cancelled: [],
  failed: []
} as const;
```

Increment `version` on every mutation and never mutate the input object.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `pnpm --filter @loomoon/agent-runtime test -- skill-state.test.ts && pnpm --filter @loomoon/agent-runtime typecheck`

Expected: PASS.

- [ ] **Step 5: Commit lifecycle support**

```bash
git add packages/agent-runtime/src/skill-state.ts packages/agent-runtime/src/skill-state.test.ts packages/agent-runtime/src/index.ts
git commit -m "Add skill run lifecycle rules."
```

## Task 3: Build the Safe Official Skill Loader and Registry

**Files:**
- Create: `packages/agent-runtime/src/skill-types.ts`
- Create: `packages/agent-runtime/src/skill-loader.ts`
- Create: `packages/agent-runtime/src/skill-loader.test.ts`
- Create: `packages/agent-runtime/src/skill-registry.ts`
- Create: `packages/agent-runtime/src/skill-registry.test.ts`
- Modify: `packages/agent-runtime/src/index.ts`
- Modify: `packages/agent-runtime/package.json`

**Interfaces:**
- Produces: `SkillSummary`, `ResolvedSkill`, `SkillLoadDiagnostic`, `loadSkillPackage(root, options)`, `InMemorySkillRegistry`, and `SkillRegistry`.
- Consumes: runtime JSON schema version 1 and Pi-compatible `SKILL.md` frontmatter.

- [ ] **Step 1: Add failing loader security tests**

Use temporary fixture directories created by the test. Cover valid packages, missing description, invalid names, duplicate IDs, unsafe `../` references, absolute paths, symlink escape, unknown tools, missing schemas, files over the configured limit, and one invalid package not hiding valid packages.

```ts
await expect(loadSkillPackage(root, {
  availableTools: new Set(["get_canvas_context"]),
  maxFileBytes: 64_000,
  maxPackageBytes: 256_000
})).rejects.toThrow("SKILL_PATH_OUTSIDE_PACKAGE");
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @loomoon/agent-runtime test -- skill-loader.test.ts skill-registry.test.ts`

Expected: FAIL because the loader and registry do not exist.

- [ ] **Step 3: Add YAML parsing dependency and implement package parsing**

Add the existing workspace-resolved `yaml` package as a direct runtime dependency. Parse only `SKILL.md` frontmatter and `runtime.json`; do not execute scripts or interpolate environment variables. Resolve paths with `realpath`, require every referenced file to stay beneath the package root, and compute a SHA-256 content digest over normalized package files.

- [ ] **Step 4: Implement immutable registry behavior**

`InMemorySkillRegistry` stores deep-cloned `ResolvedSkill` values keyed by `id@version`, returns public summaries without private instructions, rejects duplicate active IDs, and resolves only enabled skills. It exposes no method for user-supplied mutation.

- [ ] **Step 5: Run loader/registry tests and typecheck**

Run: `pnpm --filter @loomoon/agent-runtime test -- skill-loader.test.ts skill-registry.test.ts && pnpm --filter @loomoon/agent-runtime typecheck`

Expected: PASS.

- [ ] **Step 6: Commit registry support**

```bash
git add packages/agent-runtime/package.json packages/agent-runtime/src/skill-types.ts packages/agent-runtime/src/skill-loader.ts packages/agent-runtime/src/skill-loader.test.ts packages/agent-runtime/src/skill-registry.ts packages/agent-runtime/src/skill-registry.test.ts packages/agent-runtime/src/index.ts pnpm-lock.yaml
git commit -m "Add official skill registry."
```

## Task 4: Persist Skill Runs Atomically

**Files:**
- Create: `apps/api/src/skill-run-repository.ts`
- Create: `apps/api/src/skill-run-repository.test.ts`
- Modify: `apps/api/src/agent-repository.ts`
- Modify: `apps/api/src/agent-repository.test.ts`

**Interfaces:**
- Produces: `SkillRunRepository` methods `getSkillRun`, `getActiveSkillRun`, `saveSkillRun`, `saveClarificationRound`, and `listClarificationRounds`.
- Consumes: the per-user `AgentStateDocument` atomic write queue.

- [ ] **Step 1: Write failing repository tests**

Cover old state documents missing the new arrays, user/project/session scoping, one active run per project, optimistic version conflict, idempotent clarification round IDs, and terminal runs no longer blocking a new run.

```ts
await expect(repository.saveSkillRun(staleRun, { expectedVersion: 1 }))
  .rejects.toThrow("SKILL_RUN_VERSION_CONFLICT");
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @loomoon/api test -- skill-run-repository.test.ts agent-repository.test.ts`

Expected: FAIL because the repository methods and normalized collections do not exist.

- [ ] **Step 3: Normalize old documents and add atomic operations**

Update `#read` so missing arrays become empty arrays. Reuse the existing per-user exclusive queue for skill writes. Enforce user scope before returning data and enforce project-level active uniqueness inside the same exclusive write.

- [ ] **Step 4: Run repository tests**

Run: `pnpm --filter @loomoon/api test -- skill-run-repository.test.ts agent-repository.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit persistence support**

```bash
git add apps/api/src/skill-run-repository.ts apps/api/src/skill-run-repository.test.ts apps/api/src/agent-repository.ts apps/api/src/agent-repository.test.ts
git commit -m "Persist multi-turn skill runs."
```

## Task 5: Add Summary-Only Auto Routing

**Files:**
- Create: `packages/agent-runtime/src/skill-routing.ts`
- Create: `packages/agent-runtime/src/skill-routing.test.ts`
- Modify: `packages/agent-runtime/src/index.ts`

**Interfaces:**
- Produces: `buildSkillRoutingPrompt(content, summaries)`, `parseSkillRoutingDecision(text, availableIds)`, and `SkillRoutingModel`.
- Consumes: public `SkillSummary[]`; it must never consume full skill instructions or references.

- [ ] **Step 1: Write failing routing tests**

Cover `use_skill`, `recommend_skills` capped at three unique IDs, `use_base_agent`, unknown IDs, multiple selected primary skills, malformed JSON, disabled implicit invocation, and a prompt assertion that private instructions do not appear.

- [ ] **Step 2: Run routing tests and verify failure**

Run: `pnpm --filter @loomoon/agent-runtime test -- skill-routing.test.ts`

Expected: FAIL because routing helpers are missing.

- [ ] **Step 3: Implement strict routing parsing**

The model output must be one JSON object. Reject markdown fences and unknown fields. Clamp confidence to the schema range only by rejecting invalid values, not silently changing them. Recommendations remain user-visible choices and do not create a `SkillRun`.

- [ ] **Step 4: Run routing tests and typecheck**

Run: `pnpm --filter @loomoon/agent-runtime test -- skill-routing.test.ts && pnpm --filter @loomoon/agent-runtime typecheck`

Expected: PASS.

- [ ] **Step 5: Commit routing support**

```bash
git add packages/agent-runtime/src/skill-routing.ts packages/agent-runtime/src/skill-routing.test.ts packages/agent-runtime/src/index.ts
git commit -m "Add automatic skill routing."
```

## Task 6: Add Structured Requirement Decisions and Context

**Files:**
- Create: `packages/agent-runtime/src/skill-decision.ts`
- Create: `packages/agent-runtime/src/skill-decision.test.ts`
- Create: `packages/agent-runtime/src/skill-context.ts`
- Create: `packages/agent-runtime/src/skill-context.test.ts`
- Modify: `packages/agent-runtime/src/index.ts`

**Interfaces:**
- Produces: `parseSkillDecision(text, resolvedSkill)`, `buildActiveSkillPrompt(input)`, and `resolveSkillReference(skill, referenceId)`.
- Consumes: the fixed skill snapshot, prior requirements, clarification history, project/canvas summary, and current user message.

- [ ] **Step 1: Write failing decision tests**

Cover `clarify`, `propose_plan`, `respond`, and `block`; maximum three questions in one round; stable unique issue IDs; defaultable versus blocking issues; plan schema validation; unknown tool actions; task-count server limit; and malformed model output.

- [ ] **Step 2: Write failing context and reference tests**

Assert system safety instructions precede the active skill, exactly one full skill is included, state is wrapped as trusted server context, user text cannot close the trusted delimiter, reference IDs cannot contain paths, and another skill's reference cannot resolve.

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm --filter @loomoon/agent-runtime test -- skill-decision.test.ts skill-context.test.ts`

Expected: FAIL because decision and context modules are missing.

- [ ] **Step 4: Implement decision validation and safe context composition**

Represent the model response as:

```ts
type SkillDecision =
  | { action: "clarify"; assessment: RequirementAssessment; questions: ClarificationQuestion[] }
  | { action: "propose_plan"; assessment: RequirementAssessment; plan: SkillExecutionPlan }
  | { action: "respond"; message: string }
  | { action: "block"; reasonCode: string; message: string };
```

Use the skill's snapshotted JSON schemas for its domain payload and the common validator for the envelope. Do not accept tool names outside `declaredTools`.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `pnpm --filter @loomoon/agent-runtime test -- skill-decision.test.ts skill-context.test.ts && pnpm --filter @loomoon/agent-runtime typecheck`

Expected: PASS.

- [ ] **Step 6: Commit decision support**

```bash
git add packages/agent-runtime/src/skill-decision.ts packages/agent-runtime/src/skill-decision.test.ts packages/agent-runtime/src/skill-context.ts packages/agent-runtime/src/skill-context.test.ts packages/agent-runtime/src/index.ts
git commit -m "Validate structured skill decisions."
```

## Task 7: Enforce Phase-Aware Pi Tool Policy

**Files:**
- Create: `apps/api/src/skill-tool-policy.ts`
- Create: `apps/api/src/skill-tool-policy.test.ts`
- Modify: `apps/api/src/agent-tools.ts`
- Modify: `apps/api/src/agent-tools.test.ts`

**Interfaces:**
- Produces: `allowedToolsForSkillPhase(input): Set<AgentToolName>` and `createAgentTools({ allowedToolNames, ... })`.
- Consumes: system tool names, skill snapshot declarations, user availability, skill status, and confirmation state.

- [ ] **Step 1: Write failing intersection tests**

Verify collecting/planning excludes all paid tools, awaiting confirmation has no paid execution tool, executing exposes only confirmed plan actions, unknown names disappear, and base-agent calls remain backward compatible when `allowedToolNames` is omitted.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @loomoon/api test -- skill-tool-policy.test.ts agent-tools.test.ts`

Expected: FAIL because allowed-name filtering is missing.

- [ ] **Step 3: Implement physical tool filtering**

Build all eligible definitions, then filter before passing them to `Agent`. Remove fixed wording that claims every creative plan has two directions or four images. Keep the server maximum generation count at four per individual `generate_images` tool call, while a confirmed multi-stage plan may contain several bounded actions.

- [ ] **Step 4: Run tool tests**

Run: `pnpm --filter @loomoon/api test -- skill-tool-policy.test.ts agent-tools.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit tool policy**

```bash
git add apps/api/src/skill-tool-policy.ts apps/api/src/skill-tool-policy.test.ts apps/api/src/agent-tools.ts apps/api/src/agent-tools.test.ts
git commit -m "Enforce skill phase tool policy."
```

## Task 8: Implement the Multi-Turn Skill Orchestrator

**Files:**
- Create: `apps/api/src/skill-orchestrator.ts`
- Create: `apps/api/src/skill-orchestrator.test.ts`
- Modify: `apps/api/src/agent-coordinator.ts`
- Modify: `apps/api/src/agent-coordinator.test.ts`

**Interfaces:**
- Produces: `SkillOrchestrator.handleMessage(input)`, `confirmPlan(input)`, `revisePlan(input)`, and `cancelRun(input)`.
- Consumes: `SkillRegistry`, `SkillRunRepository`, `SkillRoutingModel`, `SkillDecisionModel`, tool application factory, and Pi runtime factory.

- [ ] **Step 1: Write failing explicit-invocation tests**

Cover valid official selection, invalid/disabled skill rejection, immutable snapshot binding, subsequent answers continuing the active run without resubmitting `skillId`, and explicit switching cancelling the previous run.

- [ ] **Step 2: Write failing Auto tests**

Cover one high-confidence skill, recommendation without run creation, base-agent fallback, unavailable returned skill, and no simultaneous primary skills.

- [ ] **Step 3: Write failing clarification tests**

Cover one answer resolving multiple issues, partial answers, new issues after an answer, conflicting answers, no duplicate question without evidence, message-id idempotency, rounds one through five, defaults after round five, and blocked after round five.

- [ ] **Step 4: Write failing planning tests**

Cover transition to planning, schema-validated plan, plan version/hash creation, material revision invalidating confirmation, terminal cancellation, and only one active project skill run.

- [ ] **Step 5: Run orchestrator tests and verify failure**

Run: `pnpm --filter @loomoon/api test -- skill-orchestrator.test.ts agent-coordinator.test.ts`

Expected: FAIL because the orchestrator and delegation do not exist.

- [ ] **Step 6: Implement routing and active-run delegation**

Extend message input with:

```ts
invocation?:
  | { mode: "auto" }
  | { mode: "explicit"; skillId: string };
clientMessageId?: string;
```

New task messages route when no active `SkillRun` exists. Answers delegate directly to the active run. Base-agent fallback executes the existing coordinator path unchanged.

- [ ] **Step 7: Implement clarification and plan persistence**

Save the user message before model work, use its ID as the idempotency key, save each assessment and question set atomically, increment rounds only when a new clarification message is committed, and bind proposed plans to normalized requirement hashes.

- [ ] **Step 8: Run orchestrator tests and API typecheck**

Run: `pnpm --filter @loomoon/api test -- skill-orchestrator.test.ts agent-coordinator.test.ts && pnpm --filter @loomoon/api typecheck`

Expected: PASS.

- [ ] **Step 9: Commit orchestration**

```bash
git add apps/api/src/skill-orchestrator.ts apps/api/src/skill-orchestrator.test.ts apps/api/src/agent-coordinator.ts apps/api/src/agent-coordinator.test.ts
git commit -m "Orchestrate multi-turn skill runs."
```

## Task 9: Bind Confirmed Plans to Pending Actions

**Files:**
- Modify: `apps/api/src/demo-agent-application.ts`
- Modify: `apps/api/src/agent-repository.ts`
- Modify: `apps/api/src/demo-agent-application.test.ts`
- Modify: `apps/api/src/agent-repository.test.ts`

**Interfaces:**
- Produces: pending actions carrying `skillRunId`, `skillPlanVersion`, and `skillPlanInputHash`; confirmation rejects stale plan bindings.
- Consumes: confirmed plan action, existing pending-action persistence, and generation executor.

- [ ] **Step 1: Write failing stale-confirmation tests**

Create an action for plan version 1, revise the skill plan to version 2, and assert confirmation fails with `SKILL_PLAN_CONFIRMATION_STALE`. Also cover exact-match confirmation and idempotent repeated confirmation.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @loomoon/api test -- demo-agent-application.test.ts agent-repository.test.ts`

Expected: FAIL because pending actions do not carry or validate skill bindings.

- [ ] **Step 3: Add generic skill binding without skill-ID branches**

When the orchestrator proposes a plan action, pass its run/version/hash into `proposePaidAction`. During atomic confirmation, load the current skill run and compare all three values before changing action, agent run, or tool-call state.

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter @loomoon/api test -- demo-agent-application.test.ts agent-repository.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit confirmation binding**

```bash
git add apps/api/src/demo-agent-application.ts apps/api/src/demo-agent-application.test.ts apps/api/src/agent-repository.ts apps/api/src/agent-repository.test.ts
git commit -m "Bind generation confirmation to skill plans."
```

## Task 10: Expose Discovery and SkillRun APIs

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`

**Interfaces:**
- Produces: `GET /api/v1/skills`, `GET /api/v1/skills/:skillId`, `GET /api/v1/skill-runs/:runId`, `POST /confirm`, `POST /revise`, and `POST /cancel`.
- Consumes: public registry metadata and authenticated orchestrator methods.

- [ ] **Step 1: Write failing API tests**

Verify discovery omits instructions/references/schemas/internal paths, explicit invocation accepts only server-known IDs, Auto invocation is accepted, run reads enforce user scope, confirm requires plan version/hash server state, revise invalidates confirmation, and cancelled runs reject later confirmation.

- [ ] **Step 2: Run app tests and verify failure**

Run: `pnpm --filter @loomoon/api test -- app.test.ts`

Expected: FAIL with missing routes or missing message invocation handling.

- [ ] **Step 3: Add authenticated routes and request validation**

Keep answers as ordinary message posts. Do not add an answer-question endpoint. Return public skill fields only:

```ts
{
  id,
  version,
  displayName,
  shortDescription,
  iconUrl,
  category,
  examplePrompts,
  allowExplicit,
  allowImplicit
}
```

- [ ] **Step 4: Run app tests and typecheck**

Run: `pnpm --filter @loomoon/api test -- app.test.ts && pnpm --filter @loomoon/api typecheck`

Expected: PASS.

- [ ] **Step 5: Commit APIs**

```bash
git add apps/api/src/app.ts apps/api/src/app.test.ts
git commit -m "Expose official skill runtime APIs."
```

## Task 11: Wire an Empty Official Catalog and Remove Fixed Prompt Assumptions

**Files:**
- Create: `apps/api/src/official-skill-source.ts`
- Create: `apps/api/src/official-skill-source.test.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `packages/agent-runtime/src/pi-runtime.ts`
- Modify: `packages/agent-runtime/src/pi-runtime.test.ts`
- Modify: `.env.example`
- Modify: `docs/development/environment.md`

**Interfaces:**
- Produces: server startup with a validated official skill directory and no hard-coded concrete skill registrations.
- Consumes: `LOOMOON_SKILLS_DIR`, `SkillRegistry`, router/decision runtime adapters, and base Pi runtime factory.

- [ ] **Step 1: Write failing source and prompt tests**

Assert a missing configured directory yields an empty catalog with diagnostics in development, duplicate/invalid skills remain unavailable, and the base prompt no longer requires exactly two directions or four images. Assert per-call active skill prompts can be supplied without mutating other runtime instances.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @loomoon/api test -- official-skill-source.test.ts && pnpm --filter @loomoon/agent-runtime test -- pi-runtime.test.ts`

Expected: FAIL because source wiring and per-call prompt composition are absent.

- [ ] **Step 3: Implement startup wiring**

Add `LOOMOON_SKILLS_DIR=./skills` as the default authoring source. Load only server-controlled packages. Construct separate summary-routing and decision adapters using Pi runtime calls with no business tools. Keep the base agent prompt focused on tool truthfulness, confirmation, selection safety, and concise user-visible responses.

- [ ] **Step 4: Document the environment value**

Explain that the directory contains official server-owned packages and is never selected from a user-supplied path.

- [ ] **Step 5: Run focused tests and typechecks**

Run: `pnpm --filter @loomoon/api test -- official-skill-source.test.ts && pnpm --filter @loomoon/agent-runtime test -- pi-runtime.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit runtime wiring**

```bash
git add apps/api/src/official-skill-source.ts apps/api/src/official-skill-source.test.ts apps/api/src/main.ts packages/agent-runtime/src/pi-runtime.ts packages/agent-runtime/src/pi-runtime.test.ts .env.example docs/development/environment.md
git commit -m "Wire the official skill runtime."
```

## Task 12: Add a Minimal Runtime Fixture and End-to-End Verification

**Files:**
- Create: `apps/api/src/test-fixtures/skills/test-visual-workflow/SKILL.md`
- Create: `apps/api/src/test-fixtures/skills/test-visual-workflow/runtime.json`
- Create: `apps/api/src/test-fixtures/skills/test-visual-workflow/schemas/requirements.schema.json`
- Create: `apps/api/src/test-fixtures/skills/test-visual-workflow/schemas/plan.schema.json`
- Create: `apps/api/src/skills-runtime.e2e.test.ts`
- Modify: `docs/development/agent-sidebar-acceptance.md`

**Interfaces:**
- Consumes: all runtime APIs and repository behavior from Tasks 1–11.
- Produces: a deterministic API-level proof without shipping a production skill.

- [ ] **Step 1: Create the test-only Pi-compatible skill fixture**

The fixture allows explicit and implicit invocation, declares only `get_canvas_context` during collection and `generate_images` for confirmed execution, requires `subject` and `audience`, and allows a default `aspectRatio`.

- [ ] **Step 2: Write the failing end-to-end test**

Exercise:

1. list public skills;
2. explicitly start the fixture;
3. receive two related clarification questions in round one;
4. answer both in one message;
5. receive a plan with assumptions;
6. confirm the exact plan;
7. observe a pending generation action linked to the skill run;
8. cancel and verify a delayed confirmation cannot execute;
9. run Auto with a base-agent prompt and verify no skill run is created.

- [ ] **Step 3: Run the end-to-end test and repair only runtime defects**

Run: `pnpm --filter @loomoon/api test -- skills-runtime.e2e.test.ts`

Expected: PASS after implementation. Do not add the fixture to the production skills directory.

- [ ] **Step 4: Run repository verification**

Run:

```bash
pnpm --filter @loomoon/contracts test
pnpm --filter @loomoon/agent-runtime test
pnpm --filter @loomoon/api test
pnpm typecheck
pnpm lint
```

Expected: all commands PASS.

- [ ] **Step 5: Update manual acceptance documentation**

Add checks for explicit invocation, Auto fallback, multi-question clarification, fifth-round blocking/default behavior, plan revision invalidation, cancellation, and public metadata secrecy.

- [ ] **Step 6: Commit verification coverage**

```bash
git add apps/api/src/test-fixtures/skills/test-visual-workflow apps/api/src/skills-runtime.e2e.test.ts docs/development/agent-sidebar-acceptance.md
git commit -m "Verify the agent skill runtime."
```

## Deferred Follow-Up Plans

The following work is intentionally not part of this plan:

1. Web Skill selector, Auto badge, clarification cards, and plan cards.
2. Fashion Skill review page at `/skills-review`.
3. Translation/adaptation of selected third-party fashion skills.
4. Authoring the three initial general-purpose Loomoon image skills.
5. Administration UI, marketplace, or user-authored skills.
