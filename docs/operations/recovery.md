# 本地 Demo 运维与恢复

## 健康检查

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health/live
Invoke-RestMethod http://localhost:3000/api/v1/health/ready
```

## 数据位置

- 项目目录：`.local-data/projects/<userId>/`
- 用户作用域图片：`.local-data/assets/<userId>/`
- API 日志：`.local-data/api.stdout.log`、`.local-data/api.stderr.log`

`.local-data` 已被 Git 忽略。删除项目只删除项目快照；资产采用延迟清理策略。

## 进程重启

刷新页面后 `EventSource` 自动重连。API 重启时无法继续查询的本地同步图片调用会被标记为失败，
保留 Prompt、来源和错误状态，用户可逐项重试。已完成结果和生成历史不会被删除。

## 正式基础设施

```powershell
docker compose up -d postgres redis minio minio-init
docker compose ps
```

PostgreSQL 初始化会执行 `packages/database/migrations/0001_initial.sql`；MinIO 初始化创建
`.env` 中的 Bucket。正式部署将本地 JSON Store 替换为 Drizzle Repository、将本地资产替换为
`S3ObjectStorage`，并由 BullMQ Worker 消费 Outbox 任务。

## 安全事件排查

先使用 API 响应中的 `requestId`，再结合项目 `auditLog` 中的 `agentRunId`、动作和目标定位。
图片节点及历史保存 `providerRequestId`、`resolvedModel` 和稳定 `errorCode`。
任何日志都不得打印 `.env`、Authorization Header 或图片中的私密元数据。
