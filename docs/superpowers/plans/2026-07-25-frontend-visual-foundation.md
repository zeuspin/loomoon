# Frontend Visual Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Base UI 驱动、全局主题化、DOM 与 Konva 共享 Token 的 Loomoon 前端视觉基座。

**Architecture:** `design-tokens` 是唯一视觉数据源，`ui` 封装 Base UI/CVA/Lucide，Web 通过 ThemeProvider 消费主题，Canvas Theme Bridge 将语义 Token 转为 Konva 可用对象。契约测试禁止业务层绕过组件包。

**Tech Stack:** React 19、Base UI、Tailwind CSS 4、CVA、Lucide、Vitest、Konva

## Global Constraints

- 控件圆角 `2px`，容器和媒体最大 `4px`。
- Base UI、CVA、assistant-ui 不得由业务页面直接导入。
- 用户创作内容不跟随编辑器主题改变。
- 新组件按需建设，不创建未被当前产品使用的通用组件。

---

### Task 1: 创建设计 Token 包

**Files:**
- Create: `packages/design-tokens/package.json`
- Create: `packages/design-tokens/tsconfig.json`
- Create: `packages/design-tokens/src/index.ts`
- Create: `packages/design-tokens/src/canvas.ts`
- Create: `packages/design-tokens/src/tokens.css`
- Test: `packages/design-tokens/src/tokens.test.ts`

- [ ] 先写失败测试，验证圆角、主题和 Canvas Token 契约。
- [ ] 运行包测试并确认因为导出缺失而失败。
- [ ] 实现 light/dark 语义 Token 和 TypeScript Canvas Token。
- [ ] 运行测试、类型检查和构建。

### Task 2: 创建共享 UI 包

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/components.tsx`
- Create: `packages/ui/src/styles.css`
- Test: `packages/ui/src/components.test.tsx`

- [ ] 先写组件契约测试，覆盖 Button、IconButton、Panel、Badge、Spinner 的 variant 和可访问属性。
- [ ] 使用 Base UI、CVA 和 Lucide 实现最小组件集。
- [ ] 运行测试、类型检查和构建。

### Task 3: 接入 Web 主题与画布桥接

**Files:**
- Create: `apps/web/src/theme.tsx`
- Create: `apps/web/src/theme.test.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/package.json`

- [ ] 先写主题解析和 Canvas Bridge 的失败测试。
- [ ] 实现 light/dark/system 偏好解析、持久化与 DOM 属性同步。
- [ ] 在根节点接入 ThemeProvider 和 Token CSS。
- [ ] 将 Konva 编辑辅助视觉改为共享 Canvas Token。

### Task 4: 增加治理契约与完整验证

**Files:**
- Create: `apps/web/src/architecture-contract.test.ts`
- Modify: `package.json`

- [ ] 增加扫描 Web 源码依赖和硬编码视觉值的契约测试。
- [ ] 运行全仓测试、类型检查和构建。
- [ ] 浏览器检查现有工作台布局与 computed theme。
- [ ] 运行 `git diff --check`。

## Self-Review

- 计划覆盖 Token、组件、主题、Konva 桥接、依赖治理和浏览器验收。
- 第一阶段只实现当前可复用的最小组件集。
- 所有依赖方向与 ADR 一致，不改变 Agent 或画布业务协议。
