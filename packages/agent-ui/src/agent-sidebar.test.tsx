import type { DemoProject } from "@loomoon/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AgentSidebar, type AgentSidebarProps } from "./agent-sidebar.js";

const project: DemoProject = {
  id: "project-1",
  name: "Demo",
  canvas: {
    id: "canvas-1",
    projectId: "project-1",
    version: 1,
    updatedAt: "2026-07-25T00:00:00.000Z",
    nodes: [],
  },
  canvasOperations: [],
  messages: [
    {
      id: "message-1",
      role: "assistant",
      content: "Choose a visual direction.",
      selectionSnapshot: [],
      createdAt: "2026-07-25T00:00:00.000Z",
    },
    {
      id: "message-2",
      role: "user",
      content: "Use the lighter direction.",
      selectionSnapshot: [],
      createdAt: "2026-07-25T00:01:00.000Z",
    },
  ],
  plans: [],
  generationHistory: [],
  confirmations: [],
  auditLog: [],
};

const renderSidebar = (props: Partial<AgentSidebarProps> = {}) =>
  renderToStaticMarkup(
    <AgentSidebar
      project={project}
      selectedImages={[]}
      isRunning={false}
      onClose={() => undefined}
      onSend={async () => undefined}
      onConfirm={async () => undefined}
      onRevise={() => undefined}
      onRemoveSelection={() => undefined}
      onClearSelection={() => undefined}
      onUploadReference={() => undefined}
      {...props}
    />,
  );

describe("AgentSidebar", () => {
  test("renders the real assistant thread and accessible composer", () => {
    const markup = renderSidebar();

    expect(markup).toContain("Demo");
    expect(markup).toContain("Choose a visual direction.");
    expect(markup).toContain('aria-label="发送消息"');
    expect(markup).not.toContain("取消生成");
    expect(markup).not.toContain("主题");
  });

  test("renders Agent identity and a distinct user message presentation", () => {
    const markup = renderSidebar();

    expect(markup).toContain(
      'class="lm-agent-message-row lm-agent-message-row--assistant"',
    );
    expect(markup).toContain('class="lm-agent-avatar"');
    expect(markup).toContain('class="lm-agent-author">Loomoon Agent');
    expect(markup).toContain(
      'class="lm-agent-message-row lm-agent-message-row--user"',
    );
    expect(markup).toContain("Use the lighter direction.");
  });

  test("renders creative directions as selectable buttons with an activity card", () => {
    const markup = renderSidebar({
      project: {
        ...project,
        plans: [{
          id: "plan-1",
          brief: "海报",
          summary: "选择一个方向",
          audience: "年轻用户",
          directions: [
            { id: "direction-1", title: "清透极简", style: "极简", composition: "居中", palette: "白蓝", prompt: "one" },
            { id: "direction-2", title: "大胆编辑", style: "编辑", composition: "网格", palette: "黑红", prompt: "two" }
          ],
          status: "awaiting_confirmation",
          version: 1,
          createdAt: "2026-07-25T00:02:00.000Z"
        }]
      }
    });

    expect(markup).toContain('button aria-pressed="false"');
    expect(markup).toContain("清透极简");
    expect(markup).toContain("大胆编辑");
    expect(markup).toContain("两个方向各生成 2 张");
    expect(markup).toContain("等待确认创意方向");
  });

  test("renders a transparent activity card while Agent is working", () => {
    const markup = renderSidebar({
      isRunning: true,
      busyLabel: "正在提交给 Pi Agent...",
    });

    expect(markup).toContain("正在理解需求");
    expect(markup).toContain("正在提交给 Pi Agent...");
  });

  test("renders a homepage launch prompt immediately in the new conversation", () => {
    const markup = renderSidebar({
      agentSessionId: "session-2",
      agentMessages: [],
      initialMessage: {
        id: "launch-1",
        text: "设计一张夏日海报",
        nodeIds: [],
        createdAt: "2026-07-27T00:00:00.000Z",
      },
    });

    expect(markup).toContain("设计一张夏日海报");
  });
});
