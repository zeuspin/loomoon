# Flat Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Loomoon Demo 的全部 Web 界面统一为 2–4px 小圆角、少边框、轻阴影、无装饰渐变的扁平视觉。

**Architecture:** 保留现有 React/Konva 结构，只调整六个页面级 CSS 文件。新增静态视觉契约测试扫描样式源码，防止大圆角和装饰性渐变回归；浏览器检查用于验证 CSS 静态规则无法覆盖的层级、可读性和交互状态。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、CSS、Konva

## Global Constraints

- 普通控件圆角为 `2px`，容器、弹窗和媒体内容最大为 `4px`。
- 只有状态点、头像等圆形语义元素允许 `border-radius: 50%`。
- 不使用装饰性渐变。
- 边框只用于结构分割、输入与焦点、画布选中和错误状态。
- 阴影只用于浮层关系，且保持低对比、低扩散。
- 不改变布局、业务行为和画布数据结构。

---

### Task 1: 建立视觉契约

**Files:**
- Create: `apps/web/src/style-contract.test.ts`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/login.css`
- Modify: `apps/web/src/projects.css`
- Modify: `apps/web/src/history.css`
- Modify: `apps/web/src/region.css`
- Modify: `apps/web/src/enhancements.css`

**Interfaces:**
- Consumes: Web 端所有 `src/*.css` 文件。
- Produces: Vitest 静态规则，约束非语义圆形元素的圆角不超过 `4px`，并禁止装饰性渐变。

- [ ] **Step 1: 写入失败的视觉契约测试**

  测试读取全部 CSS 文件，提取 `border-radius` 声明；允许 `50%`，其余像素值必须小于或等于 `4`。同时断言源码不包含 `linear-gradient(`。

- [ ] **Step 2: 运行测试并确认失败原因**

  Run: `pnpm --filter @loomoon/web test -- style-contract.test.ts`

  Expected: FAIL，报告现有 `7px`–`28px` 圆角和登录页渐变。

- [ ] **Step 3: 收敛核心工作台样式**

  在 `styles.css` 中把按钮、卡片、消息、输入区和悬浮控件统一到 `2px` 或 `4px`；移除普通内容卡片的装饰性边框和阴影，仅保留顶栏/侧栏分割、输入、选择与错误边框。

- [ ] **Step 4: 收敛登录页与辅助界面**

  在 `login.css`、`projects.css`、`history.css` 和 `region.css` 中移除渐变、大圆角和厚重阴影。项目菜单、历史抽屉、区域弹窗保留轻阴影；输入、选区和错误状态保留功能性边框。

- [ ] **Step 5: 运行视觉契约测试**

  Run: `pnpm --filter @loomoon/web test -- style-contract.test.ts`

  Expected: PASS。

### Task 2: 回归与视觉验收

**Files:**
- Verify: `apps/web/src/*.css`
- Verify: `apps/web/src/app.tsx`

**Interfaces:**
- Consumes: Task 1 的统一视觉样式。
- Produces: 构建、类型和浏览器视觉验收证据。

- [ ] **Step 1: 运行 Web 测试与类型检查**

  Run: `pnpm --filter @loomoon/web test`

  Expected: 全部测试通过。

  Run: `pnpm --filter @loomoon/web typecheck`

  Expected: exit code `0`。

- [ ] **Step 2: 运行 Web 构建**

  Run: `pnpm --filter @loomoon/web build`

  Expected: Vite production build 成功。

- [ ] **Step 3: 浏览器检查登录页和工作台**

  检查登录卡片、顶栏、工具栏、Agent 面板、消息卡片、输入区、项目菜单、历史抽屉与局部重绘弹窗。确认层级清晰、文字可读、功能性边框仍存在、没有大圆角或装饰渐变。

- [ ] **Step 4: 检查工作区变更**

  Run: `git diff --check`

  Expected: 无空白错误。

## Self-Review

- 规格中的登录页、工作台、Agent 面板、菜单、历史抽屉与区域弹窗均有对应修改任务。
- 计划不包含占位内容，不增加依赖，也不调整业务逻辑。
- 自动化测试覆盖可静态判定的圆角和渐变规则；边框必要性、阴影轻重与视觉层级由浏览器验收覆盖。
