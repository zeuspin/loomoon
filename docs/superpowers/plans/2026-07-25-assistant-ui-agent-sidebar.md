# Assistant UI Agent Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 assistant-ui ExternalStoreRuntime 完整替换 Loomoon Agent 侧栏，同时保持现有 Project、API、SSE 和 CanvasOperation 协议不变。

**Architecture:** 新建 `@loomoon/agent-ui`，将 Loomoon Project 映射成 assistant-ui 的外部消息仓库，并通过回调调用现有 Web 命令。`apps/web` 只传递数据和命令；消息、附件、工具状态与浅色视觉全部封装在包内。迁移期由 `VITE_AGENT_UI_RUNTIME` 在新旧侧栏间切换。

**Tech Stack:** React 19、assistant-ui ExternalStoreRuntime、Base UI、TypeScript、Vitest、Vite、Konva

## Global Constraints

- `apps/web` 不得直接导入 `@assistant-ui/*`。
- PostgreSQL 和现有 API 是消息、计划和任务的唯一权威来源。
- 后端没有取消接口，因此不提供虚假取消操作。
- Demo 默认浅色并隐藏主题切换入口；暗色 Token 能力保留。
- 控件圆角 `2px`，容器和媒体最大 `4px`；白色为主要内容面。
- Legacy 仅用于迁移期回退，验收后删除。

---

### Task 1: Agent UI 包和消息投影

**Files:**
- Create: `packages/agent-ui/package.json`
- Create: `packages/agent-ui/tsconfig.json`
- Create: `packages/agent-ui/src/model.ts`
- Create: `packages/agent-ui/src/message-mapper.ts`
- Create: `packages/agent-ui/src/message-mapper.test.ts`
- Create: `packages/agent-ui/src/index.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `DemoProject`, `AgentMessage`, `CreativePlan`, `ConfirmationGrant`, `CanvasNode`。
- Produces: `LoomoonAgentEntry[]`、`mapProjectToAgentEntries(project)`、稳定消息/工具 ID。

- [ ] **Step 1: 写入消息映射失败测试**

  测试用手写 Project fixture 断言：

  ```ts
  expect(mapProjectToAgentEntries(project)).toEqual([
    { id: "m1", kind: "message", role: "user", text: "生成海报", selectionNodeIds: ["n1"] },
    { id: "plan:p1", kind: "plan", status: "awaiting_confirmation", planId: "p1" },
  ]);
  ```

  另测 pending confirmation、generation records 和无法识别状态的 fallback。

- [ ] **Step 2: 运行测试确认缺失实现导致失败**

  Run: `pnpm --filter @loomoon/agent-ui test`

  Expected: FAIL，`message-mapper.ts` 或导出不存在。

- [ ] **Step 3: 实现最小投影模型**

  `LoomoonAgentEntry` 使用判别联合：

  ```ts
  type LoomoonAgentEntry =
    | { id: string; kind: "message"; role: AgentMessage["role"]; text: string; selectionNodeIds: string[]; createdAt: string }
    | { id: string; kind: "plan"; plan: CreativePlan }
    | { id: string; kind: "confirmation"; confirmation: ConfirmationGrant }
    | { id: string; kind: "generation"; record: GenerationRecord }
    | { id: string; kind: "fallback"; text: string };
  ```

  按 `createdAt` 和稳定 ID 投影，不修改传入 Project。

- [ ] **Step 4: 运行包测试、类型检查和构建**

  Run: `pnpm --filter @loomoon/agent-ui test && pnpm --filter @loomoon/agent-ui typecheck && pnpm --filter @loomoon/agent-ui build`

  Expected: PASS。

### Task 2: assistant-ui ExternalStoreRuntime 适配器

**Files:**
- Create: `packages/agent-ui/src/runtime-adapter.tsx`
- Create: `packages/agent-ui/src/runtime-adapter.test.ts`
- Modify: `packages/agent-ui/src/index.ts`

**Interfaces:**
- Consumes: `LoomoonAgentEntry[]`、`isRunning`、`onSend(text, nodeIds)`、当前附件快照。
- Produces: `LoomoonAgentRuntimeProvider`，内部调用 `useExternalStoreRuntime` 和 `AssistantRuntimeProvider`。

- [ ] **Step 1: 写入发送解析失败测试**

  将 assistant-ui `AppendMessage` 的文本 part 和自定义附件快照传入纯函数：

  ```ts
  expect(parseOutgoingMessage(message, attachment)).toEqual({
    text: "修改这些图片",
    nodeIds: ["n1", "n2"],
  });
  ```

  空文本、非文本 part 和重复 node ID 必须得到明确结果。

- [ ] **Step 2: 运行测试确认失败**

  Run: `pnpm --filter @loomoon/agent-ui test`

  Expected: FAIL，`parseOutgoingMessage` 不存在。

- [ ] **Step 3: 实现 ExternalStoreRuntime**

  - `convertMessage` 将普通消息映射为 `ThreadMessageLike`。
  - 结构化条目以稳定 tool-call part 或 metadata 交给自定义 UI。
  - `onNew` 只调用传入的 `onSend`。
  - 只提供真实能力；不传 `onCancel`、`onEdit` 或 `onReload`。
  - `isRunning` 和 `isSendDisabled` 来自 Web 权威状态。

- [ ] **Step 4: 运行测试、类型检查和构建**

  Run: `pnpm --filter @loomoon/agent-ui test && pnpm --filter @loomoon/agent-ui typecheck && pnpm --filter @loomoon/agent-ui build`

  Expected: PASS。

### Task 3: 多图附件和浅色 Agent 组件

**Files:**
- Create: `packages/agent-ui/src/canvas-selection.ts`
- Create: `packages/agent-ui/src/canvas-selection.test.ts`
- Create: `packages/agent-ui/src/agent-sidebar.tsx`
- Create: `packages/agent-ui/src/tool-ui.tsx`
- Create: `packages/agent-ui/src/styles.css`
- Create: `packages/agent-ui/src/agent-sidebar.test.tsx`
- Modify: `packages/agent-ui/src/index.ts`

**Interfaces:**
- Consumes: 选中的 `CanvasNode[]`、Project entries、命令回调。
- Produces: `createCanvasSelectionAttachment(nodes, canvasVersion)`、`AgentSidebar`。

- [ ] **Step 1: 写入附件快照失败测试**

  使用两个有 `assetId` 的图片节点，断言返回独立的不可变快照、稳定 node ID 顺序和尺寸。无素材的 placeholder 不进入附件。

- [ ] **Step 2: 写入组件服务端渲染失败测试**

  断言侧栏包含 `Design Agent`、可访问 Composer、选中图片计数、计划确认按钮和错误状态；不包含取消按钮或主题切换入口。

- [ ] **Step 3: 运行测试确认失败**

  Run: `pnpm --filter @loomoon/agent-ui test`

  Expected: FAIL，附件函数和组件不存在。

- [ ] **Step 4: 实现组件**

  使用 assistant-ui 的 `ThreadPrimitive`、`MessagePrimitive` 和 `ComposerPrimitive` 组合浅色侧栏。Tool UI 根据 `LoomoonAgentEntry.kind` 渲染：

  - `plan`：两个方向、确认、要求修改。
  - `confirmation`：摘要、任务数、确认执行。
  - `generation`：状态、缩略图、错误和可用重试。
  - `fallback`：通用白色状态卡。

  所有视觉值使用 Loomoon Semantic Token。

- [ ] **Step 5: 运行包验证**

  Run: `pnpm --filter @loomoon/agent-ui test && pnpm --filter @loomoon/agent-ui typecheck && pnpm --filter @loomoon/agent-ui build`

  Expected: PASS。

### Task 4: Web 垂直切片集成

**Files:**
- Create: `apps/web/src/agent-sidebar-adapter.tsx`
- Create: `apps/web/src/agent-sidebar-adapter.test.ts`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/theme.tsx`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/architecture-contract.test.ts`

**Interfaces:**
- Consumes: `project`、`selectedImages`、`busy`、`error`、现有 `sendMessage`、`confirm`、`setInput`、`uploadReference`。
- Produces: 新 `AgentSidebar` 实例和 `VITE_AGENT_UI_RUNTIME` 回退选择。

- [ ] **Step 1: 写入 Feature Flag 和参数映射失败测试**

  ```ts
  expect(resolveAgentUiRuntime("legacy")).toBe("legacy");
  expect(resolveAgentUiRuntime(undefined)).toBe("assistant-ui");
  expect(createAgentSendInput("修改", ["n1", "n1"])).toEqual({
    text: "修改",
    nodeIds: ["n1"],
  });
  ```

- [ ] **Step 2: 运行 Web 测试确认失败**

  Run: `pnpm --filter @loomoon/web test`

  Expected: FAIL，adapter 函数不存在。

- [ ] **Step 3: 接入新侧栏**

  - 把旧 JSX 提取为 `LegacyAgentSidebar`，只在 flag 为 `legacy` 时渲染。
  - 默认渲染 `@loomoon/agent-ui`。
  - 隐藏现有主题切换按钮。
  - ThemeProvider 默认 preference 改为 `light`，但继续接受已有 `dark/system` 配置。
  - Web 继续拥有 Project SSE 和 API 命令，不复制持久状态到 Agent UI。

- [ ] **Step 4: 更新架构契约**

  契约断言 Web 只导入 `@loomoon/agent-ui`，不导入 `@assistant-ui/*`；Demo 顶栏不再渲染主题切换入口。

- [ ] **Step 5: 运行 Web 测试、类型检查和构建**

  Run: `pnpm --filter @loomoon/web test && pnpm --filter @loomoon/web typecheck && pnpm --filter @loomoon/web build`

  Expected: PASS。

### Task 5: 浏览器闭环和全仓验证

**Files:**
- Verify: `apps/web/src/app.tsx`
- Verify: `packages/agent-ui/src/*`
- Modify: `docs/development/acceptance-matrix.md`

**Interfaces:**
- Consumes: 默认 assistant-ui 侧栏和 legacy 回退。
- Produces: 浏览器验收证据和更新后的验收矩阵。

- [ ] **Step 1: 浏览器验证默认浅色界面**

  检查 `data-theme="light"`、主题按钮不可见、白色 Agent 面板、小圆角和无装饰渐变。

- [ ] **Step 2: 验证文字和多图闭环**

  发送普通消息；圈选至少两张图片并发送修改指令；确认附件快照数量、服务端消息和画布更新。

- [ ] **Step 3: 验证计划和确认流程**

  创建计划、要求修改、确认生成，并检查 Tool UI 状态与现有 Canvas 节点变化。

- [ ] **Step 4: 验证回退**

  使用 `VITE_AGENT_UI_RUNTIME=legacy` 启动 Web，确认旧侧栏仍能完成发送和确认。

- [ ] **Step 5: 运行全仓验证**

  Run: `pnpm test`

  Expected: 所有测试通过。

  Run: `pnpm typecheck`

  Expected: exit code `0`。

  Run: `pnpm build`

  Expected: 所有工作区构建成功。

  Run: `git diff --check`

  Expected: 无空白错误。

## Self-Review

- 所有规格要求分别由消息投影、Runtime、组件、Web 集成和浏览器验收覆盖。
- `ExternalStoreRuntime` 与现有服务端权威 Project 模型一致，不引入第二份持久状态。
- 未提供后端不存在的取消、编辑或重新生成能力。
- 暗色 Token 保留，但默认浅色且不展示入口。
- Legacy 有明确的迁移用途和删除条件。
