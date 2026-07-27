import { config as loadDotEnv } from "dotenv";
import { parseServerEnv } from "@loomoon/config";
import { BailianClient, MockBailianProvider } from "@loomoon/bailian-provider";
import { PiRuntime } from "@loomoon/agent-runtime";
import { resolve } from "node:path";
import { buildApp } from "./app.js";
import { AgentCoordinator } from "./agent-coordinator.js";
import { JsonAgentRepository } from "./agent-repository.js";
import { LocalAssetStore } from "./asset-store.js";
import { DemoAgentToolApplication } from "./demo-agent-application.js";
import type { DemoProvider } from "./demo-service.js";
import { AuthService } from "./auth-service.js";
import { LocalGenerationExecutor } from "./local-generation-executor.js";
import { ProjectRegistry } from "./project-registry.js";
import { createImageModelCatalog } from "./image-model-catalog.js";

loadDotEnv({ path: resolve(import.meta.dirname, "../../../.env") });
const env = parseServerEnv(process.env);
const imageModelCatalog = createImageModelCatalog({
  primaryModelId: env.BAILIAN_IMAGE_MODEL,
  fallbackModelId: env.BAILIAN_IMAGE_FALLBACK_MODEL,
  draftModelId: env.BAILIAN_DRAFT_IMAGE_MODEL
});
const dataRoot = resolve(".local-data");
const assetsRoot = resolve(dataRoot, "assets");
const assets = new LocalAssetStore(assetsRoot);
const bailian = new BailianClient({
  apiKey: env.BAILIAN_API_KEY,
  baseUrl: env.BAILIAN_BASE_URL,
  agentModel: env.BAILIAN_AGENT_MODEL,
  imageModel: env.BAILIAN_IMAGE_MODEL
});
const bailianProvider: DemoProvider = {
  createPlan: async (brief, imageUrls = []) =>
    bailian.createPlan(
      brief,
      await Promise.all(imageUrls.map((url) => assets.toDataUrl(url)))
    ),
  analyzeImages: async (instruction, imageUrls) =>
    bailian.analyzeImages(
      instruction,
      await Promise.all(imageUrls.map((url) => assets.toDataUrl(url)))
    ),
  decideImageIntent: (instruction, selectedImageCount) =>
    bailian.decideImageIntent(instruction, selectedImageCount),
  generateImage: async (prompt, imageUrls, options) =>
    bailian.generateImage(
      prompt,
      await Promise.all(imageUrls.map((url) => url.startsWith("data:image/") ? url : assets.toDataUrl(url))),
      Array.isArray(options)
        ? [[options]]
        : options
          ? {
              ...(options.modelId ? { modelId: options.modelId } : {}),
              ...(options.width ? { width: options.width } : {}),
              ...(options.height ? { height: options.height } : {}),
              ...(options.quality ? { quality: options.quality } : {}),
              ...(options.seed !== undefined ? { seed: options.seed } : {}),
              ...(options.bbox ? { bboxList: [[options.bbox]] } : {})
            }
          : undefined
    )
};
const provider: DemoProvider =
  env.DEMO_PROVIDER === "mock"
    ? new MockBailianProvider({ delayMs: 800 })
    : bailianProvider;
const authService = await AuthService.createDemo();
const projectRegistry = new ProjectRegistry(
  dataRoot,
  provider,
  (userId, url) => assets.materialize(url, userId)
);
const agentRepository = new JsonAgentRepository(resolve(dataRoot, "agent"));
let agentCoordinator: AgentCoordinator;
const generationExecutor = new LocalGenerationExecutor({
  repository: agentRepository,
  executeAction: async (action) => {
    const service = await projectRegistry.service(action.userId, action.projectId);
    await service.confirm(
      action.projectId,
      action.id,
      typeof action.input.directionId === "string" ? action.input.directionId : undefined
    );
  },
  onSucceeded: (action) => agentCoordinator.resumeAfterJobs(action)
});
agentCoordinator = new AgentCoordinator({
  repository: agentRepository,
  generationExecutor,
  applicationFor: async ({ userId, projectId, runId }) => new DemoAgentToolApplication({
    service: await projectRegistry.service(userId, projectId),
    repository: agentRepository,
    userId,
    projectId,
    runId
  }),
  mirrorMessage: async (message) => {
    const service = await projectRegistry.service(message.userId, message.projectId);
    await service.appendAgentMessage(
      message.projectId,
      message.role === "user" ? "user" : "assistant",
      message.content,
      message.selectionSnapshot
    );
  },
  runtimeFactory: ({ sessionId, tools, onEvent }) => new PiRuntime({
    apiKey: env.BAILIAN_API_KEY,
    baseUrl: env.BAILIAN_BASE_URL,
    model: env.BAILIAN_AGENT_MODEL,
    sessionId,
    tools,
    onEvent,
    systemPrompt: [
      "你是 Loomoon 视觉创意 Agent。你必须通过已注册的业务工具读取和修改项目，不能假装执行。",
      "首次视觉需求先调用 create_creative_plan 产生恰好两个方向，再调用 generate_images 建立四张图片的待确认操作。",
      "图片生成、图片修改、参考生成和区域修改只建立待确认操作；必须等待用户在界面确认，绝不能绕过确认。",
      "多图分析只调用 analyze_selected_images。指令含糊时先用简短中文澄清，不创建付费操作。",
      "不要展示隐藏思维链。向用户只说明结果、下一步以及必要的工具状态。"
    ].join("\n")
  })
});
const app = buildApp({
  authService,
  projectRegistry,
  assetsRoot,
  providerName: env.DEMO_PROVIDER,
  agentCoordinator,
  imageModelCatalog
});

await app.listen({
  host: env.API_HOST,
  port: env.API_PORT
});
