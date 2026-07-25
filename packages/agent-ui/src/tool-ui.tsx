import { Button } from "@loomoon/ui";
import { useState } from "react";
import type { LoomoonAgentEntry } from "./model.js";

export type ToolEntriesProps = {
  entries: LoomoonAgentEntry[];
  isRunning: boolean;
  onConfirm: (id: string, directionId?: string) => Promise<void>;
  onRevise: (prompt: string) => void;
};

export function ToolEntries({
  entries,
  isRunning,
  onConfirm,
  onRevise,
}: ToolEntriesProps) {
  const structured = entries.filter((entry) => entry.kind !== "message");
  const [selectedDirectionByPlan, setSelectedDirectionByPlan] = useState<Record<string, string>>({});

  return (
    <div className="lm-agent-tools">
      {structured.map((entry) => {
        if (entry.kind === "plan") {
          const selectedDirectionId = selectedDirectionByPlan[entry.plan.id];
          return (
            <article className="lm-agent-tool-card" key={entry.id}>
              <span className="lm-agent-kicker">创作计划 v{entry.plan.version}</span>
              <strong>{entry.plan.summary}</strong>
              <p>{entry.plan.audience}</p>
              <div className="lm-agent-direction-list" role="group" aria-label="选择视觉方向">
                {entry.plan.directions.map((direction, index) => {
                  const selected = selectedDirectionId === direction.id;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`lm-agent-direction${selected ? " lm-agent-direction--selected" : ""}`}
                      key={direction.id}
                      onClick={() => setSelectedDirectionByPlan((current) => ({
                        ...current,
                        ...(selected ? { [entry.plan.id]: "" } : { [entry.plan.id]: direction.id }),
                      }))}
                      type="button"
                    >
                      <b>0{index + 1}</b>
                      <span>
                        <strong>{direction.title}</strong>
                        <span>{direction.style} · {direction.composition}</span>
                        <small>{direction.palette}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="lm-agent-tool-actions">
                <Button
                  disabled={isRunning}
                  variant="primary"
                  onClick={() => void onConfirm(entry.plan.id, selectedDirectionId || undefined)}
                >
                  {selectedDirectionId ? "采用此方向并生成 4 张" : "两个方向各生成 2 张"}
                </Button>
                <Button
                  disabled={isRunning}
                  variant="ghost"
                  onClick={() => onRevise(`请调整第 ${entry.plan.version} 版计划：`)}
                >
                  要求修改
                </Button>
              </div>
            </article>
          );
        }

        if (entry.kind === "confirmation") {
          return (
            <article className="lm-agent-tool-card" key={entry.id}>
              <span className="lm-agent-kicker">需要确认</span>
              <strong>{entry.confirmation.summary}</strong>
              <p>{entry.confirmation.taskCount} 个图片任务，结果将放入画布。</p>
              <Button
                disabled={isRunning}
                variant="primary"
                onClick={() => void onConfirm(entry.confirmation.id)}
              >
                确认执行
              </Button>
            </article>
          );
        }

        return (
          <article className="lm-agent-tool-card" key={entry.id}>
            <span className="lm-agent-kicker">Agent 状态</span>
            <p>{entry.text}</p>
          </article>
        );
      })}
    </div>
  );
}
