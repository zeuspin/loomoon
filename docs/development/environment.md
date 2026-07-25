# 本地开发环境

## 百炼配置

百炼密钥仅配置在项目根目录 `.env`：

```dotenv
BAILIAN_API_KEY=你的百炼APIKey
```

工程默认固定以下模型快照：

```dotenv
BAILIAN_AGENT_MODEL=qwen3.7-plus-2026-05-26
BAILIAN_FAST_MODEL=qwen3.6-flash-2026-04-16
BAILIAN_IMAGE_MODEL=wan2.7-image-pro
BAILIAN_IMAGE_FALLBACK_MODEL=qwen-image-2.0-pro-2026-06-22
```

运行 `pnpm env:check` 验证配置。命令只打印服务地址和模型名称，不打印 API Key、JWT Key 或对象存储密码。

## 零容器本地验收

```powershell
pnpm env:check
pnpm dev
```

该模式使用 `.local-data/` 保存项目快照与百炼生成结果，适合功能演示和前端联调。
`.local-data/` 已被 Git 忽略。百炼 Key 仍然只在服务端 API 进程读取。
两种实现配置的边界见 `implementation-profiles.md`。

## 完整基础服务

```powershell
docker compose up -d postgres redis minio minio-init
docker compose ps
```

本地端口：

| 服务 | 地址 |
|---|---|
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |

## 开发进程

`pnpm dev` 并行启动 Web 和 API，适合零容器本地验收。`pnpm dev:full` 会额外启动图片 Worker，需要先运行 Redis。API 和 Worker 启动时都会验证根目录 `.env`；密钥缺失或仍为示例值时会立即退出。当前可验收闭环由 API 内的本地 Demo Runtime 执行；正式部署时再将同一 Provider 接口切换到 BullMQ Worker。

## 故障排查

- `BAILIAN_API_KEY` 校验失败：确认修改的是根目录 `.env`，不是 `.env.example`；
- API 无法启动：运行 `pnpm env:check` 查看缺失配置；
- Worker 无法连接：确认 `docker compose ps redis` 为 healthy；
- MinIO Bucket 不存在：重新运行 `docker compose up minio-init`；
- 端口冲突：修改 `.env` 和 Compose 端口映射后重新启动。
