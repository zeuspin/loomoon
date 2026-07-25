import type { DemoProject, PersistentAgentRun } from "@loomoon/contracts";
import type { LoomoonAgentEntry } from "./model.js";

export type AgentActivity = {
  title: string;
  detail: string;
  tone: "working" | "waiting" | "generating" | "error";
};

export function describeAgentActivity(input: {
  project: DemoProject;
  entries: LoomoonAgentEntry[];
  isRunning: boolean;
  run?: PersistentAgentRun;
  busyLabel?: string;
}): AgentActivity | undefined {
  const pendingEntry = input.entries.find((entry) =>
    entry.kind === "plan" || entry.kind === "confirmation"
  );
  if (pendingEntry?.kind === "plan") {
    return {
      title: "等待确认创意方向",
      detail: "请选择一个方向，或直接让两个方向各生成 2 张候选图。",
      tone: "waiting",
    };
  }
  if (pendingEntry?.kind === "confirmation") {
    return {
      title: "等待确认图片操作",
      detail: `${pendingEntry.confirmation.taskCount} 个图片任务待确认，确认前不会调用模型。`,
      tone: "waiting",
    };
  }

  if (input.run?.status === "waiting_jobs") {
    const recent = input.project.generationHistory.slice(-Math.max(1, input.run.paidTaskCount));
    const succeeded = recent.filter((item) => item.status === "succeeded").length;
    const failed = recent.filter((item) => item.status === "failed").length;
    const total = Math.max(input.run.paidTaskCount, succeeded + failed, 1);
    return {
      title: "正在生成图片",
      detail: `已完成 ${succeeded}/${total}${failed ? `，失败 ${failed} 个可稍后重试` : "，结果会自动放入画布"}`,
      tone: failed ? "error" : "generating",
    };
  }

  if (input.run?.status === "tool_running") {
    return {
      title: "正在调用工具",
      detail: "Agent 正在执行受控工具，例如读取画布、创建计划或准备确认卡。",
      tone: "working",
    };
  }

  if (input.run?.status === "streaming" || input.run?.status === "created" || input.isRunning) {
    return {
      title: "正在理解需求",
      detail: input.busyLabel || "Agent 正在读取对话、画布和选区上下文。",
      tone: "working",
    };
  }

  if (input.run?.status === "failed" || input.run?.status === "cancelled") {
    return {
      title: input.run.status === "failed" ? "任务失败" : "任务已取消",
      detail: "你可以调整需求后重新发送，旧任务不会继续执行。",
      tone: "error",
    };
  }

  return undefined;
}
