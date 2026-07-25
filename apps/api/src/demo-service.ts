import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import type {
  AuditEvent,
  AgentMessage,
  AgentRunResult,
  ConfirmationGrant,
  CreativePlan,
  DemoProject,
  GenerationRecord
} from "@loomoon/contracts";
import type { PlanDraft } from "@loomoon/bailian-provider";
import { classifyCanvasIntent } from "@loomoon/agent-runtime";
import type { CanvasIntent } from "@loomoon/agent-runtime";
import { layoutCreativePlan, placeDerivedImages } from "@loomoon/canvas-domain";

export interface DemoProvider {
  createPlan(brief: string, references?: string[]): Promise<PlanDraft>;
  analyzeImages(instruction: string, images: string[]): Promise<string>;
  decideImageIntent?(instruction: string, selectedImageCount: number): Promise<CanvasIntent>;
  generateImage(
    prompt: string,
    references: string[],
    bbox?: [number, number, number, number]
  ): Promise<string | { url: string; requestId?: string; model?: string }>;
}

export interface ProjectStore {
  get(): Promise<DemoProject | undefined>;
  save(project: DemoProject): Promise<void>;
}

export class MemoryProjectStore implements ProjectStore {
  #project?: DemoProject;

  async get(): Promise<DemoProject | undefined> {
    return this.#project ? structuredClone(this.#project) : undefined;
  }

  async save(project: DemoProject): Promise<void> {
    this.#project = structuredClone(project);
  }
}

export class JsonProjectStore implements ProjectStore {
  constructor(private readonly filePath: string) {}

  async get(): Promise<DemoProject | undefined> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as DemoProject;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async save(project: DemoProject): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(project, null, 2), "utf8");
  }
}

interface MessageInput {
  content: string;
  selectedNodeIds: string[];
}

interface EditRequest {
  instruction: string;
  targetNodeIds: string[];
  mode?: "edit" | "reference";
  bbox?: [number, number, number, number];
}

export class DemoService {
  #loaded = false;

  constructor(
    private readonly store: ProjectStore,
    private readonly provider: DemoProvider,
    private readonly materializeAsset: (url: string) => Promise<string> = async (url) => url,
    private readonly actorUserId = "local-demo-user"
  ) {}

  async appendAgentMessage(
    projectId: string,
    role: AgentMessage["role"],
    content: string,
    selectionSnapshot: string[] = []
  ): Promise<DemoProject> {
    const project = await this.getProject(projectId);
    project.messages.push(createMessage(role, content, selectionSnapshot));
    await this.store.save(project);
    return project;
  }

  async bootstrap(): Promise<DemoProject> {
    const existing = await this.store.get();
    if (existing) {
      let migrated = false;
      if (!existing.generationHistory) {
        existing.generationHistory = [];
        migrated = true;
      }
      if (!existing.canvasOperations) {
        existing.canvasOperations = [];
        migrated = true;
      }
      if (!existing.confirmations) {
        existing.confirmations = [];
        migrated = true;
      }
      if (!existing.auditLog) {
        existing.auditLog = [];
        migrated = true;
      }
      existing.plans.forEach((plan, index) => {
        if (!plan.version) {
          plan.version = index + 1;
          migrated = true;
        }
        if (plan.status === "awaiting_confirmation" && !existing.confirmations.some((grant) => grant.id === plan.id)) {
          existing.confirmations.push(createGrant({
            id: plan.id,
            action: "generate_candidates",
            summary: plan.summary,
            targetNodeIds: plan.directions.map((direction) => direction.id),
            taskCount: 4
          }));
          migrated = true;
        }
      });
      const migratedAssetUrls = new Map<string, string>();
      const migrateAssetUrl = async (assetUrl?: string): Promise<string | undefined> => {
        if (!assetUrl || !/^\/assets\/[^/]+$/.test(assetUrl)) return assetUrl;
        const cached = migratedAssetUrls.get(assetUrl);
        if (cached) return cached;
        const migratedUrl = await this.materializeAsset(assetUrl);
        migratedAssetUrls.set(assetUrl, migratedUrl);
        if (migratedUrl !== assetUrl) migrated = true;
        return migratedUrl;
      };
      for (const node of existing.canvas.nodes) {
        const migratedUrl = await migrateAssetUrl(node.assetUrl);
        if (migratedUrl) node.assetUrl = migratedUrl;
      }
      for (const record of existing.generationHistory) {
        const migratedUrl = await migrateAssetUrl(record.assetUrl);
        if (migratedUrl) record.assetUrl = migratedUrl;
      }
      if (!this.#loaded) {
        const interrupted = existing.canvas.nodes.filter((node) => node.status === "running");
        for (const node of interrupted) node.status = "failed";
        if (interrupted.length > 0) {
          existing.messages.push(createMessage(
            "assistant",
            `服务重启后已恢复项目状态：${interrupted.length} 个未完成任务已标记为失败，可逐项重试。`,
            []
          ));
          existing.canvas.version += 1;
          existing.canvas.updatedAt = new Date().toISOString();
          appendCanvasOperation(existing, "system", "recovery", interrupted.map((node) => node.id));
          migrated = true;
        }
      }
      if (migrated) await this.store.save(existing);
      this.#loaded = true;
      return existing;
    }
    const now = new Date().toISOString();
    const project: DemoProject = {
      id: crypto.randomUUID(),
      name: "我的视觉创作",
      canvas: {
        id: crypto.randomUUID(),
        projectId: "",
        version: 1,
        nodes: [],
        updatedAt: now
      },
      canvasOperations: [],
      messages: [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "你好，我是 Loomoon Design Agent。描述一个视觉创意需求，我会先给出两个方向，确认后再生成图片。",
          selectionSnapshot: [],
          createdAt: now
        }
      ],
      plans: [],
      generationHistory: [],
      confirmations: [],
      auditLog: []
    };
    project.canvas.projectId = project.id;
    await this.store.save(project);
    this.#loaded = true;
    return project;
  }

  async getProject(projectId: string): Promise<DemoProject> {
    const project = await this.bootstrap();
    if (project.id !== projectId) throw new Error("PROJECT_NOT_FOUND");
    return project;
  }

  async renameProject(projectId: string, name: string): Promise<DemoProject> {
    const project = await this.getProject(projectId);
    const normalized = name.trim();
    if (!normalized) throw new Error("PROJECT_NAME_REQUIRED");
    project.name = normalized.slice(0, 80);
    await this.store.save(project);
    return project;
  }

  async saveCanvas(projectId: string, nodes: DemoProject["canvas"]["nodes"], version: number): Promise<DemoProject> {
    const project = await this.getProject(projectId);
    if (version !== project.canvas.version) throw new Error("CANVAS_VERSION_CONFLICT");
    project.canvas.nodes = nodes;
    project.canvas.version += 1;
    project.canvas.updatedAt = new Date().toISOString();
    appendCanvasOperation(project, "user", "replace_snapshot", nodes.map((node) => node.id));
    await this.store.save(project);
    return project;
  }

  async addReferenceImage(projectId: string, dataUrl: string): Promise<DemoProject> {
    const project = await this.getProject(projectId);
    if (project.plans.length === 0 && project.canvas.nodes.filter((node) => node.type === "image").length >= 3) {
      throw new Error("REFERENCE_IMAGE_LIMIT");
    }
    const assetUrl = await this.materializeAsset(dataUrl);
    const imageCount = project.canvas.nodes.filter((node) => node.type === "image").length;
    project.canvas.nodes.push({
      id: crypto.randomUUID(),
      type: "image",
      x: 80 + (imageCount % 3) * 340,
      y: 80 + Math.floor(imageCount / 3) * 340,
      width: 300,
      height: 300,
      assetId: crypto.randomUUID(),
      assetUrl,
      status: "succeeded"
    });
    project.canvas.version += 1;
    project.canvas.updatedAt = new Date().toISOString();
    appendCanvasOperation(project, "user", "asset_added", [project.canvas.nodes.at(-1)!.id]);
    await this.store.save(project);
    return project;
  }

  async addHistoryToCanvas(projectId: string, recordId: string): Promise<DemoProject> {
    const project = await this.getProject(projectId);
    const record = project.generationHistory.find((item) => item.id === recordId);
    if (!record?.assetUrl || record.status !== "succeeded") throw new Error("HISTORY_ASSET_UNAVAILABLE");
    const imageCount = project.canvas.nodes.filter((node) => node.type === "image").length;
    project.canvas.nodes.push({
      id: crypto.randomUUID(),
      type: "image",
      x: 80 + (imageCount % 4) * 340,
      y: 720 + Math.floor(imageCount / 4) * 340,
      width: 300,
      height: 300,
      assetId: crypto.randomUUID(),
      assetUrl: record.assetUrl,
      prompt: record.prompt,
      sourceNodeIds: [...record.sourceNodeIds],
      status: "succeeded"
    });
    project.canvas.version += 1;
    project.canvas.updatedAt = new Date().toISOString();
    appendCanvasOperation(project, "user", "asset_added", [project.canvas.nodes.at(-1)!.id]);
    await this.store.save(project);
    return project;
  }

  async sendMessage(projectId: string, input: MessageInput): Promise<AgentRunResult> {
    const project = await this.getProject(projectId);
    const agentRunId = crypto.randomUUID();
    const content = input.content.trim();
    if (!content) throw new Error("EMPTY_MESSAGE");
    const selectedNodes = input.selectedNodeIds
      .map((id) => project.canvas.nodes.find((node) => node.id === id))
      .filter((node): node is NonNullable<typeof node> => node?.type === "image");
    if (selectedNodes.length > 8) throw new Error("IMAGE_SELECTION_LIMIT");
    const userMessage = createMessage("user", content, input.selectedNodeIds, agentRunId);
    project.messages.push(userMessage);
    project.auditLog.push(auditEvent(this.actorUserId, projectId, agentRunId, "agent_message", input.selectedNodeIds, "started"));
    let intent: CanvasIntent;
    if (project.plans.length === 0 || selectedNodes.length === 0) {
      intent = "create_plan";
    } else {
      const policyIntent = classifyCanvasIntent(content, selectedNodes.length);
      const modelIntent = this.provider.decideImageIntent
        ? await this.provider.decideImageIntent(content, selectedNodes.length)
        : policyIntent;
      intent = policyIntent === "clarify" ? "clarify" : modelIntent;
      project.auditLog.push(auditEvent(
        this.actorUserId,
        projectId,
        agentRunId,
        "classify_image_intent",
        selectedNodes.map((node) => node.id),
        "succeeded",
        intent
      ));
    }

    if (intent === "create_plan") {
      const draft = await this.provider.createPlan(
        content,
        selectedNodes.map((node) => node.assetUrl).filter((url): url is string => Boolean(url))
      );
      const plan = toCreativePlan(content, draft);
      const previousPlan = project.plans.at(-1);
      if (previousPlan?.status === "awaiting_confirmation") {
        const previousGrant = project.confirmations.find((item) => item.id === previousPlan.id);
        if (previousGrant?.status === "pending") previousGrant.status = "expired";
        previousPlan.status = "failed";
        project.canvas.nodes = project.canvas.nodes.filter(
          (node) =>
            node.planId !== previousPlan.id &&
            !previousPlan.directions.some((direction) => direction.id === node.directionId) &&
            !(node.type === "text" && node.text?.startsWith("CREATIVE BRIEF"))
        );
      }
      plan.version = (previousPlan?.version ?? 0) + 1;
      project.plans.push(plan);
      project.confirmations.push(createGrant({
        id: plan.id,
        action: "generate_candidates",
        summary: plan.summary,
        targetNodeIds: plan.directions.map((direction) => direction.id),
        taskCount: 4
      }));
      project.canvas.nodes.push(...layoutCreativePlan(plan, project.canvas.nodes));
      const message = createMessage(
        "assistant",
        `我整理了两个视觉方向：“${plan.directions[0].title}”与“${plan.directions[1].title}”。确认后将生成 4 张候选图。`,
        input.selectedNodeIds,
        agentRunId
      );
      project.messages.push(message);
      project.auditLog.push(auditEvent(this.actorUserId, projectId, agentRunId, "create_creative_plan", plan.directions.map((item) => item.id), "proposed"));
      project.canvas.version += 1;
      project.canvas.updatedAt = new Date().toISOString();
      appendCanvasOperation(
        project,
        "agent",
        "agent_layout",
        project.canvas.nodes.filter((node) => node.planId === plan.id).map((node) => node.id)
      );
      await this.store.save(project);
      return { kind: "plan", message, plan };
    }

    if (intent === "analyze") {
      const analysis = await this.provider.analyzeImages(
        content,
        selectedNodes.map((node) => node.assetUrl).filter((url): url is string => Boolean(url))
      );
      const message = createMessage("assistant", analysis, input.selectedNodeIds, agentRunId);
      project.messages.push(message);
      project.auditLog.push(auditEvent(this.actorUserId, projectId, agentRunId, "analyze_selected_images", input.selectedNodeIds, "succeeded"));
      await this.store.save(project);
      return { kind: "analysis", message };
    }

    if (intent === "clarify") {
      const message = createMessage(
        "assistant",
        `你选中了 ${selectedNodes.length} 张图片。请明确是“全部修改”、只修改指定主图，还是把其余图片作为参考；在范围明确前我不会创建图片任务。`,
        input.selectedNodeIds,
        agentRunId
      );
      project.messages.push(message);
      project.auditLog.push(auditEvent(this.actorUserId, projectId, agentRunId, "clarify_multi_image_scope", input.selectedNodeIds, "succeeded"));
      await this.store.save(project);
      return { kind: "analysis", message };
    }

    return this.proposeImageEdit(projectId, {
      instruction: content,
      targetNodeIds: selectedNodes.map((node) => node.id),
      mode: intent === "reference" ? "reference" : "edit"
    });
  }

  async proposeImageEdit(
    projectId: string,
    input: {
      instruction: string;
      targetNodeIds: string[];
      mode: "edit" | "reference";
    }
  ): Promise<AgentRunResult> {
    const project = await this.getProject(projectId);
    const selectedNodes = input.targetNodeIds
      .map((id) => project.canvas.nodes.find((node) => node.id === id))
      .filter((node): node is NonNullable<typeof node> => node?.type === "image");
    if (selectedNodes.length === 0 || selectedNodes.length !== input.targetNodeIds.length) {
      throw new Error("IMAGE_SELECTION_REQUIRED");
    }
    if (selectedNodes.length > 8) throw new Error("IMAGE_SELECTION_LIMIT");
    const content = input.instruction.trim();
    if (!content) throw new Error("EMPTY_MESSAGE");
    const agentRunId = crypto.randomUUID();
    const isReference = input.mode === "reference";
    const grant = createGrant({
      action: isReference ? "generate_from_references" : "edit_images",
      summary: content,
      targetNodeIds: selectedNodes.map((node) => node.id),
      taskCount: isReference ? 1 : selectedNodes.length
    });
    project.confirmations.push(grant);
    const message = createMessage(
      "assistant",
      isReference
        ? `我会以第 1 张为主图，其余 ${selectedNodes.length - 1} 张作为构图、色彩或材质参考，融合生成 1 张新图；所有参考原图都会保留。`
        : `我将保留原图，为选中的 ${selectedNodes.length} 张图片分别执行修改：“${content}”。确认后会创建 ${selectedNodes.length} 个图片任务。`,
      input.targetNodeIds,
      agentRunId
    );
    project.messages.push(message);
    project.auditLog.push(auditEvent(this.actorUserId, projectId, agentRunId, "edit_images", grant.targetNodeIds, "proposed"));
    await this.store.save(project);
    return {
      kind: "confirmation",
      message,
      confirmation: {
        id: grant.id,
        action: grant.action,
        summary: content,
        targetNodeIds: selectedNodes.map((node) => node.id),
        taskCount: grant.taskCount
      }
    };
  }

  async confirm(
    projectId: string,
    confirmationId: string,
    directionId?: string
  ): Promise<DemoProject> {
    const project = await this.getProject(projectId);
    const grant = project.confirmations.find((item) => item.id === confirmationId);
    if (!grant) throw new Error("CONFIRMATION_NOT_FOUND");
    if (grant.status === "consumed") return project;
    if (grant.status === "expired" || Date.parse(grant.expiresAt) <= Date.now()) {
      grant.status = "expired";
      await this.store.save(project);
      throw new Error("CONFIRMATION_EXPIRED");
    }
    const plan = project.plans.find((item) => item.id === confirmationId);
    if (directionId && (!plan || !plan.directions.some((item) => item.id === directionId))) {
      throw new Error("PLAN_DIRECTION_NOT_FOUND");
    }
    grant.status = "consumed";
    grant.consumedAt = new Date().toISOString();
    project.auditLog.push(auditEvent(
      this.actorUserId,
      projectId,
      grant.id,
      grant.action,
      grant.targetNodeIds,
      "confirmed"
    ));
    await this.store.save(project);
    if (plan) return this.#confirmPlan(project, plan, directionId);
    return this.#confirmEdit(project, {
      instruction: grant.summary,
      targetNodeIds: grant.targetNodeIds,
      mode: grant.action === "generate_from_references" ? "reference" : "edit",
      ...(grant.bbox ? { bbox: grant.bbox } : {})
    });
  }

  async retryGeneration(projectId: string, nodeId: string): Promise<DemoProject> {
    const project = await this.getProject(projectId);
    const node = project.canvas.nodes.find((item) => item.id === nodeId);
    if (!node || node.status !== "failed" || !node.prompt) throw new Error("GENERATION_NOT_RETRYABLE");
    const references = (node.sourceNodeIds ?? [])
      .map((id) => project.canvas.nodes.find((item) => item.id === id)?.assetUrl)
      .filter((url): url is string => Boolean(url));
    node.status = "running";
    delete node.errorCode;
    try {
      const generated = normalizeGeneratedImage(
        await this.provider.generateImage(node.prompt, references, node.editBbox)
      );
      node.type = "image";
      node.assetId = crypto.randomUUID();
      node.assetUrl = await this.materializeAsset(generated.url);
      if (generated.requestId) node.providerRequestId = generated.requestId;
      if (generated.model) node.resolvedModel = generated.model;
      node.status = "succeeded";
    } catch (error) {
      node.status = "failed";
      node.errorCode = providerErrorCode(error);
    }
    const previous = project.generationHistory.findLast((record) => record.nodeId === node.id);
    project.generationHistory.push(recordForNode(node, node.editBbox ? "region_edit" : node.sourceNodeIds?.length ? "image_edit" : "text_to_image", previous?.id));
    project.canvas.version += 1;
    project.canvas.updatedAt = new Date().toISOString();
    appendCanvasOperation(project, "agent", "generation_result", [node.id]);
    await this.store.save(project);
    return project;
  }

  async proposeRegionEdit(
    projectId: string,
    input: {
      nodeId: string;
      instruction: string;
      bbox: [number, number, number, number];
    }
  ): Promise<AgentRunResult> {
    const project = await this.getProject(projectId);
    const source = project.canvas.nodes.find((node) => node.id === input.nodeId && node.type === "image");
    if (!source) throw new Error("IMAGE_SELECTION_REQUIRED");
    const [x1, y1, x2, y2] = input.bbox;
    if (x2 <= x1 || y2 <= y1 || x1 < 0 || y1 < 0) throw new Error("EMPTY_REGION");
    const agentRunId = crypto.randomUUID();
    const grant = createGrant({
      action: "edit_region",
      summary: input.instruction,
      targetNodeIds: [source.id],
      taskCount: 1,
      bbox: input.bbox
    });
    project.confirmations.push(grant);
    const message = createMessage(
      "assistant",
      `我将修改框选区域 [${input.bbox.join(", ")}]：“${input.instruction}”。Wan 2.7 按边界框编辑，不能承诺框内未涂抹区域完全不变。`,
      [source.id],
      agentRunId
    );
    project.messages.push(message);
    project.auditLog.push(auditEvent(this.actorUserId, projectId, agentRunId, "edit_region", [source.id], "proposed"));
    await this.store.save(project);
    return {
      kind: "confirmation",
      message,
      confirmation: {
        id: grant.id,
        action: "edit_region",
        summary: input.instruction,
        targetNodeIds: [source.id],
        taskCount: 1,
        bbox: input.bbox
      }
    };
  }

  async #confirmPlan(
    project: DemoProject,
    plan: CreativePlan,
    directionId?: string
  ): Promise<DemoProject> {
    if (plan.status !== "awaiting_confirmation") return project;
    plan.status = "confirmed";
    plan.confirmedBy = this.actorUserId;
    plan.confirmedAt = new Date().toISOString();
    let placeholders = project.canvas.nodes.filter(
      (node) => node.type === "generation-placeholder" && plan.directions.some((direction) => direction.id === node.directionId)
    );
    if (directionId) {
      placeholders.forEach((placeholder) => {
        placeholder.directionId = directionId;
      });
    }
    let failedCount = 0;

    for (let index = 0; index < placeholders.length; index += 2) {
      const chunk = placeholders.slice(index, index + 2);
      const chunkIds = chunk.map((node) => node.id);
      chunk.forEach((placeholder) => {
        placeholder.status = "running";
      });
      project.canvas.updatedAt = new Date().toISOString();
      project = await this.#persistProgress(project);
      const activeChunk = chunkIds
        .map((id) => project.canvas.nodes.find((node) => node.id === id))
        .filter((node): node is NonNullable<typeof node> => Boolean(node));
      await Promise.all(
        activeChunk.map(async (placeholder) => {
          const direction = plan.directions.find((item) => item.id === placeholder.directionId)!;
          try {
            const generated = normalizeGeneratedImage(await this.provider.generateImage(direction.prompt, []));
            placeholder.type = "image";
            placeholder.assetId = crypto.randomUUID();
            placeholder.assetUrl = await this.materializeAsset(generated.url);
            if (generated.requestId) placeholder.providerRequestId = generated.requestId;
            if (generated.model) placeholder.resolvedModel = generated.model;
            placeholder.status = "succeeded";
          } catch (error) {
            failedCount += 1;
            placeholder.status = "failed";
            placeholder.errorCode = providerErrorCode(error);
          }
        })
      );
    }
    placeholders = project.canvas.nodes.filter(
      (node) => node.type !== "text" && plan.directions.some((direction) => direction.id === node.directionId)
    );
    project.generationHistory.push(
      ...placeholders.map((node) => recordForNode(node, "text_to_image"))
    );
    const activePlan = project.plans.find((item) => item.id === plan.id) ?? plan;
    activePlan.status = failedCount > 0 ? "failed" : "completed";
    project.auditLog.push(auditEvent(
      this.actorUserId,
      project.id,
      plan.id,
      "generate_images",
      placeholders.map((node) => node.id),
      failedCount > 0 ? "failed" : "succeeded",
      failedCount > 0 ? `${failedCount} task(s) failed` : undefined
    ));
    project.canvas.version += 1;
    project.canvas.updatedAt = new Date().toISOString();
    appendCanvasOperation(project, "agent", "generation_result", placeholders.map((node) => node.id));
    project.messages.push(
      createMessage(
        "assistant",
        failedCount > 0
          ? `${4 - failedCount} 张候选图已生成，${failedCount} 张失败；成功结果已保留。`
          : "四张候选图已生成并按两个方向放入画布。你可以圈选图片继续比较或修改。",
        []
      )
    );
    return this.#persistGenerationResult(project);
  }

  async #confirmEdit(project: DemoProject, edit: EditRequest): Promise<DemoProject> {
    const sources = edit.targetNodeIds
      .map((id) => project.canvas.nodes.find((node) => node.id === id))
      .filter((node): node is NonNullable<typeof node> => node?.type === "image");
    let derived = edit.mode === "reference" && sources[0]
      ? [{
          ...placeDerivedImages([sources[0]])[0]!,
          sourceNodeIds: sources.map((source) => source.id)
        }]
      : placeDerivedImages(sources);
    derived.forEach((node) => {
      node.prompt = edit.instruction;
      if (edit.bbox) node.editBbox = edit.bbox;
    });
    project.canvas.nodes.push(...derived);
    project.canvas.updatedAt = new Date().toISOString();
    await this.store.save(project);
    for (let index = 0; index < derived.length; index += 2) {
      const chunk = derived.slice(index, index + 2);
      const chunkIds = chunk.map((node) => node.id);
      chunk.forEach((node) => {
        node.status = "running";
        delete node.errorCode;
      });
      project = await this.#persistProgress(project);
      const activeChunk = chunkIds
        .map((id) => project.canvas.nodes.find((node) => node.id === id))
        .filter((node): node is NonNullable<typeof node> => Boolean(node));
      await Promise.all(
        activeChunk.map(async (node) => {
          const source = sources.find((item) => item.id === node.sourceNodeIds?.[0])!;
          const references = edit.mode === "reference"
            ? sources.map((item) => item.assetUrl).filter((url): url is string => Boolean(url))
            : source.assetUrl ? [source.assetUrl] : [];
          try {
            const generated = normalizeGeneratedImage(await this.provider.generateImage(
              edit.instruction,
              references,
              edit.bbox
            ));
            node.type = "image";
            node.assetId = crypto.randomUUID();
            node.assetUrl = await this.materializeAsset(generated.url);
            if (generated.requestId) node.providerRequestId = generated.requestId;
            if (generated.model) node.resolvedModel = generated.model;
            node.status = "succeeded";
          } catch (error) {
            node.status = "failed";
            node.errorCode = providerErrorCode(error);
          }
        })
      );
    }
    const derivedIds = new Set(derived.map((node) => node.id));
    derived = project.canvas.nodes.filter((node) => derivedIds.has(node.id));
    project.generationHistory.push(
      ...derived.map((node) => recordForNode(node, edit.bbox ? "region_edit" : "image_edit"))
    );
    const failedCount = derived.filter((node) => node.status === "failed").length;
    project.auditLog.push(auditEvent(
      this.actorUserId,
      project.id,
      crypto.randomUUID(),
      edit.bbox ? "inpaint_image" : edit.mode === "reference" ? "generate_from_references" : derived.length > 1 ? "edit_multiple_images" : "edit_single_image",
      derived.map((node) => node.id),
      failedCount > 0 ? "failed" : "succeeded",
      failedCount > 0 ? `${failedCount} task(s) failed` : undefined
    ));
    project.canvas.version += 1;
    project.canvas.updatedAt = new Date().toISOString();
    appendCanvasOperation(project, "agent", "generation_result", derived.map((node) => node.id));
    project.messages.push(createMessage("assistant", `已完成 ${derived.length} 张图片修改，原图均已保留。`, edit.targetNodeIds));
    return this.#persistGenerationResult(project);
  }

  async #persistGenerationResult(project: DemoProject): Promise<DemoProject> {
    const latest = await this.store.get();
    if (!latest || latest.canvas.version < project.canvas.version) {
      await this.store.save(project);
      return project;
    }
    latest.generationHistory ??= [];
    latest.canvasOperations ??= [];
    latest.confirmations ??= [];
    latest.auditLog ??= [];
    const generatedNodes = new Map(project.canvas.nodes.map((node) => [node.id, node]));
    latest.canvas.nodes = latest.canvas.nodes.map((current) => {
      const generated = generatedNodes.get(current.id);
      if (!generated) return current;
      return mergeGeneratedNode(current, generated);
    });
    latest.messages = mergeById(latest.messages, project.messages);
    latest.plans = mergeById(latest.plans, project.plans);
    latest.generationHistory = mergeById(latest.generationHistory, project.generationHistory);
    latest.confirmations = mergeById(latest.confirmations, project.confirmations);
    latest.auditLog = mergeById(latest.auditLog, project.auditLog);
    latest.canvasOperations = mergeById(latest.canvasOperations, project.canvasOperations);
    latest.canvas.version += 1;
    latest.canvas.updatedAt = new Date().toISOString();
    await this.store.save(latest);
    return latest;
  }

  async #persistProgress(project: DemoProject): Promise<DemoProject> {
    const latest = await this.store.get();
    if (!latest || latest.canvas.version <= project.canvas.version) {
      await this.store.save(project);
      return project;
    }
    latest.generationHistory ??= [];
    latest.canvasOperations ??= [];
    latest.confirmations ??= [];
    latest.auditLog ??= [];
    const progressNodes = new Map(project.canvas.nodes.map((node) => [node.id, node]));
    latest.canvas.nodes = latest.canvas.nodes.map((current) => {
      const progress = progressNodes.get(current.id);
      return progress ? mergeGeneratedNode(current, progress) : current;
    });
    latest.messages = mergeById(latest.messages, project.messages);
    latest.plans = mergeById(latest.plans, project.plans);
    latest.confirmations = mergeById(latest.confirmations, project.confirmations);
    latest.auditLog = mergeById(latest.auditLog, project.auditLog);
    latest.canvasOperations = mergeById(latest.canvasOperations, project.canvasOperations);
    await this.store.save(latest);
    return latest;
  }
}

function createMessage(
  role: AgentMessage["role"],
  content: string,
  selectionSnapshot: string[],
  agentRunId?: string
): AgentMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    selectionSnapshot: [...selectionSnapshot],
    ...(agentRunId ? { agentRunId } : {}),
    createdAt: new Date().toISOString()
  };
}

function toCreativePlan(brief: string, draft: PlanDraft): CreativePlan {
  if (draft.directions.length !== 2) throw new Error("PLAN_DIRECTION_COUNT_INVALID");
  return {
    id: crypto.randomUUID(),
    brief,
    summary: draft.summary,
    audience: draft.audience,
    directions: draft.directions.map((direction) => ({
      ...direction,
      id: crypto.randomUUID()
    })) as CreativePlan["directions"],
    status: "awaiting_confirmation",
    version: 1,
    ...(draft.providerRequestId ? { providerRequestId: draft.providerRequestId } : {}),
    ...(draft.resolvedModel ? { resolvedModel: draft.resolvedModel } : {}),
    createdAt: new Date().toISOString()
  };
}

function createGrant(input: {
  id?: string;
  action: ConfirmationGrant["action"];
  summary: string;
  targetNodeIds: string[];
  taskCount: number;
  bbox?: [number, number, number, number];
}): ConfirmationGrant {
  const id = input.id ?? crypto.randomUUID();
  const normalized = JSON.stringify([
    input.action,
    input.summary,
    input.targetNodeIds,
    input.taskCount,
    input.bbox ?? null
  ]);
  return {
    id,
    action: input.action,
    summary: input.summary,
    targetNodeIds: [...input.targetNodeIds],
    taskCount: input.taskCount,
    inputHash: createHash("sha256").update(normalized).digest("hex"),
    status: "pending",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ...(input.bbox ? { bbox: input.bbox } : {})
  };
}

function auditEvent(
  userId: string,
  projectId: string,
  agentRunId: string,
  action: string,
  targetIds: string[],
  status: AuditEvent["status"],
  detail?: string
): AuditEvent {
  return {
    id: crypto.randomUUID(),
    userId,
    projectId,
    agentRunId,
    action,
    targetIds: [...targetIds],
    status,
    createdAt: new Date().toISOString(),
    ...(detail ? { detail } : {})
  };
}

function recordForNode(
  node: DemoProject["canvas"]["nodes"][number],
  type: GenerationRecord["type"],
  retryOfId?: string
): GenerationRecord {
  return {
    id: crypto.randomUUID(),
    nodeId: node.id,
    type,
    status: node.status === "succeeded" ? "succeeded" : "failed",
    prompt: node.prompt ?? "",
    sourceNodeIds: [...(node.sourceNodeIds ?? [])],
    createdAt: new Date().toISOString(),
    ...(node.assetUrl ? { assetUrl: node.assetUrl } : {}),
    ...(retryOfId ? { retryOfId } : {}),
    ...(node.errorCode ? { errorCode: node.errorCode } : {}),
    ...(node.providerRequestId ? { providerRequestId: node.providerRequestId } : {}),
    ...(node.resolvedModel ? { resolvedModel: node.resolvedModel } : {})
  };
}

function normalizeGeneratedImage(
  value: string | { url: string; requestId?: string; model?: string }
): { url: string; requestId?: string; model?: string } {
  return typeof value === "string" ? { url: value } : value;
}

function mergeGeneratedNode(
  current: DemoProject["canvas"]["nodes"][number],
  generated: DemoProject["canvas"]["nodes"][number]
): DemoProject["canvas"]["nodes"][number] {
  return {
    ...current,
    type: generated.type,
    ...(generated.status ? { status: generated.status } : {}),
    ...(generated.prompt ? { prompt: generated.prompt } : {}),
    ...(generated.assetId ? { assetId: generated.assetId } : {}),
    ...(generated.assetUrl ? { assetUrl: generated.assetUrl } : {}),
    ...(generated.sourceNodeIds ? { sourceNodeIds: [...generated.sourceNodeIds] } : {}),
    ...(generated.editBbox ? { editBbox: generated.editBbox } : {}),
    ...(generated.errorCode ? { errorCode: generated.errorCode } : {}),
    ...(generated.providerRequestId ? { providerRequestId: generated.providerRequestId } : {}),
    ...(generated.resolvedModel ? { resolvedModel: generated.resolvedModel } : {})
  };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const values = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) values.set(item.id, item);
  return [...values.values()];
}

function appendCanvasOperation(
  project: DemoProject,
  actor: DemoProject["canvasOperations"][number]["actor"],
  type: DemoProject["canvasOperations"][number]["type"],
  nodeIds: string[]
): void {
  project.canvasOperations.push({
    id: crypto.randomUUID(),
    actor,
    type,
    baseVersion: Math.max(0, project.canvas.version - 1),
    resultVersion: project.canvas.version,
    idempotencyKey: crypto.randomUUID(),
    nodeIds: [...nodeIds],
    createdAt: new Date().toISOString()
  });
}

function providerErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message.split(":")[0] ?? "" : "";
  const allowed = new Set([
    "BAILIAN_AUTH_ERROR",
    "BAILIAN_RATE_LIMITED",
    "BAILIAN_TIMEOUT",
    "BAILIAN_INVALID_RESPONSE",
    "BAILIAN_UNAVAILABLE"
  ]);
  return allowed.has(message) ? message : "BAILIAN_UNAVAILABLE";
}
