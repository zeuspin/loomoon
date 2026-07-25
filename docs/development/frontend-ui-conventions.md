# 前端视觉组件约定

## 使用原则

- 页面优先从 `@loomoon/ui` 导入组件。
- 页面布局允许使用受控 Tailwind 工具类，但颜色、圆角、阴影必须使用语义类或组件 API。
- 通用交互状态在组件包内实现，业务页面只传递 `variant`、`size`、`tone` 和状态属性。
- Agent 专属组件从 `@loomoon/agent-ui` 导入。
- Konva 编辑辅助视觉从 `@loomoon/design-tokens/canvas` 获取。

## 禁止模式

```tsx
// 禁止：业务层直接引用底层实现。
import { Dialog } from "@base-ui/react/dialog";
import { cva } from "class-variance-authority";

// 禁止：业务页面硬编码品牌视觉。
<button className="rounded-[7px] bg-[#6456e8] shadow-[0_8px_20px_#0002]" />
```

## 正确模式

```tsx
import { Button, Dialog } from "@loomoon/ui";

<Button variant="primary" size="md">确认生成</Button>
```

## 新组件准入清单

- 是否已经存在可以组合完成需求的组件？
- 是否使用语义 Token 而非原始色值？
- 是否覆盖 hover、focus-visible、disabled 和 error 等状态？
- 是否支持键盘操作和可访问名称？
- 是否有组件契约测试或展示用例？
- 是否会影响暗色主题和 Konva 主题桥接？

## 例外流程

确需绕过共享组件时，在代码旁引用对应 ADR，并在同一变更中记录移除期限。没有 ADR 的临时视觉覆盖不允许合并。
