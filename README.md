# Loomoon

Loomoon 是一个参考 Lovart 交互方式的 Agent 无限画布 Demo。当前工程包含 React/Konva Web、Fastify API、BullMQ 图片 Worker，以及 PostgreSQL、Redis 和 MinIO 本地基础设施。

## 快速开始

要求：

- Node.js 24+
- pnpm 11+
- Docker Desktop 或兼容的 Docker Compose

安装与配置：

```powershell
Copy-Item .env.example .env
pnpm install
```

打开根目录 `.env`，将：

```dotenv
BAILIAN_API_KEY=replace-with-your-bailian-api-key
```

替换为你的百炼 API Key。`.env` 已被 Git 忽略。不要把 Key 放到任何 `VITE_` 前缀变量中；`VITE_` 变量会进入浏览器构建。

## 最快验证 Demo（无需 Docker）

本地 Demo 模式会把项目快照保存到被 Git 忽略的 `.local-data/project.json`，生成图片保存到
`.local-data/assets/`。它使用真实百炼模型，但不依赖 PostgreSQL、Redis 或 MinIO。

```powershell
pnpm env:check
pnpm dev
```

如需零费用走完四图生成和图片修改的页面流程：

```powershell
pnpm dev:mock
```

`dev:mock` 仅替换模型 Provider，登录、项目隔离、确认门、任务状态、画布、
生成历史和持久化路径与本地 Demo 相同。

打开 <http://localhost:6001>，按以下顺序验证：

1. 使用 `demo@loomoon.local / loomoon-demo` 登录；
2. 点击“试试青柠气泡水广告”，发送示例需求；
3. 查看 Agent 返回的两个视觉方向；
4. 点击“确认并生成 4 张候选图”（此步骤会产生百炼图片调用费用）；
5. 在画布点击图片，按住 Shift 可多选或按住 Shift 在空白区域拖拽框选；
6. 点击浮动工具条的“比较”并发送，Agent 只分析、不生图；
7. 点击“Agent 修改”，调整指令并发送；
8. 检查目标数量后点击“确认执行”，修改结果会保留原图并放在旁边；
9. 点击“下载原图”或右上角“导出画布”。

补充验收入口：

- 点击项目名称可新建、切换、重命名和二次确认删除项目；
- Agent 输入框的“参考图”支持 JPG/PNG/WebP，最大 20 MB；
- 单选图片后点击“区域修改”，在原图上框选区域并提交 Wan 2.7 bbox 编辑；
- 顶栏时钟图标打开独立生成历史，可把历史图片重新加入画布；
- 失败占位选中后可单独重试；
- 左侧“文字”、对象上下文工具条支持文字节点、缩放、分组、层级和删除。

第二隔离账号为 `reviewer@loomoon.local / loomoon-review`。两个账号拥有独立项目数据，
可用于验证替换项目 ID 时的越权拒绝。

项目和图片会在刷新后恢复。需要重置 Demo 时，停止服务后删除项目根目录下的
`.local-data` 文件夹即可。

## 完整基础设施模式

启动基础设施：

```powershell
docker compose up -d postgres redis minio minio-init
```

检查环境并启动开发服务：

```powershell
pnpm env:check
pnpm dev
```

访问：

- Web：<http://localhost:6001>
- API 健康检查：<http://localhost:3000/api/v1/health/live>
- MinIO Console：<http://localhost:9001>

## 常用命令

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm env:check
pnpm demo:verify
pnpm demo:verify:local
```

服务运行时，`pnpm demo:verify:local` 会依次检查环境、真实百炼大语言模型、真实规划与确认门、
权限隔离、100 节点/5 并发和 SSE。它不会确认或生成图片，因此不会产生图片生成费用。

产品与技术规格位于 `docs/superpowers/specs/`，实施计划位于 `docs/superpowers/plans/`。
逐项验收证据和 Chrome/Edge 手工步骤见 `docs/development/acceptance-matrix.md`。

## Agent 运行时

Agent 对话生命周期基于 `@earendil-works/pi-agent-core`，百炼
`qwen3.7-plus` 通过 OpenAI 兼容接口接入。Demo 明确不给 Pi Runtime 注册
Shell、文件系统或任意 HTTP 工具；画布写入、图片生成和图片修改仍由服务端受限业务流程执行，
付费生成必须经过确认。

图片生成与编辑使用百炼 Wan 2.7。Pi 只负责编排与对话状态，不接触百炼 API Key；
Key 仅从服务端根目录 `.env` 读取。
