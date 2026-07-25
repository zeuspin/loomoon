# Agent 对话流程审查

## 范围

- 产品：Loomoon Demo
- 流程：查看历史消息 → 输入消息 → 发送 → 请求失败
- 目标：用户始终能看到自己刚刚发送的内容，并理解 Agent、工具和画布任务的进展。

## 证据

1. `01-current-chat.png`：历史对话可见，但对话内容过长，缺少清晰的回合与工具状态层级。
2. `02-after-send.png`：点击发送后输入框被清空，用户消息未进入时间线；失败只显示一行底部错误。

## 关键结论

1. 前端消息列表以 `project.messages` 为唯一来源，没有乐观插入刚发送的用户消息。
2. 后端先把用户消息写入 Agent Repository，但只把 Assistant 消息镜像到 `project.messages`。
3. 请求失败时，用户消息既未进入当前 UI 数据源，也没有保留在输入框中，造成“消息消失”。
4. 当前消息、计划卡和确认卡分别拼接，无法保证真实时间顺序。
5. Agent Session 与 DemoProject 同时承担消息数据源，存在重复、漏消息和刷新不一致风险。

## 推荐目标模型

- Agent Session Timeline 是对话唯一事实来源。
- 客户端点击发送后立即插入带 `clientMessageId` 的用户气泡。
- 服务端接受后以稳定 `messageId` 对账，不重复追加。
- 失败时保留原消息，并显示“发送失败 / 重试 / 编辑后重发”。
- Assistant 文本、Tool Call、确认卡和任务状态按事件时间插入同一时间线。
- 图片结果只进入画布；对话只显示紧凑的任务摘要和“定位到画布”动作。
- 页面刷新从 Session、Run、ToolCall、PendingAction 和 Task 恢复完整时间线。

## 推荐状态

`local_pending → accepted → streaming → waiting_confirmation → waiting_jobs → completed`

异常状态：

`failed`、`cancelled`

## 可见性与无障碍风险

- 当前错误只靠红色区分，且与原消息脱离。
- 流式状态、工具运行状态和失败状态需要文本标签与 `aria-live`。
- 右侧用户气泡需要稳定的发送中、失败和重试状态，不能依赖瞬时 toast。
- 截图无法确认键盘焦点顺序、屏幕阅读器播报和色彩对比数值，需要实现后单独验证。
