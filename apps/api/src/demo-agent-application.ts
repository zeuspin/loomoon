import { createHash } from "node:crypto";
import type {
  CanvasNode,
  PendingAgentAction
} from "@loomoon/contracts";
import type { AgentRepository } from "./agent-repository.js";
import type { AgentToolApplication } from "./agent-tools.js";
import type { DemoService } from "./demo-service.js";

export class DemoAgentToolApplication implements AgentToolApplication {
  constructor(private readonly options: {
    service: DemoService;
    repository: AgentRepository;
    userId: string;
    projectId: string;
    runId: string;
  }) {}

  async getCanvasContext(input: Parameters<AgentToolApplication["getCanvasContext"]>[0]) {
    this.#assertScope(input);
    const project = await this.options.service.getProject(input.projectId);
    const selected = input.selectionSnapshot
      .map((id) => project.canvas.nodes.find((node) => node.id === id))
      .filter((node): node is CanvasNode => Boolean(node));
    return {
      canvasVersion: project.canvas.version,
      nodeCount: project.canvas.nodes.length,
      imageCount: project.canvas.nodes.filter((node) => node.type === "image").length,
      activePlanId: project.plans.at(-1)?.id,
      selectedNodes: selected.map((node) => ({
        id: node.id,
        type: node.type,
        width: node.width,
        height: node.height,
        status: node.status
      }))
    };
  }

  async createCreativePlan(input: Parameters<AgentToolApplication["createCreativePlan"]>[0]) {
    this.#assertScope(input);
    const result = await this.options.service.sendMessage(input.projectId, {
      content: input.brief,
      selectedNodeIds: []
    });
    if (result.kind !== "plan" || !result.plan) throw new Error("AGENT_PLAN_FAILED");
    return {
      planId: result.plan.id,
      version: result.plan.version,
      summary: result.plan.summary,
      directions: result.plan.directions
    };
  }

  async reviseCreativePlan(input: Parameters<AgentToolApplication["reviseCreativePlan"]>[0]) {
    this.#assertScope(input);
    const project = await this.options.service.getProject(input.projectId);
    if (!project.plans.some((plan) => plan.id === input.planId)) {
      throw new Error("AGENT_PLAN_NOT_FOUND");
    }
    return this.createCreativePlan({
      ...input,
      brief: input.instruction
    });
  }

  async analyzeSelectedImages(input: Parameters<AgentToolApplication["analyzeSelectedImages"]>[0]) {
    this.#assertScope(input);
    const result = await this.options.service.sendMessage(input.projectId, {
      content: input.instruction,
      selectedNodeIds: input.nodeIds
    });
    return { analysis: result.message.content };
  }

  async createCanvasNodes(input: Parameters<AgentToolApplication["createCanvasNodes"]>[0]) {
    this.#assertScope(input);
    const project = await this.options.service.getProject(input.projectId);
    const created = input.nodes.map((node, index) => sanitizeNode(node, index));
    const updated = await this.options.service.saveCanvas(
      input.projectId,
      [...project.canvas.nodes, ...created],
      project.canvas.version
    );
    return {
      canvasVersion: updated.canvas.version,
      nodeIds: created.map((node) => node.id)
    };
  }

  async arrangeCanvasNodes(input: Parameters<AgentToolApplication["arrangeCanvasNodes"]>[0]) {
    this.#assertScope(input);
    const project = await this.options.service.getProject(input.projectId);
    const requested = new Set(input.nodeIds);
    if (requested.size !== input.nodeIds.length ||
        input.nodeIds.some((id) => !project.canvas.nodes.some((node) => node.id === id))) {
      throw new Error("CANVAS_NODE_NOT_FOUND");
    }
    const nodes = structuredClone(project.canvas.nodes);
    nodes.filter((node) => requested.has(node.id)).forEach((node, index) => {
      const columns = input.layout === "directions" ? 2 : 4;
      node.x = 120 + (index % columns) * 340;
      node.y = 180 + Math.floor(index / columns) * 340;
    });
    const updated = await this.options.service.saveCanvas(
      input.projectId,
      nodes,
      project.canvas.version
    );
    return { canvasVersion: updated.canvas.version, nodeIds: input.nodeIds };
  }

  async proposePaidAction(input: Parameters<AgentToolApplication["proposePaidAction"]>[0]) {
    this.#assertScope(input);
    let confirmation:
      | {
          id: string;
          targetNodeIds: string[];
          taskCount: number;
        }
      | undefined;

    if (input.toolName === "generate_images") {
      const project = await this.options.service.getProject(input.projectId);
      const planId = String(input.input.planId ?? "");
      const plan = project.plans.find((item) => item.id === planId);
      const grant = project.confirmations.find((item) => item.id === planId && item.status === "pending");
      if (!plan || !grant || input.taskCount !== 4) throw new Error("CONFIRMATION_NOT_FOUND");
      confirmation = {
        id: grant.id,
        targetNodeIds: [...grant.targetNodeIds],
        taskCount: grant.taskCount
      };
    } else if (input.toolName === "edit_image_region") {
      const bbox = input.input.bbox;
      if (!Array.isArray(bbox) || bbox.length !== 4) throw new Error("EMPTY_REGION");
      const proposed = await this.options.service.proposeRegionEdit(input.projectId, {
        nodeId: String(input.input.nodeId ?? input.targetNodeIds[0] ?? ""),
        instruction: String(input.input.instruction ?? ""),
        bbox: bbox.map(Number) as [number, number, number, number]
      });
      confirmation = proposed.confirmation;
    } else {
      const proposed = await this.options.service.proposeImageEdit(input.projectId, {
        instruction: String(input.input.instruction ?? ""),
        targetNodeIds: input.targetNodeIds,
        mode: input.toolName === "generate_from_references" ? "reference" : "edit"
      });
      confirmation = proposed.confirmation;
    }
    if (!confirmation) throw new Error("CONFIRMATION_NOT_FOUND");
    const project = await this.options.service.getProject(input.projectId);
    const grant = project.confirmations.find((item) => item.id === confirmation.id);
    if (!grant) throw new Error("CONFIRMATION_NOT_FOUND");
    const now = new Date().toISOString();
    const action: PendingAgentAction = {
      id: confirmation.id,
      runId: input.runId,
      toolCallId: input.toolCallId,
      userId: input.userId,
      projectId: input.projectId,
      toolName: input.toolName,
      input: structuredClone(input.input),
      inputHash: inputHash(input.input),
      targetNodeIds: [...confirmation.targetNodeIds],
      taskCount: confirmation.taskCount,
      status: "pending",
      expiresAt: grant.expiresAt,
      createdAt: now
    };
    await this.options.repository.savePendingAction(action);
    return {
      confirmationRequired: true,
      pendingActionId: action.id,
      toolCallId: action.toolCallId,
      toolName: action.toolName,
      targetNodeIds: action.targetNodeIds,
      taskCount: action.taskCount,
      expiresAt: action.expiresAt
    };
  }

  async getGenerationStatus(input: Parameters<AgentToolApplication["getGenerationStatus"]>[0]) {
    this.#assertScope(input);
    const project = await this.options.service.getProject(input.projectId);
    const records = input.taskIds.map((id) => {
      const node = project.canvas.nodes.find((item) => item.id === id);
      const record = project.generationHistory.findLast((item) => item.nodeId === id);
      if (!node && !record) throw new Error("GENERATION_TASK_NOT_FOUND");
      return {
        id,
        status: node?.status ?? record?.status,
        errorCode: node?.errorCode ?? record?.errorCode,
        providerRequestId: node?.providerRequestId ?? record?.providerRequestId,
        resolvedModel: node?.resolvedModel ?? record?.resolvedModel
      };
    });
    return { tasks: records };
  }

  #assertScope(input: { userId: string; projectId: string; runId: string }): void {
    if (input.userId !== this.options.userId ||
        input.projectId !== this.options.projectId ||
        input.runId !== this.options.runId) {
      throw new Error("AGENT_SCOPE_VIOLATION");
    }
  }
}

function sanitizeNode(input: Record<string, unknown>, index: number): CanvasNode {
  const type = input.type;
  if (type !== "text" && type !== "artboard" && type !== "generation-placeholder") {
    throw new Error("CANVAS_NODE_TYPE_NOT_ALLOWED");
  }
  return {
    id: crypto.randomUUID(),
    type,
    x: numberWithin(input.x, 80 + index * 40, -100_000, 100_000),
    y: numberWithin(input.y, 80 + index * 40, -100_000, 100_000),
    width: numberWithin(input.width, 320, 16, 8_192),
    height: numberWithin(input.height, 180, 16, 8_192),
    ...(type === "text" ? { text: String(input.text ?? "").slice(0, 4_000) } : {}),
    ...(type === "generation-placeholder"
      ? { prompt: String(input.prompt ?? "").slice(0, 4_000), status: "queued" as const }
      : {})
  };
}

function numberWithin(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function inputHash(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
