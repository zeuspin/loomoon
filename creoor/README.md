# Creoor 工作台

Creoor 是面向服装设计师与服装品牌团队的 Agent 无限画布产品。本目录保存第一阶段的独立 Web 前端原型：以无限画布承载图片与生成结果，通过右侧 Agent 对话理解、询问和澄清设计意图，并以 Mock 数据验证核心视觉和交互。

当前阶段聚焦项目工作台，不代表完整产品或可发布版本。真实 AI、登录、多人协作、完整落地页以及生产后端均不在当前实现范围内。

## 需求、设计与执行计划

- [原始需求与交互设计](../docs/superpowers/specs/2026-07-28-creoor-workbench-design.md)：产品目标、用户角色、黄金路径、面板行为、图片类型能力、Agent 上下文、iPad 与 Pencil 约束，以及验收口径。
- [实施计划](../docs/superpowers/plans/2026-07-29-creoor-workbench.md)：按任务拆分的文件、接口、测试、提交和发布门禁。
- [原子验收矩阵](../docs/development/creoor-acceptance.md)：需求条目与证据状态；机器可读版本位于 [`creoor-acceptance.json`](../docs/development/creoor-acceptance.json)。
- [视觉基线](../docs/design/creoor-visual-baseline.md) 与 [本地设计 QA](./design-qa.md)：参考界面、固定视口和当前截图验证结论。

需求解释发生冲突时，优先级为：已经确认的产品设计文档 → 实施计划 → 本 README → 当前实现细节。若实现与设计文档不一致，应记录差异，而不是静默修改需求。

## 本地开发

仓库要求 Node.js 24+ 与 pnpm 11+。从仓库根目录安装依赖：

```bash
pnpm install
```

常用命令：

```bash
pnpm --dir creoor dev         # 启动 Vite 开发服务
pnpm --dir creoor test        # 运行 Creoor Vitest 测试
pnpm --dir creoor test:watch  # 监听测试
pnpm --dir creoor typecheck   # 严格 TypeScript 检查
pnpm --dir creoor build       # 类型检查并生成生产构建
pnpm --dir creoor acceptance:plan # 校验验收矩阵的计划态结构
```

提交前至少运行：

```bash
pnpm --dir creoor test
pnpm --dir creoor typecheck
pnpm --dir creoor build
git diff --check
```

`test:e2e`、`test:visual`、覆盖率门禁、Token 检查与 release 态验收脚本是实施计划中的正式交付命令。只有相应配置、测试文件和受保护 CI 证据完整时，才可将它们标记为通过。

## 工程边界

- `src/app/`：工作台组合层和页面级样式。
- `src/contracts/`：画布、Agent、资产与面板的共享类型契约。
- `src/theme/`：主题 Token 的唯一视觉来源。
- `public/assets/`：已授权或项目生成的静态演示素材。
- `design-qa/`：固定视口的本地视觉验收截图。

Creoor 是 pnpm workspace 成员，但保持独立入口、脚本和构建产物。可复用且与 Creoor 无关的能力应进入仓库 `packages/`；Creoor 专属交互留在本目录。

## 核心工程约定

### 画布与 DOM

- Konva 负责无限画布坐标、节点、选择、拖拽、缩放和画布网格。
- React DOM 负责 Agent、工具栏、图片菜单、生成器表单和无障碍界面。
- DOM 浮层必须由统一的画布到屏幕坐标转换定位，不得复制一套独立的画布状态。
- 图片编辑默认创建可追溯的派生结果并保留原图；不要直接破坏源资产。

### 主题与视觉

- 视觉值遵循 `primitive → semantic → component` 引用链。
- 组件不得散落未经定义的颜色、字号、圆角、阴影、边框、层级或动效时长。
- 新视觉值先加入 `src/theme/primitives.css`，再映射到语义 Token，最后由组件 Token 或组件样式引用。
- 图标统一使用 Lucide 系列；不要用 Emoji、CSS 图形或临时 SVG 代替产品图标。
- 画布网格等画布内容由 Konva 绘制，不使用 CSS 渐变模拟。

### Agent 与显式上下文

- Agent 不得默认读取整张画布。只有用户明确加入当前会话的图片、对象、选区或批注才进入 Mock 请求。
- 多张参考图通过稳定 ID 和 `@图1` 等结构化引用绑定，不能只依赖显示顺序或文件名。
- 每个项目一张画布；不同 Agent 会话拥有独立上下文。
- 含糊需求先进入澄清状态，用户确认适用对象和参数后才能执行图片操作。

### Mock、本地数据与隐私

- 当前 Agent、视觉识别和生成结果均为前端 Mock，不评价真实模型质量、识别准确率或生成速度。
- “仅存于此浏览器”只表示当前浏览器配置中的本地数据，不等同于账户级私有云存储。
- 未经需求和隐私说明更新，不得上传用户图片、录音或画布内容。
- 共享设备存在本地数据可见风险；后续持久化必须同时提供删除项目与清除全部数据能力。

### 输入、响应式与无障碍

- 鼠标、键盘、触控和 Apple Pencil 使用同一套 Pointer Events 行为模型。
- 触控目标、面板拖动把手和画布手势必须避免与 Pencil 绘制冲突。
- 桌面 Web 与 iPad 横屏是主要布局；窄屏应降级为仍可操作的单面板模式。
- 所有仅图标按钮必须具有可访问名称；关键操作必须提供键盘替代路径和可见状态反馈。

### 代码、测试与提交

- 使用 TypeScript ES modules、双引号、分号和两空格缩进。
- React 组件和导出类型使用 PascalCase，函数与变量使用 camelCase，源文件使用 kebab-case。
- 行为变更必须配套同目录 `*.test.ts` 或 `*.test.tsx` 回归测试。
- UI 变更应同时提供浏览器交互验证和固定视口截图，并更新 `design-qa.md`。
- 不提交 `.env`、密钥、`node_modules/`、`dist/`、覆盖率产物或未经许可的素材。

## 当前原型与发布门禁

当前实现可演示 Konva 画布、服装图片选择、上下文图片操作、显式参考图、Agent 澄清、生成器表单以及生成结果回写。

以下项目仍是正式发布门禁，不能用桌面浏览器模拟结果替代：

- Chromium、Firefox 与 WebKit 的完整黄金路径和视觉回归。
- 两类真实 iPad Safari 与 Apple Pencil 手势验证。
- 性能基准、无障碍全量检查和五名服装设计师可用性研究。
- 受保护 CI 中的验收矩阵、证据哈希和产品/技术批准。

在这些证据齐全之前，只能称为“交互原型”或“本地候选”，不能称为生产完成。
