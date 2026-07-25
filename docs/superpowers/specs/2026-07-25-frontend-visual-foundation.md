# Loomoon 前端视觉基座设计

## 目标

建立可主题化、可测试、依赖边界明确的前端视觉组件基座，承载网站主体、画布外围交互和 Agent UI。

## 第一阶段交付

- `@loomoon/design-tokens`：CSS 与 TypeScript 双出口，提供 light/dark 主题和 Canvas Token。
- `@loomoon/ui`：Base UI 封装与第一批基础组件。
- Web ThemeProvider：支持 light/dark/system、持久化和系统主题响应。
- Canvas Theme Bridge：把当前语义主题提供给 Konva。
- 架构契约测试：约束依赖边界和视觉硬编码。
- 将现有 Web 根节点接入 Token 与 ThemeProvider。

## 第一批组件

- Button
- IconButton
- Panel
- Badge
- Spinner

复杂弹层和表单组件在迁移对应页面时按需加入，避免一次性建设未使用的组件。

## 验收

- light/dark/system 均能产生确定主题。
- DOM 和 Konva 从同一 Token 包获取视觉值。
- Web 业务源码不能直接导入 Base UI、CVA 和 assistant-ui。
- 现有测试、类型检查和构建通过。
- 当前页面在 light 主题下不发生布局回归。
