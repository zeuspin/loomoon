export interface AgentModelOption {
  id: string;
  name: string;
  description: string;
  mode: "image" | "video";
  duration?: string;
}

export const availableModels: AgentModelOption[] = [
  { id: "loomoon-image-v2", name: "Loomoon Image V2", description: "高质量通用图像生成", mode: "image" },
  { id: "flux-pro", name: "Flux Pro", description: "擅长海报、品牌与文字排版", mode: "image" },
  { id: "seedream", name: "Seedream 4", description: "快速概念探索与风格变化", mode: "image" },
  { id: "loomoon-video", name: "Loomoon Video", description: "图生视频与镜头运动（Mock）", mode: "video", duration: "5s" },
  { id: "kling", name: "Kling 2.1", description: "电影感运动与角色一致性（Mock）", mode: "video", duration: "5s / 10s" },
];

export function modelForMode(
  models: AgentModelOption[],
  mode: "image" | "video",
): AgentModelOption[] {
  return models.filter((model) => model.mode === mode);
}

export function filterConversationHistory<T extends { title: string }>(
  items: T[],
  query: string,
): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return items;
  return items.filter((item) =>
    item.title.toLocaleLowerCase().includes(normalized),
  );
}
