import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type TSchema } from "typebox";

export const AGENT_TOOL_NAMES = [
  "get_canvas_context",
  "create_creative_plan",
  "revise_creative_plan",
  "analyze_selected_images",
  "create_canvas_nodes",
  "arrange_canvas_nodes",
  "generate_images",
  "edit_single_image",
  "edit_multiple_images",
  "generate_from_references",
  "edit_image_region",
  "get_generation_status"
] as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

type ScopedInput = {
  userId: string;
  projectId: string;
  runId: string;
};

export interface AgentToolApplication {
  getCanvasContext(input: ScopedInput & {
    selectionSnapshot: string[];
  }): Promise<Record<string, unknown>>;
  createCreativePlan(input: ScopedInput & {
    brief: string;
  }): Promise<Record<string, unknown>>;
  reviseCreativePlan(input: ScopedInput & {
    planId: string;
    instruction: string;
  }): Promise<Record<string, unknown>>;
  analyzeSelectedImages(input: ScopedInput & {
    instruction: string;
    nodeIds: string[];
  }): Promise<Record<string, unknown>>;
  createCanvasNodes(input: ScopedInput & {
    nodes: Array<Record<string, unknown>>;
  }): Promise<Record<string, unknown>>;
  arrangeCanvasNodes(input: ScopedInput & {
    nodeIds: string[];
    layout: "grid" | "directions" | "near_sources";
  }): Promise<Record<string, unknown>>;
  proposePaidAction(input: ScopedInput & {
    toolCallId: string;
    toolName: Extract<
      AgentToolName,
      | "generate_images"
      | "edit_single_image"
      | "edit_multiple_images"
      | "generate_from_references"
      | "edit_image_region"
    >;
    input: Record<string, unknown>;
    targetNodeIds: string[];
    taskCount: number;
  }): Promise<Record<string, unknown>>;
  getGenerationStatus(input: ScopedInput & {
    taskIds: string[];
  }): Promise<Record<string, unknown>>;
}

export function createAgentTools(options: {
  userId: string;
  projectId: string;
  runId: string;
  selectionSnapshot: string[];
  application: AgentToolApplication;
}): AgentTool[] {
  const scope: ScopedInput = {
    userId: options.userId,
    projectId: options.projectId,
    runId: options.runId
  };
  const selected = [...options.selectionSnapshot];
  if (selected.length > 8) throw new Error("IMAGE_SELECTION_LIMIT");

  const contextSchema = Type.Object({});
  const createPlanSchema = Type.Object({
    brief: Type.String({ minLength: 1, maxLength: 4_000 })
  });
  const revisePlanSchema = Type.Object({
    planId: Type.String({ minLength: 1, maxLength: 100 }),
    instruction: Type.String({ minLength: 1, maxLength: 4_000 })
  });
  const analyzeSchema = Type.Object({
    instruction: Type.String({ minLength: 1, maxLength: 4_000 })
  });
  const createNodesSchema = Type.Object({
    nodes: Type.Array(Type.Record(Type.String(), Type.Unknown()), { maxItems: 20 })
  });
  const arrangeSchema = Type.Object({
    nodeIds: Type.Array(Type.String({ minLength: 1, maxLength: 100 }), {
      minItems: 1,
      maxItems: 20
    }),
    layout: Type.Union([
      Type.Literal("grid"),
      Type.Literal("directions"),
      Type.Literal("near_sources")
    ])
  });
  const generateSchema = Type.Object({
    planId: Type.String({ minLength: 1, maxLength: 100 }),
    count: Type.Integer({ minimum: 1, maximum: 4 })
  });
  const editSchema = Type.Object({
    instruction: Type.String({ minLength: 1, maxLength: 4_000 })
  });
  const regionSchema = Type.Object({
    nodeId: Type.String({ minLength: 1, maxLength: 100 }),
    instruction: Type.String({ minLength: 1, maxLength: 4_000 }),
    bbox: Type.Tuple([
      Type.Number({ minimum: 0 }),
      Type.Number({ minimum: 0 }),
      Type.Number({ exclusiveMinimum: 0 }),
      Type.Number({ exclusiveMinimum: 0 })
    ])
  });
  const statusSchema = Type.Object({
    taskIds: Type.Array(Type.String({ minLength: 1, maxLength: 100 }), {
      minItems: 1,
      maxItems: 20
    })
  });

  return [
    defineTool({
      name: "get_canvas_context",
      label: "读取画布上下文",
      description: "读取当前项目的有限画布摘要和提交消息时的选区快照。",
      parameters: contextSchema,
      executionMode: "parallel",
      execute: async () => result(await options.application.getCanvasContext({
        ...scope,
        selectionSnapshot: selected
      }))
    }),
    defineTool({
      name: "create_creative_plan",
      label: "创建创意计划",
      description: "创建包含两个视觉方向的结构化创意计划。",
      parameters: createPlanSchema,
      executionMode: "sequential",
      execute: async (_id, params) => result(
        await options.application.createCreativePlan({ ...scope, brief: params.brief })
      )
    }),
    defineTool({
      name: "revise_creative_plan",
      label: "调整创意计划",
      description: "根据用户反馈创建计划的新版本，不生成图片。",
      parameters: revisePlanSchema,
      executionMode: "sequential",
      execute: async (_id, params) => result(
        await options.application.reviseCreativePlan({ ...scope, ...params })
      )
    }),
    defineTool({
      name: "analyze_selected_images",
      label: "分析选中图片",
      description: "分析提交消息时选中的图片，不生成或修改图片。",
      parameters: analyzeSchema,
      executionMode: "parallel",
      execute: async (_id, params) => result(
        await options.application.analyzeSelectedImages({
          ...scope,
          instruction: params.instruction,
          nodeIds: selected
        })
      )
    }),
    defineTool({
      name: "create_canvas_nodes",
      label: "创建画布节点",
      description: "创建受限的文字、画板或占位节点。",
      parameters: createNodesSchema,
      executionMode: "sequential",
      execute: async (_id, params) => result(
        await options.application.createCanvasNodes({ ...scope, nodes: params.nodes })
      )
    }),
    defineTool({
      name: "arrange_canvas_nodes",
      label: "排列画布节点",
      description: "用受控布局方式排列项目内节点。",
      parameters: arrangeSchema,
      executionMode: "sequential",
      execute: async (_id, params) => result(
        await options.application.arrangeCanvasNodes({ ...scope, ...params })
      )
    }),
    paidTool(
      "generate_images",
      "生成候选图片",
      "为已确认计划创建最多四个图片任务。",
      generateSchema,
      options,
      (params) => ({ targetNodeIds: [], taskCount: params.count, input: params })
    ),
    paidTool(
      "edit_single_image",
      "修改单张图片",
      "修改选区中的一张图片并保留原图。",
      editSchema,
      options,
      (params) => ({
        targetNodeIds: selected.slice(0, 1),
        taskCount: 1,
        input: params
      })
    ),
    paidTool(
      "edit_multiple_images",
      "批量修改图片",
      "对选区中的每张图片分别创建修改任务。",
      editSchema,
      options,
      (params) => ({
        targetNodeIds: selected,
        taskCount: selected.length,
        input: params
      })
    ),
    paidTool(
      "generate_from_references",
      "参考图生成",
      "把选中的图片作为参考生成一张新图片。",
      editSchema,
      options,
      (params) => ({
        targetNodeIds: selected,
        taskCount: 1,
        input: params
      })
    ),
    paidTool(
      "edit_image_region",
      "区域修改",
      "修改项目内一张图片的指定原图像素区域。",
      regionSchema,
      options,
      (params) => ({
        targetNodeIds: [params.nodeId],
        taskCount: 1,
        input: params
      })
    ),
    defineTool({
      name: "get_generation_status",
      label: "查询生成状态",
      description: "查询当前项目内图片任务的状态。",
      parameters: statusSchema,
      executionMode: "parallel",
      execute: async (_id, params) => result(
        await options.application.getGenerationStatus({ ...scope, taskIds: params.taskIds })
      )
    })
  ];
}

function paidTool<T extends TSchema>(
  name: Extract<
    AgentToolName,
    | "generate_images"
    | "edit_single_image"
    | "edit_multiple_images"
    | "generate_from_references"
    | "edit_image_region"
  >,
  label: string,
  description: string,
  parameters: T,
  options: Parameters<typeof createAgentTools>[0],
  normalize: (params: import("typebox").Static<T>) => {
    input: Record<string, unknown>;
    targetNodeIds: string[];
    taskCount: number;
  }
): AgentTool<T> {
  return defineTool({
    name,
    label,
    description,
    parameters,
    executionMode: "sequential",
    execute: async (toolCallId, params) => {
      const normalized = normalize(params);
      if (normalized.taskCount < 1 || normalized.taskCount > 4) {
        throw new Error("PAID_TASK_LIMIT");
      }
      const details = await options.application.proposePaidAction({
        userId: options.userId,
        projectId: options.projectId,
        runId: options.runId,
        toolCallId,
        toolName: name,
        ...normalized
      });
      return {
        ...result(details),
        terminate: true
      };
    }
  });
}

function defineTool<T extends TSchema>(tool: AgentTool<T>): AgentTool<T> {
  return tool;
}

function result(details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(details) }],
    details
  };
}
