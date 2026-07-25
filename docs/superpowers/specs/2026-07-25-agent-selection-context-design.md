# Agent 选区上下文注入设计

## 问题

前端会将画布图片选区作为 `selectedNodeIds` 提交，后端也会将其保存为不可变的 Selection Snapshot，但 Pi Runtime 当前只收到用户文本。Pi 在选择工具之前无法知道本条消息附带了图片选区。

## 方案

Agent Coordinator 在调用 Pi Runtime 前构造受信上下文：

- 保留用户输入原文；
- 标明消息提交时选中的图片节点数量；
- 提供项目内节点 ID；
- 指示模型需要理解内容时调用 `analyze_selected_images`；
- 指示模型根据数量选择单图或多图修改工具；
- 不提供图片 URL、对象存储键、文件路径或其他外部输入。

用户消息持久化和界面展示仍使用原始文本。所有工具仍使用消息提交时保存的 Selection Snapshot，不能读取后来变化的当前画布选区。

## 验收

- 无选区消息传给 Pi 时不附加选区说明；
- 有选区消息传给 Pi 时包含准确数量和节点 ID；
- 持久化的用户消息保持原文；
- 修改画布当前选区不会改变已创建 Run 的 Selection Snapshot；
- API、Agent Runtime 和 Web 回归测试通过。

