# Lovart 通用视觉创作 Demo 技术方案

**日期：** 2026-07-25  
**状态：** 已确认  
**关联产品规格：** `2026-07-25-lovart-demo-design.md`

## 1. 技术目标

构建一个可通过 Web 服务交付的 Lovart 式垂直闭环 Demo：React/Konva 提供无限画布，Pi Agent Core 负责编排受限业务工具，百炼提供大语言、多模态和图片生成编辑能力；系统支持计划确认、多图上下文、异步任务、项目持久化、失败恢复和基础多租户隔离。

首版采用 TypeScript 模块化单体，不引入微服务和双语言运行时。长时间图片任务由独立 Worker 执行。

## 2. 总体架构

```text
Browser: React + Konva
    ├─ REST → Fastify API
    └─ SSE  ← Project Event Stream

Fastify API
    ├─ Auth
    ├─ Project / Canvas
    ├─ Pi Agent Runtime
    ├─ Generation
    ├─ Asset / Export
    └─ Outbox Publisher

Redis
    ├─ BullMQ
    └─ SSE replay / transient stream

Image Worker
    ├─ Bailian Model Router
    ├─ result validation
    ├─ thumbnail processing
    └─ MinIO persistence

State
    ├─ PostgreSQL + Drizzle
    └─ MinIO / S3 compatible storage
```

部署单元：

1. `web`：React SPA；
2. `api`：Fastify、SSE、Pi Agent Runtime 和业务模块；
3. `worker-image`：BullMQ 消费者和百炼图片调用；
4. PostgreSQL、Redis、MinIO；
5. Nginx 负责静态文件和反向代理。

## 3. Monorepo

```text
apps/
├─ web/
├─ api/
└─ worker-image/

packages/
├─ contracts/
├─ database/
├─ canvas-domain/
├─ agent-runtime/
├─ bailian-provider/
├─ object-storage/
├─ observability/
└─ config/
```

建议使用 pnpm workspace。边界规则：

- Web 不依赖数据库和百炼 SDK；
- Agent Runtime 不直接写数据库，只调用注册工具；
- Bailian Provider 不理解 Konva 或业务节点；
- Worker 不运行 Agent；
- Contracts 只包含 DTO、事件、错误码和 Schema；
- 密钥只存在于服务端配置。

## 4. 技术栈

### Web

- React、TypeScript、Vite；
- Konva、react-konva；
- TanStack Query 管理服务端状态；
- Zustand 管理选择、工具、视口、蒙版和本地撤销栈；
- React Router；
- Radix UI 或 shadcn/ui；
- Tailwind 或 CSS Modules + CSS Variables；
- React Hook Form + Zod；
- Playwright、Vitest。

### Server

- Node.js 当前 LTS；
- Fastify；
- Pi Agent Core；
- Drizzle ORM；
- PostgreSQL；
- Redis + BullMQ；
- AWS S3 SDK 对接 MinIO；
- TypeBox 或 Zod；
- Pino；
- OpenTelemetry 预留；
- Docker Compose。

## 5. Lovart 式界面实现

结构采用顶部项目栏、左侧工具栏、中央画布、右侧 Agent、画布角落缩放控件和对象上下文工具条。视觉使用独立 Design Token。

建议桌面尺寸：

```text
TopBar: 56px
LeftToolRail: 56px
AgentPanel: 380px，允许 340–480px 拖动调整
Canvas: 剩余全部空间
ContextToolbar: anchor to selection bounds
```

Agent 面板折叠后保留 44px 入口；宽度不足时优先折叠 Agent。选中多图后，Composer 展示最多 8 张缩略图和总数。任务进度在 Agent 消息流及画布占位节点同步呈现。

## 6. 画布领域与 Konva 适配

后端保存业务文档，不保存 Konva Stage JSON：

```ts
interface CanvasDocument {
  id: string
  projectId: string
  schemaVersion: number
  version: number
  viewport?: Viewport
  nodes: CanvasNode[]
  relations: NodeRelation[]
  updatedAt: string
}
```

节点类型：

```text
image
text
artboard
group
generation-placeholder
```

`ImageNode` 只保存 `assetId`。通用字段包含位置、尺寸、旋转、层级、父节点、锁定、隐藏和创建者。

`CanvasRendererAdapter` 负责：

- 业务节点与 Konva 元素转换；
- 拖动、缩放、旋转转为 CanvasOperation；
- 屏幕、世界和图片像素坐标转换；
- 选择框、Transformer 和上下文工具定位；
- 区域编辑蒙版与外接边界框；
- 导出时隐藏辅助元素。

业务模块不得持有 Konva Node 引用。

## 7. 快照、操作日志与乐观锁

采用“当前快照 + 结构化操作日志”：

```ts
interface OperationBatch {
  operationId: string
  projectId: string
  baseVersion: number
  actor: { type: "user" | "agent" | "system"; id: string }
  operations: CanvasOperation[]
  idempotencyKey: string
}
```

操作包括创建、更新、删除、连接、分组、取消分组、布局和绑定资产。服务端在同一事务内完成权限、Schema、版本和幂等校验，写操作日志并更新快照。

常规操作本地乐观更新，连续移动事件合并，停止操作后 2 秒防抖保存。冲突返回 HTTP 409 `CANVAS_VERSION_CONFLICT`。首版冲突主要来自多标签、恢复和 Agent/用户同时写入。

前端命令栈负责当前会话撤销重做；后端日志用于审计、幂等和问题追踪，不作为逐步 UI 历史。

## 8. Pi Agent Runtime

Run 状态：

```text
created
→ streaming
→ waiting_confirmation
→ tool_running
→ waiting_jobs
→ completed

failed / cancelled
```

上下文由系统策略、计划摘要、有限消息历史、画布摘要、选择快照、选中资产和工具 Schema 组成。不无条件注入整个画布和全部历史图片。

多图意图：

```text
analyze
compare
use_as_references
edit_single_with_references
edit_all
fuse
needs_clarification
```

分析和比较无需确认；所有图片生成编辑需要确认；低置信度或范围不明必须澄清。只保存简短决策摘要，不保存或展示隐藏思维链。

工具执行链：

```text
Pi Tool
→ Authorization
→ Schema Validation
→ Confirmation Check
→ Application Service
→ DB / BullMQ
→ Structured Result
```

首版工具：

```text
get_canvas_context
analyze_selected_images
create_creative_plan
revise_creative_plan
create_canvas_nodes
arrange_canvas_nodes
generate_images
edit_single_image
edit_multiple_images
generate_from_references
edit_image_region
get_generation_status
```

不注册 Shell、文件系统、任意 HTTP、SQL、动态 JavaScript 或第三方扩展工具。

## 9. 确认机制

有成本操作确认后签发一次性 `ConfirmationGrant`，绑定用户、项目、Run、工具、输入哈希、最大任务数和过期时间。输入、目标或数量变化后确认失效。消费 Grant 和创建任务必须在同一数据库事务，避免重复点击。

## 10. 百炼模型选型

### 正式模型

```env
BAILIAN_AGENT_MODEL=qwen3.7-plus
BAILIAN_FAST_MODEL=qwen3.6-flash
BAILIAN_IMAGE_MODEL=wan2.7-image-pro
BAILIAN_IMAGE_FALLBACK_MODEL=qwen-image-2.0-pro
```

可选：

```env
BAILIAN_DRAFT_IMAGE_MODEL=wan2.7-image
BAILIAN_MASK_EDIT_MODEL=wanx2.1-imageedit
ENABLE_LEGACY_MASK_EDIT=false
```

模型职责：

| 能力 | 默认 | 备用 |
|---|---|---|
| Agent 规划、工具调用、多图理解 | qwen3.7-plus | qwen3.6-flash |
| Prompt 优化和轻量摘要 | qwen3.6-flash | qwen3.7-plus |
| 高质量文生图、单图编辑、多图参考 | wan2.7-image-pro | qwen-image-2.0-pro |
| 快速候选图 | wan2.7-image | qwen-image-2.0 |
| 负向提示词 | qwen-image-2.0-pro | qwen-image-2.0 |
| 区域编辑 | wan2.7-image-pro bbox_list | 可选 wanx2.1-imageedit mask |

路由输入使用业务能力，不允许 Agent 指定任意模型 ID。路由结果记录 requestedCapability、resolvedModel、模型快照、地域和 routingReason。

`qwen3.7-plus` 默认关闭思考模式；复杂首次计划可按策略开启。`qwen3.6-flash` 输出不符合 Schema 或置信度低于 0.85 时升级 Plus。

开发阶段可使用滚动别名；进入验收和演示冻结期后，固定已回归的快照版本：

```text
qwen3.7-plus-2026-05-26
qwen3.6-flash-2026-04-16
qwen-image-2.0-pro-2026-06-22
```

模型升级必须重新运行 Agent Tool Schema、多图意图和 12 条 E2E 中相关用例，不能在演示前自动跟随滚动别名升级。Wan 2.7 使用明确代际模型 ID，并在配置中记录实际地域和返回版本。

正式候选图默认 `wan2.7-image-pro` 2K，每个 GenerationTask 生成一张。文生图可选 4K，编辑不承诺 4K。多图参考最多 8 张圈选图片，Provider 控制输入顺序与图片用途。

区域修改保留完整用户蒙版，但默认转换为最多两个原图像素边界框传给 Wan 2.7。精确 Mask 仅在旧万相模型地域、账号和质量验证通过时启用；未来 ComfyUI 沿用同一 `mask_inpaint` 能力接口。

## 11. 图片任务

数据库任务状态：

```text
draft → queued → running → downloading → processing → storing → succeeded
failed / cancelled
```

PostgreSQL 是最终状态真相源，BullMQ 负责调度。Task ID 作为 BullMQ Job ID；Worker 开始前检查终态；资产入库、Task 成功和节点回填使用事务。

重试策略：

- 鉴权和非法参数不自动重试；
- 限流、超时和暂时网络错误做有上限指数退避；
- 用户重试创建新任务，通过 `retryOfTaskId` 关联；
- 重复百炼结果不创建重复资产；
- 已取消任务的迟到结果不自动回填画布。

Provider 接口：

```ts
interface ImageProvider {
  textToImage(input: TextToImageInput): Promise<ProviderJob>
  editImage(input: EditImageInput): Promise<ProviderJob>
  editRegion(input: RegionEditInput): Promise<ProviderJob>
  generateFromReferences(input: ReferenceInput): Promise<ProviderJob>
  getJob(id: string): Promise<ProviderJobStatus>
  cancelJob?(id: string): Promise<void>
}
```

## 12. 数据库

核心表：

```text
users
refresh_tokens
projects
canvas_documents
canvas_operations
agent_sessions
agent_messages
agent_runs
tool_calls
confirmation_grants
generation_batches
generation_tasks
assets
asset_relations
outbox_events
```

关键约束：

- 所有项目资源带项目及所有者关系；
- `project_id + idempotency_key` 唯一；
- Canvas Snapshot 带 schemaVersion 和 version；
- 消息保存 selection_snapshot；
- 不保存隐藏推理；
- 资产保存对象键、哈希、尺寸、MIME 和来源，不保存百炼临时 URL 作为永久地址；
- Task 保存 Provider Job/Request ID、错误分类和模型路由信息。

## 13. API

统一前缀 `/api/v1`。

```text
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me

GET    /projects
POST   /projects
GET    /projects/:projectId
PATCH  /projects/:projectId
DELETE /projects/:projectId

GET    /projects/:projectId/canvas
POST   /projects/:projectId/canvas/operations

POST   /projects/:projectId/agent/sessions
GET    /agent/sessions/:sessionId/messages
POST   /agent/sessions/:sessionId/messages
POST   /agent/runs/:runId/confirm
POST   /agent/runs/:runId/cancel

GET    /projects/:projectId/generation-tasks
GET    /generation-tasks/:taskId
POST   /generation-tasks/:taskId/retry
POST   /generation-tasks/:taskId/cancel
POST   /generation-batches/:batchId/cancel

POST   /projects/:projectId/assets/uploads
POST   /assets/:assetId/upload-complete
GET    /projects/:projectId/assets
POST   /assets/:assetId/download-url
```

Access Token 短期有效；Refresh Token 使用 HttpOnly、Secure、SameSite Cookie；密码使用 Argon2id。

## 14. SSE 与 Outbox

项目事件流：

```text
GET /api/v1/projects/:projectId/events
```

事件：

```text
agent.run.started
agent.message.delta
agent.tool.started
agent.tool.completed
agent.confirmation.required
agent.run.completed
agent.run.failed
canvas.operations.applied
canvas.version.changed
generation.batch.updated
generation.task.updated
asset.created
```

支持 `Last-Event-ID`；超出补发窗口返回 `resync_required`，前端重新拉取 REST 状态。关键事务写 `outbox_events`，Publisher 再投递 BullMQ 与 Redis/SSE，消费者以 Task ID/Event ID 幂等。

## 15. 错误协议

```ts
interface ApiError {
  error: {
    code: string
    message: string
    requestId: string
    retryable: boolean
    details?: Record<string, unknown>
  }
}
```

必须定义身份、资源不存在、画布冲突、Agent 确认、意图歧义、百炼限流/超时/鉴权、非法图片和导出失败等稳定错误码。内部堆栈只写日志。

## 16. 安全

- Repository 查询同时约束资源和当前用户；
- 图片文本和 Prompt 均视为不可信输入；
- 工具设置图片数、分辨率、字节数和任务数上限；
- 上传校验扩展名、MIME、Magic Bytes、解码和像素总量；
- 对象键由服务端生成，Bucket 私有；
- 上传下载使用短期预签名 URL；
- Refresh Cookie 配合 CSRF、防 CORS 误配和 CSP；
- 登录、Agent 和生成接口限流；
- 密钥不进入前端、响应和日志；
- 所有副作用工具写审计记录。

## 17. 部署

Docker Compose：

```text
nginx
web
api
worker-image
postgres
redis
minio
minio-init
```

Nginx 为 SSE 路径关闭代理缓冲。健康检查：

```text
/api/v1/health/live
/api/v1/health/ready
```

Ready 检查 PostgreSQL、Redis 和 MinIO；百炼作为独立 Provider 健康状态，不阻塞 API 启动。

## 18. 测试

单元测试覆盖 CanvasOperation、坐标与边界框、多图意图、ConfirmationGrant、Model Router、错误映射、Task 状态机和文件校验。

集成测试使用真实 PostgreSQL、Redis、MinIO 容器和百炼 Mock Server，覆盖事务、乐观锁、Outbox、Worker 幂等、重试取消、资产入库和 SSE 重连。

前端测试覆盖多选缩略图、计划确认、上下文工具条、冲突提示、占位节点、区域编辑和导出辅助元素隐藏。

Playwright 覆盖产品规格中的 12 条 E2E。默认使用 Mock Provider；发布候选版本额外运行真实百炼冒烟测试。性能验证包含 100 节点、5 并发用户、每用户 2 个并行图片任务、Worker 重启和 SSE 断线恢复。

## 19. 技术交付物

- 数据库 Migration；
- `.env.example` 与配置校验；
- Docker Compose；
- 本地开发命令；
- 百炼模型能力检查脚本；
- MinIO 初始化；
- 演示账号 Seed；
- Mock Image Provider；
- OpenAPI；
- SSE 事件说明；
- Agent Tool Schema；
- 错误码表；
- 运维与恢复文档；
- 固定演示数据和 Playwright 回归脚本。
