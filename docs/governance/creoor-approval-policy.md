# Creoor 验收审批策略

本地开发使用 `acceptance:plan`，不得宣称发布门禁通过。发布候选提交后，由仓库负责人在受保护环境配置 `CREOOR_BASELINE_COMMIT` 与 `CREOOR_APPROVER_PUBLIC_KEYS`，验证截图批准和临时豁免签名。缺少这些变量时 `acceptance:check` 必须失败。

本轮用户在浏览器中验收候选原型；确认反馈将作为下一次批准回执的输入，但明文姓名本身不是加密签名。
