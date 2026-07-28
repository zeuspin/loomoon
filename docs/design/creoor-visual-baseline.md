# Creoor 视觉基线

## 方向

Creoor 使用暖中性点阵画布、白色实体面板、橙色创作强调与蓝色键盘焦点。空间结构参考用户提供的 Miora 工作台截图：用户项目卡在左上、工具栏贴左、画布工具在左下、Agent 固定为右侧主重心；不复制其品牌或组件细节。

## 基础视觉

- Canvas: `#F5F4F0`
- Surface: `#FFFFFF`
- Floating surface: `rgba(255,255,255,.94)`
- Primary text: `#191916`
- Secondary text: `#6E6D67`
- Border: `#DEDCD5`
- Brand/action: `#F36B2B`
- Focus: `#315CF4`
- Danger: `#C83B37`
- Base radius: 10px; panel radius: 18px
- UI type: Noto Sans SC Variable + Inter Variable

所有实现值必须经过 primitives → semantic → component → state/motion 引用链。

