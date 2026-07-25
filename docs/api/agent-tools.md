# Agent 业务工具边界

Pi Agent Core 在 Demo 中不注册 Shell、文件系统、任意 HTTP 或动态扩展工具。
当前受限业务动作由 API 服务校验和执行：

| 工具 | 副作用 | 是否确认 |
|---|---:|---:|
| `analyze_selected_images` | 否 | 否 |
| `create_creative_plan` | 仅计划和占位 | 否 |
| `revise_creative_plan` | 仅替换未确认计划 | 否 |
| `generate_images` | 是 | 是 |
| `edit_single_image` | 是 | 是 |
| `edit_multiple_images` | 是 | 是 |
| `generate_from_references` | 是 | 是 |
| `inpaint_image` | 是 | 是 |
| `get_generation_status` | 否 | 否 |

所有有成本动作必须消费持久化 `ConfirmationGrant`。Grant 绑定动作、目标、任务数、
SHA-256 输入哈希和 30 分钟过期时间；重复消费返回已有状态，不重复创建任务。

每次 Agent 动作记录 `userId`、`projectId`、`agentRunId`、动作、目标、状态和时间。
计划及图片结果额外保存百炼响应 ID和解析后的模型名称。
