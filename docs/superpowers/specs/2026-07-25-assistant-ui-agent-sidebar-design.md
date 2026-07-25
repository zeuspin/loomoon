# Loomoon assistant-ui Agent 侧栏迁移设计

## 1. 目标

使用 assistant-ui 完整替换现有 Agent 侧栏，使消息、Composer、附件、运行状态、错误恢复和工具交互拥有统一的前端状态模型，同时保持现有 Agent 后端、SSE、CanvasOperation 和画布数据协议不变。

## 2. 范围

本次迁移包含：

- 历史消息与实时消息渲染
- Composer 输入、快捷键和发送状态
- 画布多图选区附件
- 创作计划、等待确认、图片生成和图片修改 Tool UI
- 失败重试、部分成功和 SSE 重连状态
- 项目切换时的 Runtime 生命周期
- Legacy 侧栏短期回退开关

本次迁移不包含：

- 更换 Agent Runtime 或百炼模型
- 修改 ComfyUI 工作流
- 重构后端消息持久化结构
- 新增后端取消接口
- 修改 CanvasOperation 数据模型
- 启用 assistant-ui Cloud

## 3. 技术决策

新增 `@loomoon/agent-ui` 包。该包可以依赖：

- `@assistant-ui/react`
- `@loomoon/ui`
- `@loomoon/design-tokens`
- `@loomoon/contracts`
- React 19

`apps/web` 不得直接引用 `@assistant-ui/*`。assistant-ui 的组件、Runtime 和类型只能通过 `@loomoon/agent-ui` 暴露。

PostgreSQL 和现有 API 仍是消息、计划和任务状态的唯一权威来源。assistant-ui Runtime 是前端投影，不成为第二份持久化数据源。

## 4. 包结构

```text
packages/agent-ui/
├── src/
│   ├── runtime/
│   │   ├── loomoon-runtime-adapter.ts
│   │   ├── message-mapper.ts
│   │   └── event-mapper.ts
│   ├── components/
│   │   ├── agent-thread.tsx
│   │   ├── agent-composer.tsx
│   │   ├── canvas-selection-attachment.tsx
│   │   ├── generation-plan-tool-ui.tsx
│   │   ├── confirmation-tool-ui.tsx
│   │   ├── image-generation-tool-ui.tsx
│   │   └── image-edit-tool-ui.tsx
│   ├── styles.css
│   └── index.ts
└── package.json
```

每个模块边界如下：

- Runtime Adapter：把 Loomoon Project、回调和运行状态映射为 assistant-ui Runtime。
- Message Mapper：把服务端消息、计划和任务映射为 assistant-ui 消息部件。
- Event Mapper：合并 SSE 推送，按稳定 ID 去重并触发权威 Project 对齐。
- Components：只渲染状态和发出用户意图，不直接访问 API。
- `apps/web`：提供当前 Project、Canvas Selection 和命令回调。

## 5. 数据流

```text
Canvas Selection
    ↓
CanvasSelectionAttachment
    ↓
assistant-ui Composer
    ↓
LoomoonRuntimeAdapter
    ↓
api.sendMessage(projectId, text, nodeIds)
    ↓
Agent / Bailian / ComfyUI
    ↓
existing project SSE event
    ↓
authoritative Project reload
    ↓
message-mapper + event-mapper
    ↓
assistant-ui Thread and Tool UI
```

前端发送命令后可以显示乐观的发送中状态，但服务端返回或 SSE 刷新后必须由权威 Project 替换。消息 ID、任务 ID 和 CanvasOperation 幂等键用于去重。

## 6. 消息与工具映射

第一阶段不修改后端消息结构。Message Mapper 联合读取：

- `project.messages`
- `project.plans`
- `project.tasks`
- `message.nodeIds`
- 当前 `confirmation`

并生成以下前端部件：

| Loomoon 数据 | assistant-ui 表现 |
|---|---|
| 用户文本消息 | User Message |
| Agent 普通回复 | Assistant Text Message |
| 等待确认的创作计划 | GenerationPlan Tool UI |
| 确认请求 | Confirmation Tool UI |
| 图片生成任务 | ImageGeneration Tool UI |
| 图片修改任务 | ImageEdit Tool UI |
| 无法识别的结构化状态 | Generic Tool Fallback |

映射失败必须降级为普通文本或通用工具卡，不得导致整个 Thread 渲染失败。

## 7. 画布多图附件

画布多选不会重新上传素材。Composer 接收稳定的画布引用：

```ts
type CanvasSelectionAttachment = {
  type: "canvas-selection";
  canvasVersion: number;
  nodeIds: string[];
  assets: Array<{
    assetId: string;
    thumbnailUrl: string;
    width: number;
    height: number;
  }>;
};
```

发送时复制附件快照。发送后用户改变当前选择，不影响历史消息引用。后端继续接收 `nodeIds`，并依据项目权限读取对应素材。Agent 自行判断附件用于比较、融合、参考还是逐张修改。

## 8. 状态归属

assistant-ui 负责：

- Thread、Message 和 Composer 状态
- 自动滚动
- 附件预览
- 前端发送中、失败和重试状态
- Tool UI 展示生命周期
- 消息操作与无障碍行为

Web 和画布负责：

- 当前 Canvas Selection
- Project 加载与切换
- Canvas Snapshot 和 CanvasOperation
- 节点位置、选择与画布缩放
- SSE 订阅
- API 命令回调

后端负责：

- 消息、计划和任务持久化
- Agent 调度
- 百炼和 ComfyUI 调用
- CanvasOperation 事务和幂等
- 素材权限和 MinIO 对象

## 9. 错误与恢复

- 发送失败：保留输入与附件，显示重试操作。
- SSE 中断：保留当前 Thread，显示轻量重连状态；恢复后重新读取权威 Project。
- 图片任务失败：Tool UI 显示错误码、可读原因和真实可用的重试操作。
- 部分生成成功：保留成功结果，只重试失败任务。
- 图片修改失败：保留原图和当前画布版本，不提交半完成 CanvasOperation。
- 重复事件：依据消息 ID、任务 ID 和操作幂等键去重。
- 项目切换：关闭旧订阅、清除旧项目瞬时 Runtime 状态，再加载新 Project。
- 未识别状态：使用 Generic Tool Fallback，不阻塞其他消息。

后端尚未提供取消接口，因此第一阶段不显示取消生成按钮。未来后端增加取消能力后，再映射 assistant-ui interrupt。

## 10. 回退与删除策略

迁移期间提供：

```env
VITE_AGENT_UI_RUNTIME=assistant-ui
```

允许值：

- `assistant-ui`
- `legacy`

默认使用 `assistant-ui`。Legacy 仅用于迁移期问题定位；新侧栏完成验收后删除 Legacy 代码和环境开关，不长期维护两套 Agent UI。

## 11. 视觉设计

Demo 整体视觉以浅色和白色为主：

- 默认主题固定为浅色。
- 页面背景使用浅中性灰。
- Agent 侧栏、消息、Composer 和 Tool UI 使用白色内容面。
- 紫色只用于主操作、选中、运行状态和焦点。
- 状态色只用于成功、警告和错误反馈。
- 控件圆角为 `2px`，容器和媒体最大为 `4px`。
- 普通卡片不使用装饰性边框或厚重阴影。
- 浮层允许使用轻阴影表达层级。
- 不使用装饰性渐变。

底层继续保留 `light`、`dark` 和 `system` Token 能力，但 Demo 默认 `light`，并隐藏主题切换入口。未来只能通过明确的产品设置或企业配置重新开放主题入口。

assistant-ui 自带示例样式不得直接进入产品。所有 assistant-ui 部件必须映射 Loomoon Semantic Token。

## 12. 功能验收

1. 历史消息顺序、角色和文本完整。
2. 文本发送与 `Cmd/Ctrl + Enter` 正常。
3. 画布圈选多图后能作为一次性上下文发送。
4. 创作计划可以确认或要求修改。
5. 图片生成的排队、运行、成功、部分失败和全部失败状态可识别。
6. 图片修改结果插入画布且原图保留。
7. 发送失败时输入和附件可恢复并重试。
8. SSE 重连后消息与任务不重复。
9. 项目切换后不串消息、不串附件、不串任务状态。
10. Legacy 开关在迁移期可以回退。

## 13. 视觉验收

1. Agent 侧栏主要内容面为白色。
2. 工作区为浅中性灰，用户画板保持纯白。
3. 所有非圆形语义元素圆角不超过 `4px`。
4. 普通消息和工具卡不依赖装饰性边框。
5. 常驻卡片不使用厚重阴影。
6. 紫色面积受控，只表达操作和状态。
7. assistant-ui 示例主题没有泄漏到产品。
8. Demo 中不显示主题切换入口。
9. 暗色 Token 契约测试继续通过。

## 14. 测试策略

- Message Mapper 单元测试：所有消息、计划、任务和降级映射。
- Event Mapper 单元测试：事件去重、乱序和项目切换。
- Runtime Adapter 单元测试：发送、失败、重试和权威状态替换。
- 组件服务端渲染测试：角色、无障碍名称和 Tool UI 状态。
- Web 集成测试：Canvas Selection 到发送回调的完整参数。
- 架构契约测试：禁止 `apps/web` 直接导入 assistant-ui。
- 浏览器验收：发送、确认、生成、修改、重连和项目切换。
- 全仓测试、类型检查、生产构建和 `git diff --check`。

## 15. 实施顺序

1. 创建 `@loomoon/agent-ui` 和测试基座。
2. 实现 Message Mapper 与 Tool UI 数据模型。
3. 实现 Canvas Selection Attachment。
4. 实现 assistant-ui Runtime Adapter。
5. 构建浅色 Agent Thread 与 Composer。
6. 在 Web 中接入 Feature Flag 和新侧栏。
7. 完成浏览器垂直闭环验收。
8. 稳定后删除 Legacy 侧栏和回退开关。
