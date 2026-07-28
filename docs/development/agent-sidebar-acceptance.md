# Agent 侧栏验收记录

## 自动化验收

| 能力 | 验收证据 |
|---|---|
| assistant-ui 隔离 | `apps/web` 架构契约测试禁止直接导入 `@assistant-ui/*`，仅允许通过 `@loomoon/agent-ui` 使用 |
| 消息投影 | `message-mapper.test.ts` 覆盖用户、Agent 消息及图片内容映射 |
| 运行时适配 | `runtime-adapter.test.tsx` 覆盖消息发送和运行状态映射 |
| 多图上下文 | `canvas-selection.test.ts` 覆盖图片节点筛选、去重和顺序快照 |
| 工具结果 | `agent-sidebar.test.tsx` 覆盖结构化计划、确认与生成结果的服务端渲染 |
| 默认浅色 | `theme.test.ts` 覆盖 Demo 忽略旧的深色/系统偏好，同时保留未来启用持久化主题的能力 |
| 新旧实现切换 | `agent-sidebar-adapter.test.ts` 覆盖默认使用 assistant-ui 及显式 legacy 回退 |

## 浏览器验收

2026-07-25 在本地 Demo `http://localhost:6001/` 完成以下检查：

- 页面启动后 `data-theme="light"`，即使浏览器此前保存过 `dark` 或 `system`。
- Agent 侧栏由 assistant-ui primitives 渲染，历史消息、图片任务和生成结果可见。
- 输入框可访问名称为“消息内容”，发送按钮在空输入时禁用。
- 当前 Demo 不显示主题切换按钮。
- 页面背景和 Agent 面板均为浅色，保持 2–4px 小圆角及低边框密度。
- 浏览器控制台没有 error 或 warning。

### 轻量对话布局修正

2026-07-25 根据浏览器批注完成第二轮验收：

- 在 1280×720 的更小视口中，消息区 `scrollHeight` 为 1738px 时，输入区仍完整显示在侧栏底部。
- 消息区单独滚动，输入区和侧栏标题不随历史消息滚动。
- Agent 消息左对齐，显示品牌头像与 `Loomoon Agent` 名称，正文不使用气泡。
- 用户消息右对齐，使用浅品牌色小圆角气泡。
- 多张生成图片不会再把输入区推到视口之外。
- 浏览器控制台没有 error 或 warning。

## 回归命令

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm demo:verify:mock
```
