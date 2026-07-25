# ADR-0001：前端视觉与交互基座

- 状态：已接受
- 日期：2026-07-25
- 决策范围：Loomoon Web、Agent UI、画布外围 UI 与 Konva 编辑器主题

## 背景

Loomoon 同时包含网站主体、Agent 对话界面和 Konva 无限画布。页面级 CSS 可以快速验证 Demo，但无法稳定约束圆角、颜色、阴影、状态和主题，需求增长后容易形成多套视觉实现。

## 决策

1. 网站主体和画布外围交互统一采用 **Base UI + Tailwind CSS 4 + CVA + Lucide**。
2. Agent 对话层采用 **assistant-ui Base UI flavor**，封装在 `@loomoon/agent-ui` 内。
3. Konva 继续作为画布渲染与交互引擎，不由 DOM 组件框架替代。
4. 所有视觉值来源于 `@loomoon/design-tokens`。CSS 组件消费 CSS Variables；Konva 消费同包导出的 TypeScript Token。
5. 业务代码只能使用 `@loomoon/ui`，不得直接引用 `@base-ui/react`、CVA 或 assistant-ui。
6. 产品主题只改变编辑器外壳和编辑辅助视觉，不得改变用户创作内容。

## 依赖边界

```text
@loomoon/design-tokens
        ├── @loomoon/ui
        ├── @loomoon/agent-ui
        └── @loomoon/canvas-ui
                    ↓
                apps/web
```

- `@loomoon/ui` 可以依赖 Base UI、CVA 和 Lucide。
- `@loomoon/agent-ui` 可以依赖 assistant-ui 和 `@loomoon/ui`。
- `@loomoon/canvas-ui` 可以依赖 Konva 类型和 `@loomoon/design-tokens`。
- `apps/web` 不得直接依赖 Base UI、CVA 或 assistant-ui。
- 基础包不得反向依赖 `apps/web`。

## 主题契约

主题使用三层 Token：

1. Primitive Token：原始色阶和尺寸。
2. Semantic Token：`surface`、`text`、`accent`、`selection` 等产品语义。
3. Component Token：按钮、浮层、输入和画布辅助状态。

主题由根元素的 `data-theme` 控制，首期支持 `light`、`dark`、`system`。用户主题偏好持久化到浏览器；`system` 跟随 `prefers-color-scheme`。

Konva 通过 Canvas Theme Bridge 获得当前语义颜色。画布文档中不得保存编辑器主题颜色。

## 强制约束

- 控件圆角为 `2px`，容器和媒体最大为 `4px`；语义圆形元素例外。
- 边框只用于结构分割、输入/焦点、选中和错误状态。
- 阴影只用于表达浮层关系。
- 禁止业务页面写十六进制、RGB/HSL 色值、任意圆角和任意阴影。
- 禁止业务页面直接使用 `@base-ui/react`、`class-variance-authority` 和 `@assistant-ui/*`。
- 新视觉需求必须先扩展语义 Token 或共享组件，不得通过页面覆盖组件内部样式。

## 变更治理

以下变更必须先更新本 ADR 或新增 ADR：

- 替换 Base UI、Tailwind、assistant-ui 或 Konva。
- 增加新的主题维度或改变 Token 分层。
- 允许业务层直接引用底层 UI 依赖。
- 改变组件包依赖方向。

普通组件新增不需要 ADR，但必须提供展示用例、状态覆盖和自动化测试。

## 后果

短期需要建设组件包和迁移现有页面；长期可以统一品牌、主题、无障碍交互和画布辅助视觉，并降低需求对页面样式的冲击。
