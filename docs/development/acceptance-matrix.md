# Loomoon Demo 验收矩阵

本文把产品规格中的完成定义映射到当前 `local-demo` 的可重复证据。当前运行配置使用
Fastify、React/Konva、Pi Agent Core、真实百炼、本地 JSON 快照和用户作用域资产目录。
PostgreSQL、Redis、BullMQ 和 MinIO 属于 `infrastructure` 生产适配基线，当前 Demo 运行时
尚未启用，不能把相关 Schema 和 Docker 文件视为运行证据。

## 自动化证据

| 规格 | 当前证据 |
|---|---|
| E2E-01 首次创作 | `verify-mock-e2e.mts` 验证两个方向、确认门、确认后准确四图、方向布局与持久化；`demo:verify` 使用真实百炼验证两个方向 |
| E2E-02 单图重绘 | Mock E2E 验证确认前零调用、保留原图、来源和生成记录 |
| E2E-03 多图分析 | Mock E2E 验证比较分析不创建图片任务并保存选择快照 |
| E2E-04 多图参考 | Mock E2E 验证全部参考图被传入并记录来源 |
| E2E-05 批量修改 | Mock E2E 验证 N 图 N 任务、单项失败隔离和失败项单独重试 |
| E2E-06 意图澄清 | Mock E2E 验证范围不明确时只询问且不创建付费任务 |
| E2E-07 区域修改 | Mock E2E 与 `region.test.ts` 验证原图像素 bbox、缩放换算、来源和确认门 |
| E2E-08 画布编辑 | `canvas-state.test.ts` 覆盖多选、框选、分组移动和层级；Web 提供移动、缩放、文字、画板、复制、锁定、分组、撤销重做 |
| E2E-09 画板导出 | 当前为浏览器手工验收项；PNG/JPEG、倍率和辅助元素隐藏需要在发布候选版签字 |
| E2E-10 断线恢复 | Mock E2E 验证运行节点恢复为可重试状态；`demo:sse` 验证项目事件流 |
| E2E-11 权限隔离 | `app.test.ts` 与真实运行验收验证项目 404 隔离、用户作用域资产下载和跨用户拒绝 |
| E2E-12 百炼异常 | Provider 单元测试覆盖超时、限流、鉴权、非法响应和不可用错误映射；批量单项失败由 Mock E2E 覆盖 |

额外证据：

- `ConfirmationGrant` 持久化、30 分钟过期、输入哈希和幂等消费；
- Pi Runtime 工具列表为空，Shell、文件系统和任意网络工具均未注册；
- 生成节点和历史保存百炼 Request ID、模型、来源、Prompt 和错误码；
- Agent 与用户同时修改时，生成结果合并且不覆盖用户最新节点位置；
- `demo:performance` 验证 100 节点保存和五个并发读取；
- `demo:verify:local` 验证环境、真实百炼模型、真实规划、权限、性能和 SSE。

## 启动与机器验收

先启动服务：

```powershell
pnpm dev
```

另开终端执行：

```powershell
pnpm demo:verify:local
pnpm demo:verify:mock
pnpm test
pnpm typecheck
pnpm build
```

`demo:verify:local` 会调用两次低输出量百炼大语言模型检查，但不会确认或生成图片。
`demo:verify:mock` 不调用百炼，不产生模型费用。

## 浏览器主流程

在当前稳定版 Chrome 和 Edge 打开 <http://localhost:6001>，使用：

```text
demo@loomoon.local / loomoon-demo
```

按照以下路径验收：

1. 创建临时项目，输入规格中的青柠气泡水需求；
2. 确认 Agent 返回两个方向，并且确认前没有生成图片；
3. 调整计划，确认版本变化且仍未生成图片；
4. 明确点击“确认并生成 4 张候选图”，确认四个任务和两个方向布局；
5. Shift 框选四图并要求比较，确认没有新增图片任务；
6. 选择一图发起整图修改，确认后原图保留且新图出现在附近；
7. 使用区域修改框选范围，检查 bbox 预览后确认；
8. 移动、缩放、复制、锁定、分组、撤销、重做并刷新；
9. 下载单图，并分别导出 1×/2× PNG 或 JPEG；
10. 打开生成历史，把历史图片重新加入画布；
11. 使用第二账号替换项目和资产 ID，确认返回统一的无权访问结果；
12. 在 Chrome 和 Edge 各走完一次主流程并记录浏览器版本。

点击图片生成或修改的确认按钮会产生实际百炼图片调用费用。自动化检查不会替用户执行这些
付费确认步骤。

## 完成边界

当前证据证明 `local-demo` 已具备本机体验与真实模型规划能力。以下内容仍属于生产部署适配，
不应在本地 Demo 验收中误报为已启用：

- PostgreSQL/Drizzle Repository；
- Redis/BullMQ 队列和 Outbox Publisher；
- MinIO/S3 资产持久化；
- Nginx 部署与生产级健康检查；
- Playwright 驱动的 Chrome/Edge 全自动签字。
