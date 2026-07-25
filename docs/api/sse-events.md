# 项目 SSE 事件

本地 Demo 使用 `GET /api/v1/projects/:projectId/events`。认证沿用 HttpOnly Cookie，
响应类型为 `text/event-stream`，Nginx 部署时必须关闭该路径的代理缓冲。

当前本地事件：

```text
event: project
id: <connection-local sequence>
data: <DemoProject JSON>
```

服务只在画布版本、消息数、计划状态或任务状态变化时发送新快照，其余时间发送 heartbeat。
浏览器 `EventSource` 断开后自动重连，并以最新 REST/SSE 快照恢复。

生产模式将保持同一路径，事件源替换为 PostgreSQL Outbox + Redis Publisher，并细分为：

```text
agent.run.started
agent.message.delta
agent.confirmation.required
agent.run.completed
canvas.version.changed
generation.task.updated
asset.created
resync_required
```

本地事件 ID 只在当前连接内有效；正式 Outbox 模式才承诺 `Last-Event-ID` 跨连接补发。
