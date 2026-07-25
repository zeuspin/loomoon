export type CanvasIntent = "create_plan" | "analyze" | "edit" | "reference" | "clarify";

const analysisPattern = /(比较|分析|推荐|总结|哪个好|差异|评价)/i;
const editPattern = /(修改|改成|替换|移除|去掉|增加|添加|背景|颜色|材质|风格|重绘|融合|生成)/i;
const explicitMultiScopePattern = /(全部|所有|每张|分别|都|这[两三四五六七八]张|主图|参考|融合)/i;
const referencePattern = /(作为参考|参考图|融合|构图参考|色彩参考|颜色参考|材质参考|主图.*参考)/i;

export function classifyCanvasIntent(message: string, selectedImageCount: number): CanvasIntent {
  if (selectedImageCount > 8) throw new Error("IMAGE_SELECTION_LIMIT");
  if (selectedImageCount === 0) return "create_plan";
  if (analysisPattern.test(message) && !editPattern.test(message)) return "analyze";
  if (selectedImageCount > 1 && referencePattern.test(message)) return "reference";
  if (selectedImageCount > 1 && !explicitMultiScopePattern.test(message)) return "clarify";
  return "edit";
}
