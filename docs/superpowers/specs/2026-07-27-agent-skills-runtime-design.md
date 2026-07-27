# Loomoon Agent Skills Runtime Design

## 1. Objective

Replace Loomoon's fixed two-direction, four-image agent flow with an extensible set of official visual-creation skills. Users can explicitly select one skill or leave the composer in Auto mode. The agent may ask multiple rounds of clarification, create a skill-specific execution plan, and invoke paid image tools only after the user confirms that plan.

The initial release contains three image-focused skills:

1. Brand Visual System
2. Creative Sticker Pack
3. Illustration and Visual Story

Video skills, video generation, user-authored skills, skill uploads, and a public skill marketplace are outside this design.

## 2. Product Principles

- Loomoon owns and reviews every available skill.
- A skill is optional. Auto remains the default composer mode.
- One `SkillRun` has exactly one primary skill.
- A conversation can contain multiple sequential skill runs.
- Ordinary image generation and image editing remain base-agent capabilities and are not forced into a skill.
- The agent asks only questions that materially improve or unblock the result.
- Clarification is dynamic, not a fixed questionnaire.
- Paid or materially expensive actions always require a version-bound user confirmation.
- Skill definitions drive behavior; application code must not branch on concrete skill IDs.

## 3. Pi Compatibility and Runtime Boundary

Skills use the Agent Skills format supported by Pi:

```text
skill-name/
├── SKILL.md
├── runtime.json
├── references/
├── schemas/
├── evals/
└── assets/
```

`SKILL.md` is the portable workflow definition. It contains valid frontmatter with `name` and `description`, followed by focused imperative instructions. References and assets use relative paths within the skill directory.

Loomoon currently embeds `@earendil-works/pi-agent-core` directly. It does not use Pi Coding Agent's `DefaultResourceLoader`, filesystem `read` tool, or `/skill:name` commands. Loomoon therefore implements a controlled web runtime on top of Pi Agent Core rather than exposing Pi's local filesystem loader.

This is intentionally Pi-compatible rather than Pi-native:

- Skill authoring follows the Agent Skills/Pi format.
- Auto routing starts with skill names and descriptions only.
- The complete selected skill is loaded on demand.
- References are loaded progressively through a restricted service capability.
- The server constructs the Pi Agent with only the tools allowed for the current phase.
- `SkillRun`, confirmation, persistence, tenancy, and billing rules remain Loomoon responsibilities.

The runtime must not give the model a general-purpose filesystem read capability merely to load skills.

## 4. Skill Package Responsibilities

### 4.1 `SKILL.md`

`SKILL.md` defines:

- when the skill should trigger;
- when it should not trigger;
- the workflow goal;
- required inputs and acceptable defaults;
- ordered working steps;
- expected output;
- when references should be loaded;
- how existing Loomoon tools should be used.

Names use 1–64 lowercase letters, numbers, and hyphens with no leading, trailing, or consecutive hyphens. Descriptions are no longer than 1,024 characters and front-load the use case and trigger boundary.

### 4.2 `runtime.json`

Loomoon-specific runtime configuration stays outside portable frontmatter:

```json
{
  "schemaVersion": 1,
  "interface": {
    "displayName": "品牌视觉全案",
    "shortDescription": "建立并扩展一致的品牌视觉系统",
    "icon": "assets/icon.svg",
    "category": "visual-design",
    "examplePrompts": ["为新的咖啡品牌建立一套视觉系统"]
  },
  "invocation": {
    "allowExplicit": true,
    "allowImplicit": true
  },
  "dependencies": {
    "tools": ["analyze_selected_images", "generate_images"]
  },
  "requirementsSchema": "schemas/requirements.schema.json",
  "planSchema": "schemas/plan.schema.json",
  "maxClarificationRounds": 5
}
```

The file contains declarative data only. It cannot introduce server code, database operations, arbitrary model tools, or paths outside its own skill package.

### 4.3 Optional resources

- `references/` contains detailed domain guidance loaded only when relevant.
- `schemas/` contains the skill-specific requirement and plan schemas.
- `evals/` contains positive, negative, ambiguous, and base-agent routing cases.
- `assets/` contains server-approved icons or templates.
- `scripts/` is omitted initially. It may be added only for deterministic processing that cannot be expressed reliably with instructions and existing tools.

## 5. Skill Discovery and Registry

Application components depend on a generic registry:

```ts
interface SkillRegistry {
  listAvailable(context: SkillAccessContext): Promise<SkillSummary[]>;
  resolve(input: {
    skillId: string;
    version?: string;
  }): Promise<ResolvedSkill | undefined>;
}
```

The registry validates and exposes available official skills without enumerating concrete IDs in TypeScript unions, router branches, React components, or API handlers.

The physical source of skill definitions is behind a `SkillSource` adapter. Local development may read validated packages from the filesystem. Production may load immutable bundled definitions, a database, or object storage. Source choice does not alter routing, orchestration, APIs, or UI behavior.

Invalid skills are excluded with diagnostics. One invalid skill must not make all other valid skills unavailable.

The public skill API returns only safe interface metadata. It never exposes complete instructions, private references, schemas, internal paths, or tool-policy details.

## 6. Invocation and Routing

### 6.1 Explicit invocation

The user selects one official skill and sends:

```json
{
  "content": "为咖啡品牌建立视觉系统",
  "selectionSnapshot": [],
  "invocation": {
    "mode": "explicit",
    "skillId": "brand-visual-system"
  }
}
```

The server verifies that the skill exists, is enabled, allows explicit invocation, and is available to the user. It then creates a `SkillRun`. The selected skill is not reclassified on subsequent clarification messages.

### 6.2 Auto invocation

Auto routing sees only summaries for currently enabled skills. It returns exactly one of:

```ts
type SkillRoutingDecision =
  | { action: "use_skill"; skillId: string; confidence: number; reason: string }
  | { action: "recommend_skills"; candidates: SkillCandidate[] }
  | { action: "use_base_agent"; reason: string };
```

- High-confidence matches start one primary skill and tell the user which skill was selected.
- Ambiguous matches recommend no more than three skills for the user to choose from.
- Requests that do not benefit from a skill continue through the base agent.
- Auto never starts multiple skills within one `SkillRun`.
- A request spanning multiple capabilities completes one primary skill first, then may recommend a new sequential skill run that inherits approved project assets.

Routing thresholds are calibrated using evaluation cases rather than treated as universal constants in the design.

## 7. Skill Run State

`PersistentAgentRun` represents one model response and tool loop. `SkillRun` represents a business task that can span several model responses.

```ts
type SkillRunStatus =
  | "collecting"
  | "planning"
  | "awaiting_confirmation"
  | "executing"
  | "completed"
  | "completed_with_errors"
  | "cancelled"
  | "blocked"
  | "failed";

type SkillRun = {
  id: string;
  userId: string;
  projectId: string;
  agentSessionId: string;
  skillId: string;
  skillVersion: string;
  skillDigest: string;
  invocationMode: "explicit" | "auto";
  status: SkillRunStatus;
  clarificationRound: number;
  maxClarificationRounds: number;
  requirements: Record<string, RequirementValue>;
  requirementSources: Record<string, RequirementSource>;
  unresolvedIssues: RequirementIssue[];
  assumptions: Assumption[];
  plan?: SkillExecutionPlan;
  planVersion?: number;
  planInputHash?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};
```

At creation, a run binds the selected skill ID, version, content digest, complete instructions, schemas, references index, and declared tool set. Updates to the registry cannot change a running task. The snapshot also allows historical runs to remain explainable if a skill is later changed or removed.

Only one non-terminal `SkillRun` may exist per project. Switching skills explicitly ends the active run and starts a new one; it does not erase conversation history.

## 8. Dynamic Clarification

Every user response triggers a fresh structured assessment:

```ts
type RequirementAssessment = {
  extracted: Record<string, RequirementValue>;
  unresolved: RequirementIssue[];
  assumptions: Assumption[];
  readiness: "needs_clarification" | "ready" | "blocked";
  confidence: number;
};
```

Each unresolved issue has a stable ID, question, reason, priority, answer type, related fields, optional choices, and an explicit indication of whether a default is permitted.

Clarification behavior:

1. Re-evaluate the full conversation, selected canvas nodes, uploaded assets, project context, and latest answer.
2. Preserve requirement provenance: explicit user statement, asset analysis, project inheritance, or agent assumption.
3. Remove resolved questions and detect new conflicts or consequential gaps.
4. Ask one to three closely related questions in a round when that is clearer than serial single-question messages.
5. Accept partial answers and free text even when structured choices are offered.
6. Never repeat a resolved question without new contradictory evidence.
7. Treat "你来决定" as permission to apply defaults only where the skill marks defaults as safe.
8. Increment the round counter only when the agent emits a clarification message. Network retries and duplicate client messages do not increment it.

After the user responds to round five, the runtime reassesses once more:

- If only defaultable items remain, record assumptions and propose a plan.
- If blocking information remains, set the run to `blocked` and explain the exact missing or conflicting information.
- A later user answer may move a blocked run back to `collecting`.

Safety, ownership, modification scope, and similarly non-inferable constraints cannot be bypassed by the round limit.

## 9. Planning, Confirmation, and Tool Policy

A skill produces a generic plan envelope with skill-specific fields validated by its plan schema:

```ts
type SkillExecutionPlan = {
  summary: string;
  assumptions: Assumption[];
  stages: SkillPlanStage[];
  outputs: PlannedOutput[];
  taskCount: number;
  estimatedCost?: string;
};
```

The runtime removes the current fixed requirements for exactly two creative directions and exactly four image tasks. Skills choose suitable direction and output counts within server-enforced cost and safety limits.

Confirmation binds all of:

- `skillRunId`;
- skill version and digest;
- plan version;
- normalized input hash;
- target node IDs;
- task count;
- expiration time.

Changing the plan or material requirements invalidates the previous confirmation.

Effective Pi Agent tools are the intersection of:

```text
system-enabled tools
∩ user-authorized tools
∩ skill-declared tools
∩ current-phase tools
```

During clarification and planning, paid generation tools are omitted from the Pi Agent's tool list. They become available only after a valid confirmation. Skill text and Pi's experimental `allowed-tools` metadata are never treated as the enforcement boundary.

References are loaded through a restricted operation scoped to the active `SkillRun` and a declared reference ID. The model cannot submit arbitrary filesystem paths or read references owned by another skill.

## 10. Initial Skills

### 10.1 Brand Visual System

Goal: establish an approved, extensible visual system rather than generate an isolated logo.

The workflow collects brand name, business, audience, channels, desired perception, existing assets, and prohibited elements. It first produces a brand summary and two to four meaningfully differentiated directions. The user selects or revises a direction before Loomoon expands it into logo concepts, color, typography character, graphic language, and explicitly requested applications.

The skill does not promise to generate every possible brand asset in one batch. Ordinary single-poster or single-image requests stay with the base agent.

### 10.2 Creative Sticker Pack

Goal: produce a coherent set of reusable expressions while preserving character identity.

The workflow establishes the character source, platform, theme, required expressions, text policy, and background requirements. Defaults are eight square transparent-background stickers and no generated text unless requested. It creates two consistency samples before generating the full approved set, then arranges individual results as a canvas grid.

A request for one humorous image does not automatically trigger this skill.

### 10.3 Illustration and Visual Story

Goal: choose and execute an appropriate single-illustration, series, or sequential visual narrative workflow.

The workflow establishes story or theme, audience, channel, frame count, recurring characters and locations, style references, aspect ratio, and text-safe areas. Multi-frame work starts with a structured storyboard and low-cost previews before final rendering. Individual failed or inconsistent frames can be retried without regenerating the entire sequence.

## 11. Web Interaction

The composer defaults to `Auto`. A server-driven selector lists Auto and available official skills with search, description, icon, examples, and official status. It contains no creation, upload, installation, or editing controls.

An explicitly selected skill appears as a removable composer tag. Once a run begins, changing that selection requires ending the current run. Auto selection is always visible and changeable before paid execution.

Clarification cards use generic input schemas for text, single select, multi-select, number, file upload, and canvas selection. No React component branches on a concrete skill ID.

The plan card shows the active skill, interpreted requirements, assumptions, stages, outputs, task count, selected asset roles, cost information, and confirm/revise actions.

The sidebar keeps conversation history but exposes only one active collecting, awaiting-confirmation, or executing task at a time. Terminal runs collapse into history cards.

## 12. API Shape

Public discovery:

```text
GET /api/skills
GET /api/skills/:skillId
```

Agent messages continue through the existing session message API with optional invocation data on the message that starts a task. Later answers are ordinary chat messages associated by the server with the active run.

Run control:

```text
GET  /api/skill-runs/:runId
POST /api/skill-runs/:runId/confirm
POST /api/skill-runs/:runId/revise
POST /api/skill-runs/:runId/cancel
```

There is no separate answer-question endpoint. The browser cannot submit skill instructions, reference paths, schemas, or requested tool names.

## 13. Consistency and Recovery

- Client message IDs make message processing and clarification counting idempotent.
- Skill runs use a version or optimistic lock for concurrent updates.
- Plan confirmations can be consumed exactly once.
- Stale tabs receive a conflict and refresh current state rather than overwrite it.
- Cancelling a run prevents late tool results from creating new tasks.
- Schema-invalid model output receives one structured repair attempt. A second failure preserves the current state and returns a retryable error.
- A required reference failure blocks or retries the run; it cannot fall back to another skill's reference.
- Partial generation retains successful results and records per-action failures.
- Restarted API processes can restore collecting, awaiting-confirmation, and executing runs.
- User, project, session, run, action, and asset scope are checked on every operation.

## 14. Validation and Acceptance

### 14.1 Package validation

- Validate `SKILL.md` frontmatter against Pi/Agent Skills limits.
- Validate `runtime.json` and referenced schemas.
- Reject duplicate names and unsafe paths.
- Verify every declared tool exists.
- Enforce per-file and per-package size limits.
- Exclude invalid skills while keeping valid skills available.

### 14.2 Routing evaluation

Each skill includes positive, negative, ambiguous, adjacent-skill, and base-agent cases. Tests measure both missed triggers and false triggers. Explicit invocation bypasses Auto classification but still performs authorization and availability checks.

### 14.3 Clarification acceptance

- One answer can resolve several issues.
- New evidence can introduce a new question.
- Partial answers and contradictions are handled explicitly.
- Resolved questions are not repeated without cause.
- Duplicate requests do not increment the round count.
- The fifth answered round leads to a plan with assumptions or a precise blocked state.

### 14.4 Confirmation acceptance

- Plans are not fixed to two directions or four images.
- Cost and task bounds remain server-enforced.
- Requirement changes expire old confirmations.
- Unconfirmed agents do not receive paid tools.
- Confirmed actions remain bound to the exact plan and input hash.

### 14.5 Pi runtime acceptance

- Auto context contains summaries rather than every full skill.
- Execution context contains exactly one active skill.
- Skill instructions cannot replace the Loomoon base safety prompt.
- Only phase-appropriate tools are passed to `Agent`.
- Restricted reference loading cannot access arbitrary files.
- Existing Pi streaming and tool-call events continue through repository persistence, audit, and UI synchronization.

## 15. Required Changes to the Existing Fixed Flow

Implementation will:

- replace the rule that no selected images always means `create_plan`;
- generalize `CreativePlan.directions` from a fixed tuple to a bounded array or replace it with the generic skill plan representation;
- remove the `taskCount === 4` confirmation assumption;
- generalize clarification beyond multi-image edit scope;
- preserve existing pending-action confirmation, generation execution, canvas synchronization, and audit capabilities;
- add a registry, router, skill-run repository, context builder, restricted reference loader, and structured decision validator;
- avoid concrete skill IDs in orchestration, contracts, API handlers, and UI rendering logic.

## 16. Out of Scope

- Video generation or video skills
- User-uploaded, user-authored, or user-edited skills
- Multiple simultaneous primary skills in one run
- A public skill marketplace
- A skill administration UI
- Arbitrary executable scripts in the initial skills
- General server filesystem access for the agent
