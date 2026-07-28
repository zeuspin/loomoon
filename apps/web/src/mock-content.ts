export type ContentCapability = "real" | "mock";

export interface InspirationCategory {
  id: string;
  label: string;
}

export interface InspirationResult {
  id: string;
  name: string;
  imageUrl: string;
  aspectRatio: number;
}

export interface InspirationReplayStep {
  id: string;
  title: string;
  description: string;
  resultId: string;
}

export interface InspirationCase {
  id: string;
  categoryId: string;
  title: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  prompt: string;
  model: string;
  views: number;
  likes: number;
  coverUrl: string;
  results: InspirationResult[];
  replaySteps: InspirationReplayStep[];
  capability: ContentCapability;
}

export interface MembershipPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  monthlyCredits: number;
  concurrency: number;
  commercialUse: boolean;
  capability: ContentCapability;
}

export interface MockNotice {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  capability: ContentCapability;
}

export interface MockProfile {
  id: string;
  name: string;
  avatarUrl: string;
  publishedCaseIds: string[];
  likedCaseIds: string[];
  capability: ContentCapability;
}

export interface MockCapabilities {
  imageGeneration: ContentCapability;
  videoGeneration: ContentCapability;
  onlineResearch: ContentCapability;
  publicSharing: ContentCapability;
}

const categories: InspirationCategory[] = [
  { id: "all", label: "全部" },
  { id: "brand", label: "品牌设计" },
  { id: "poster", label: "海报与广告" },
  { id: "illustration", label: "插画" },
  { id: "ui", label: "UI设计" },
  { id: "character", label: "角色设计" },
  { id: "storyboard", label: "影片与分镜" },
  { id: "product", label: "产品设计" },
  { id: "architecture", label: "建筑设计" },
];

const caseSeeds = [
  ["new-year", "poster", "黏土风｜马年元素海报设计", "DDDD", 244700, 297, 0.72],
  ["city-seo", "brand", "城市字形与节日灯光品牌视觉", "TIBERS", 85276, 85, 0.78],
  ["golden-arena", "poster", "大透视 3D 质感运动场景", "五星好评送可乐", 35782, 102, 1.16],
  ["oriental-vase", "illustration", "东方器物与植物系列插画", "天亦", 192242, 440, 0.82],
  ["cloud-stamp", "brand", "新中式邮票与云纹品牌系统", "一壶浊酒", 166509, 171, 1.0],
  ["hello-festival", "character", "节日角色 IP 延展设计", "爱迪森sam", 604535, 827, 0.75],
  ["pet-park", "brand", "MINI PARK 宠物品牌设计", "15号设计师", 207184, 569, 1.0],
  ["sky-boat", "storyboard", "云海孤舟概念视觉", "微信用户5429ec", 50740, 21, 0.78],
] as const;

function mockImageUrl(seed: string, index: number): string {
  return `https://picsum.photos/seed/loomoon-${seed}-${index}/900/1200`;
}

const cases: InspirationCase[] = caseSeeds.map(
  ([id, categoryId, title, author, views, likes, aspectRatio], caseIndex) => {
    const results: InspirationResult[] = Array.from({ length: 5 }, (_, index) => ({
      id: `${id}-result-${index + 1}`,
      name: `${title}${index + 1}`,
      imageUrl:
        index === 0
          ? `/inspiration/${String(caseIndex + 1).padStart(2, "0")}.webp`
          : mockImageUrl(id, index + 1),
      aspectRatio,
    }));
    return {
      id,
      categoryId,
      title,
      author: {
        id: `author-${id}`,
        name: author,
        avatarUrl: mockImageUrl(`avatar-${id}`, 1),
      },
      prompt: `参考案例《${title}》的构图、材质与色彩语言，生成一组具有完整视觉叙事的设计方案。`,
      model: "Loomoon Image V2",
      views,
      likes,
      coverUrl: results[0]?.imageUrl ?? "",
      results,
      replaySteps: results.slice(0, 4).map((result, index) => ({
        id: `${id}-step-${index + 1}`,
        title: index === 0 ? "分析参考与创作目标" : `生成方向 ${index}`,
        description:
          index === 0
            ? "提取构图、材质、色彩和主体关系。"
            : `根据方向 ${index} 生成并筛选可用结果。`,
        resultId: result.id,
      })),
      capability: "mock",
    };
  },
);

const membershipPlans: MembershipPlan[] = [
  {
    id: "starter",
    name: "入门版",
    monthlyPrice: 99,
    monthlyCredits: 2000,
    concurrency: 2,
    commercialUse: false,
    capability: "mock",
  },
  {
    id: "basic",
    name: "基础版",
    monthlyPrice: 179,
    monthlyCredits: 3500,
    concurrency: 4,
    commercialUse: true,
    capability: "mock",
  },
  {
    id: "pro",
    name: "专业版",
    monthlyPrice: 469,
    monthlyCredits: 11000,
    concurrency: 8,
    commercialUse: true,
    capability: "mock",
  },
  {
    id: "flagship",
    name: "旗舰版",
    monthlyPrice: 999,
    monthlyCredits: 27000,
    concurrency: 10,
    commercialUse: true,
    capability: "mock",
  },
];

const notices: MockNotice[] = [
  {
    id: "notice-1",
    title: "欢迎使用 Loomoon",
    body: "你的 Agent 与画布会在项目中持续保存。",
    createdAt: "2026-07-26T00:00:00.000Z",
    read: false,
    capability: "mock",
  },
  {
    id: "notice-2",
    title: "移动端体验已更新",
    body: "可通过底部工具坞打开画布工具和 Agent。",
    createdAt: "2026-07-25T00:00:00.000Z",
    read: true,
    capability: "mock",
  },
];

const profile: MockProfile = {
  id: "demo-profile",
  name: "Loomoon 创作者",
  avatarUrl: mockImageUrl("profile", 1),
  publishedCaseIds: ["new-year", "golden-arena"],
  likedCaseIds: ["oriental-vase", "pet-park"],
  capability: "mock",
};

export const mockContentRepository = {
  listInspirationCategories: () => categories,
  listInspirationCases: () => cases,
  getInspirationCase: (caseId: string) =>
    cases.find((item) => item.id === caseId),
  listMembershipPlans: () => membershipPlans,
  listNotices: () => notices,
  getProfile: () => profile,
  getCapabilities: (): MockCapabilities => ({
    imageGeneration: "real",
    videoGeneration: "mock",
    onlineResearch: "mock",
    publicSharing: "mock",
  }),
};
