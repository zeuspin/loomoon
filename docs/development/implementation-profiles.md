# 实现配置档

Loomoon 保留两种运行配置，业务契约和画布文档格式一致。

## `local-demo`（当前默认、可立即验收）

- Fastify API + React/Konva Web；
- Pi Agent Core + 百炼 Qwen/Wan；
- `.local-data/projects/<userId>` 项目快照；
- `.local-data/assets/<userId>` 用户作用域图片；
- 项目级 SSE 快照流；
- API 进程内最多两个并行图片调用；
- 服务重启时把无法继续查询的同步任务恢复为可重试失败。

该配置不需要 Docker，目标是让产品闭环和真实模型调用可以在开发机直接验证。

## `infrastructure`（生产适配基线）

- PostgreSQL 17 + Drizzle Schema；
- 快照、CanvasOperation、ConfirmationGrant、Task、Asset Relation 和 Outbox 表；
- Redis/BullMQ 图片队列；
- MinIO 或任意 S3 兼容对象存储；
- 用户/项目作用域对象键和 30–900 秒短期签名下载地址。

已交付的实现基线：

- `packages/database/src/schema.ts`
- `packages/database/migrations/0001_initial.sql`
- `packages/object-storage/src/index.ts`
- `docker-compose.yml`
- `infra/minio/init.sh`

当前 Demo API 还没有切换到 Drizzle Repository/BullMQ Worker；这是有意保留的部署切换点，
不会伪装成已经启用的能力。正式部署前需要把 `ProjectStore` 与 `materializeAsset` 注入分别替换为
数据库和 S3 实现，并启用 Outbox Publisher。产品层不需要修改。
