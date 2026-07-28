# New Project and Agent Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every new-project entry create and navigate to an isolated project workspace, with either a blank Agent conversation or a one-time homepage prompt as its first retryable message.

**Architecture:** Keep the existing project and Agent APIs, but make `AppShell` the owner of canonical Canvas routing and make `App` reload whenever its explicit `projectId` changes. Hand homepage prompts across the route with a one-time `sessionStorage` record, then let `AgentSidebar` submit that record through its existing optimistic-message and retry pipeline.

**Tech Stack:** TypeScript, React 19, Vite, Konva/react-konva, assistant-ui, Fastify, Vitest.

## Global Constraints

- A Canvas or project-list creation starts with an empty Canvas and an empty, project-specific Agent session.
- A homepage prompt creation sends that prompt as the first message of the new project's independent Agent session.
- No project-scoped Canvas or Agent state may survive a project boundary.
- The canonical Canvas identity is `/canvas?projectId=<id>`.
- Initial Agent prompt failure preserves the project and a retryable failed message.
- Preserve the existing visual design, email/password authentication, and desktop/mobile behavior.
- Preserve strict TypeScript settings including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Do not create a branch, commit, or push without explicit permission.

---

### Task 1: One-time project launch intent

**Files:**
- Create: `apps/web/src/project-launch-intent.ts`
- Create: `apps/web/src/project-launch-intent.test.ts`

**Interfaces:**
- Produces: `KeyValueStorage`, `ProjectLaunchIntent`, `queueProjectLaunchIntent(storage, intent)`, `consumeProjectLaunchIntent(storage, projectId)`.
- Consumes: the browser's `sessionStorage` through the minimal `KeyValueStorage` interface.

- [ ] **Step 1: Write failing queue/consume tests**

```ts
const storage = createMemoryStorage();
queueProjectLaunchIntent(storage, {
  id: "launch-1",
  projectId: "project-2",
  prompt: "设计一张夏日海报",
  createdAt: "2026-07-27T00:00:00.000Z",
});

expect(consumeProjectLaunchIntent(storage, "project-1")).toBeUndefined();
expect(consumeProjectLaunchIntent(storage, "project-2")?.prompt).toBe(
  "设计一张夏日海报",
);
expect(consumeProjectLaunchIntent(storage, "project-2")).toBeUndefined();
```

Add separate tests proving that blank prompts are rejected and malformed JSON is removed without throwing.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @loomoon/web test -- project-launch-intent.test.ts`

Expected: FAIL because `project-launch-intent.js` does not exist.

- [ ] **Step 3: Implement the storage contract and exact-once consumption**

```ts
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ProjectLaunchIntent {
  id: string;
  projectId: string;
  prompt: string;
  createdAt: string;
}

export function queueProjectLaunchIntent(
  storage: KeyValueStorage,
  intent: ProjectLaunchIntent,
): void;

export function consumeProjectLaunchIntent(
  storage: KeyValueStorage,
  projectId: string,
): ProjectLaunchIntent | undefined;
```

Use a per-project key such as `loomoon:project-launch:<encoded-project-id>`. Validate all four string fields after parsing. Only remove the requested project's key.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm --filter @loomoon/web test -- project-launch-intent.test.ts`

Expected: PASS.

### Task 2: AppShell creation entry points and canonical navigation

**Files:**
- Modify: `apps/web/src/app-shell.tsx`
- Modify: `apps/web/src/home-page.tsx`
- Modify: `apps/web/src/library-pages.tsx`
- Modify: `apps/web/src/app-shell.css`
- Modify: `apps/web/src/app-shell-state.ts`
- Modify: `apps/web/src/app-shell-state.test.ts`

**Interfaces:**
- Consumes: Task 1 `queueProjectLaunchIntent` and existing `api.createProject`, `hrefForRoute`, protected-login intent recovery.
- Produces: one guarded `createBlankProject()` flow and one guarded `createPromptProject(prompt, referenceCaseId?)` flow; passes `projectId` and navigation callbacks to Canvas.

- [ ] **Step 1: Write failing creation-decision tests**

Add a pure descriptor to `app-shell-state.ts`:

```ts
export function describeProjectCreation(
  prompt: string | undefined,
  referenceTitle?: string,
): {
  name: string;
  initialPrompt?: string;
};
```

Test the exact rules:

```ts
expect(describeProjectCreation(undefined)).toEqual({
  name: "未命名项目",
});
expect(describeProjectCreation("设计海报")).toEqual({
  name: "未命名",
  initialPrompt: "设计海报",
});
expect(describeProjectCreation("做同款", "霓虹包装")).toEqual({
  name: "同款 · 霓虹包装",
  initialPrompt:
    "做同款\n\n参考灵感案例：霓虹包装。请先分析其构图、材质和配色，再提出适合本项目的方向。",
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @loomoon/web test -- app-shell-state.test.ts`

Expected: FAIL because `describeProjectCreation` is not exported.

- [ ] **Step 3: Implement the descriptor and two guarded flows**

`createBlankProject` creates `未命名项目`, refreshes the project list, and immediately navigates to `{ kind: "canvas", projectId: created.id }`.

`submitPrompt` creates the derived project, queues this exact record before navigation, refreshes projects, and navigates without calling `createAgentSession` or `sendAgentMessage` in `AppShell`:

```ts
queueProjectLaunchIntent(window.sessionStorage, {
  id: crypto.randomUUID(),
  projectId: created.id,
  prompt: descriptor.initialPrompt,
  createdAt: new Date().toISOString(),
});
```

Use one `projectCreationBusy` state for both flows. Render one `aria-live="polite"` shell status toast using the existing neutral/error colors in `app-shell.css`; clear it before the next attempt. On failure, show `ApiError.message` or `创建项目失败，请稍后重试。` and keep the source route unchanged.

- [ ] **Step 4: Wire every shell-level entry**

- `ShellRail` receives `onCreate` and its “＋” calls the protected blank-create action.
- `HomePage` receives `onCreateProject`; the recent-project “新建项目” card no longer submits the artificial prompt `创建一个新的视觉设计项目`.
- `ProjectsPage.onCreate` calls blank creation rather than navigating home.
- Homepage composer, quick prompts, login-resumed prompts and inspiration remix continue through `submitPrompt`.
- Render `<CanvasWorkspace projectId={route.projectId} onOpenProject={...} onLeaveCanvas={...} />`.

- [ ] **Step 5: Verify focused shell tests**

Run: `pnpm --filter @loomoon/web test -- app-shell-state.test.ts deferred-intent.test.ts app-route.test.ts home-state.test.ts`

Expected: PASS.

### Task 3: Project-bound Canvas hydration and reset

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/canvas-tools.ts`
- Modify: `apps/web/src/canvas-tools.test.ts`

**Interfaces:**
- Consumes: explicit `projectId` prop from Task 2, Task 1 `consumeProjectLaunchIntent`, existing `normalizeCanvasNode`, Agent session APIs.
- Produces: `canvasNodesForProject(project)`, `CanvasWorkspaceProps`, stale-load protection, and a project-bound `initialAgentMessage` state.

- [ ] **Step 1: Write the failing empty-Canvas regression test**

```ts
expect(canvasNodesForProject(emptyProject)).toEqual([]);
expect(canvasNodesForProject(populatedProject)).toEqual([
  expect.objectContaining({ id: "node-1", visible: true, locked: false }),
]);
```

The production change that makes this test pass is removing `createCanvasShowcaseNodes()` from project hydration.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @loomoon/web test -- canvas-tools.test.ts`

Expected: FAIL because `canvasNodesForProject` does not exist.

- [ ] **Step 3: Implement `canvasNodesForProject` and remove showcase fallback**

```ts
export function canvasNodesForProject(project: DemoProject): CanvasNode[] {
  return project.canvas.nodes.map(normalizeCanvasNode);
}
```

Remove `createCanvasShowcaseNodes`, its visual-baseline test and its `app.tsx` import. The inspiration images remain available through the real inspiration UI; project hydration never synthesizes Canvas content.

- [ ] **Step 4: Make Canvas project identity explicit**

```ts
export interface CanvasWorkspaceProps {
  projectId: string;
  onOpenProject(projectId: string): void;
  onLeaveCanvas(): void;
}

export function App(props: CanvasWorkspaceProps) { /* existing workspace */ }
```

Authenticate once, then run project hydration whenever `props.projectId` changes. Stop reading the project identity only once from `window.location.search`.

- [ ] **Step 5: Reset every project-scoped state before hydration**

Add one local `beginProjectLoad(projectId)` routine that clears the project, Canvas nodes and selection, Agent session/messages/run/pending data, input, undo/redo, region target, temporary Canvas gestures, layer/history popovers, and pending save/generator timers. Set `initialized.current = false`, restore the default camera and select tool, then start the request.

Use an incrementing `projectLoadSequence.current`. After each awaited API call, return without setting state when its sequence is no longer current.

- [ ] **Step 6: Hydrate the project and its independent Agent session**

For the current sequence only:

1. `api.getProject(props.projectId)`.
2. `api.createAgentSession(project.id)`.
3. `api.getAgentSession(session.id)`.
4. `api.getAgentRun(session.activeRunId)` when present.
5. `api.listProjects()`.

Then set the project, normalized Canvas nodes, empty selection, canonical timeline and active run. Consume the matching launch intent and convert it to:

```ts
{
  id: launch.id,
  text: launch.prompt,
  nodeIds: [],
  createdAt: launch.createdAt,
}
```

- [ ] **Step 7: Key Agent UI by project session**

Render `AgentSidebar` with `key={agentSession?.id ?? project.id}` so its internal optimistic messages, retry state and composer state cannot cross a project boundary.

- [ ] **Step 8: Verify Canvas tests and type safety**

Run: `pnpm --filter @loomoon/web test -- canvas-tools.test.ts canvas-state.test.ts app-route.test.ts && pnpm --filter @loomoon/web typecheck`

Expected: PASS.

### Task 4: AgentSidebar external first-message pipeline

**Files:**
- Modify: `packages/agent-ui/src/agent-sidebar.tsx`
- Modify: `packages/agent-ui/src/agent-sidebar.test.tsx`
- Modify: `packages/agent-ui/src/message-state.test.ts`

**Interfaces:**
- Consumes: Task 3 `initialAgentMessage` with `{ id, text, nodeIds, createdAt }` and the existing `onSend` callback.
- Produces: optional `initialMessage` and `onInitialMessageStarted` props; one optimistic submission shared by external and composer sends.

- [ ] **Step 1: Write failing public-prop and reconciliation tests**

Render a sidebar with an initial message and assert its content is included in the server markup:

```tsx
const markup = renderSidebar({
  agentSessionId: "session-2",
  agentMessages: [],
  initialMessage: {
    id: "launch-1",
    text: "设计一张夏日海报",
    nodeIds: [],
    createdAt: "2026-07-27T00:00:00.000Z",
  },
});
expect(markup).toContain("设计一张夏日海报");
```

Extend `message-state.test.ts` to prove a persisted copy with the same session/content/time replaces the launch optimistic message without duplication.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @loomoon/agent-ui test -- agent-sidebar.test.tsx message-state.test.ts`

Expected: FAIL because `initialMessage` is not part of `AgentSidebarProps` and is not rendered.

- [ ] **Step 3: Extract one optimistic send callback**

Move the current inline provider `onSend` body into a `useCallback` named `sendOptimistically`. It must:

1. Accept `{ text, nodeIds }` and an optional stable client message ID/createdAt.
2. Insert the optimistic user message once.
3. Await `props.onSend`.
4. Mark the same optimistic message failed and rethrow on error.

The normal composer and the external initial-message effect both call this function.

- [ ] **Step 4: Dispatch the initial message exactly once**

Initialize the optimistic list with `props.initialMessage` so the prompt is visible on first render. On later `initialMessage` prop changes, append it only when its ID is absent. Track attempted initial IDs in a ref. On mount or prop change, if the ID has not been attempted, mark it attempted, call `props.onInitialMessageStarted?.(id)`, and send it through `sendOptimistically` with an `optimisticAlreadyQueued: true` option so no duplicate entry is inserted.

Keep the failed optimistic entry in state so the existing retry button resubmits its content. The retry path must continue to switch `failed → pending → sent/failed`.

- [ ] **Step 5: Pass and clear the launch message from Canvas**

In `app.tsx`, pass `initialMessage={initialAgentMessage}` and clear the parent handoff state in `onInitialMessageStarted`. The AgentSidebar copy remains until it is reconciled or the user leaves the project.

- [ ] **Step 6: Verify Agent UI tests and type safety**

Run: `pnpm --filter @loomoon/agent-ui test && pnpm --filter @loomoon/agent-ui typecheck && pnpm --filter @loomoon/web typecheck`

Expected: PASS.

### Task 5: Canvas project create, switch and delete navigation

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/app-route.ts`
- Modify: `apps/web/src/app-route.test.ts`

**Interfaces:**
- Consumes: Task 3 `onOpenProject` and `onLeaveCanvas` callbacks.
- Produces: all Canvas project-management actions update the canonical AppShell route instead of bypassing it.

- [ ] **Step 1: Add a failing post-deletion route test**

Add `routeAfterProjectDeletion` to `app-route.ts` and test both branches:

```ts
expect(routeAfterProjectDeletion([{ id: "project-2" }])).toEqual({
  kind: "canvas",
  projectId: "project-2",
});
expect(routeAfterProjectDeletion([])).toEqual({ kind: "items" });
```

Implement the helper with the minimal accepted input `ReadonlyArray<{ id: string }>` and return type `AppRoute`.

- [ ] **Step 2: Route successful Canvas creation**

After `api.createProject`, refresh summaries, close the dialog/menu and call `props.onOpenProject(created.id)`. Do not directly retain the old Agent state or locally hydrate only `project` and `nodes`; Task 3 handles the full route-driven load.

- [ ] **Step 3: Route Canvas project switching**

Each project-menu item calls `props.onOpenProject(item.id)`. The menu closes immediately; changing the route triggers Task 3 hydration.

- [ ] **Step 4: Route deletion safely**

After deletion, refresh summaries and call `routeAfterProjectDeletion(remaining)`. Open the returned Canvas project through `props.onOpenProject`; for `{ kind: "items" }`, call `props.onLeaveCanvas()` to show the project list without silently bootstrapping an unaddressed project.

- [ ] **Step 5: Verify focused web tests**

Run: `pnpm --filter @loomoon/web test -- dialog-state.test.ts app-route.test.ts app-shell-state.test.ts canvas-tools.test.ts`

Expected: PASS.

### Task 6: Server isolation regression and end-to-end acceptance

**Files:**
- Modify: `apps/api/src/agent-coordinator.test.ts`
- Modify: `apps/api/src/project-registry.test.ts`
- Modify: `design-qa.md`
- Create: screenshots under `docs/design-qa-assets/` only when needed for the acceptance record.

**Interfaces:**
- Consumes: existing `ProjectRegistry`, `AgentCoordinator`, local Chrome session and completed Tasks 1–5.
- Produces: regression evidence that projects and Agent sessions remain isolated, plus desktop/mobile acceptance notes.

- [ ] **Step 1: Write the failing-or-protective isolation test before production work that depends on it**

```ts
const first = await coordinator.createSession("user-1", "project-1");
const firstAgain = await coordinator.createSession("user-1", "project-1");
const second = await coordinator.createSession("user-1", "project-2");

expect(firstAgain.id).toBe(first.id);
expect(second.id).not.toBe(first.id);
expect(second.messageIds).toEqual([]);
```

If this passes immediately, it documents already-correct server behavior; do not change production API code for this task.

- [ ] **Step 2: Run all focused package tests**

Run: `pnpm --filter @loomoon/web test && pnpm --filter @loomoon/agent-ui test && pnpm --filter @loomoon/api test`

Expected: PASS.

- [ ] **Step 3: Run repository verification**

Run: `pnpm test && pnpm typecheck && pnpm build`

Expected: PASS, aside from the repository's existing Vite bundle-size warning.

- [ ] **Step 4: Verify desktop behavior in the user's chosen Chrome browser**

At the current desktop viewport:

1. Create from the global “＋”; verify a new URL, empty Canvas and empty Agent conversation.
2. Send a message in project A, create project B, verify B has no A messages, then switch back to A.
3. Submit a homepage prompt; verify navigation occurs before completion and the prompt appears immediately as the first user message.
4. Switch projects rapidly and use browser back/forward; verify URL, project title, Canvas and Agent conversation always agree.
5. Trigger or simulate an Agent failure using the mock/error path and verify the failed prompt remains retryable.

- [ ] **Step 5: Verify mobile behavior in Chrome responsive mode**

At `390 × 844`, repeat global/create-list and homepage-prompt flows. Confirm creation controls are not clipped, are disabled while busy, and the new Agent conversation remains usable.

- [ ] **Step 6: Record acceptance results**

Append exact tested routes, viewport sizes, results and any remaining mock limitations to `design-qa.md`. Do not claim visual parity from screenshots alone; this task changes behavior, so interaction evidence is required.
