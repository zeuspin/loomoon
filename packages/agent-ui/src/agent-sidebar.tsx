import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessage,
} from "@assistant-ui/react";
import type {
  CanvasNode,
  DemoProject,
  PersistentAgentMessage,
  PersistentAgentRun,
} from "@loomoon/contracts";
import { Button } from "@loomoon/ui";
import { RiAddLine, RiArrowRightSLine, RiDislikeLine, RiFileList2Line, RiHeartLine, RiSearchLine, RiShareForwardLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  availableModels,
  filterConversationHistory,
  modelForMode,
} from "./composer-state.js";
import { describeAgentActivity } from "./activity.js";
import { createCanvasSelectionAttachment } from "./canvas-selection.js";
import { mapProjectToAgentEntries } from "./message-mapper.js";
import {
  LoomoonAgentRuntimeProvider,
  type AgentSendInput,
} from "./runtime-adapter.js";
import { ToolEntries } from "./tool-ui.js";
import {
  failOptimisticMessage,
  mergeAgentMessages,
  optimisticUserMessage,
  type AgentUiMessage,
} from "./message-state.js";

function ThreadMessage({ onRetry }: { onRetry: (messageId: string) => void }) {
  const messageId = useMessage((state) => state.id);
  const deliveryStatus = useMessage(
    (state) => state.metadata.custom?.deliveryStatus as string | undefined,
  );
  return (
    <MessagePrimitive.Root className="lm-agent-message-root">
      <MessagePrimitive.If assistant>
        <div className="lm-agent-message-row lm-agent-message-row--assistant">
          <div aria-hidden="true" className="lm-agent-avatar">L</div>
          <div className="lm-agent-message-column">
            <div className="lm-agent-author">Loomoon Agent</div>
            <div className="lm-agent-message-content">
              <MessagePrimitive.Parts />
            </div>
          </div>
        </div>
      </MessagePrimitive.If>
      <MessagePrimitive.If user>
        <div className="lm-agent-message-row lm-agent-message-row--user">
          <div className="lm-agent-message-content">
            <MessagePrimitive.Parts />
            {deliveryStatus === "pending" && (
              <small className="lm-agent-delivery-status">发送中...</small>
            )}
            {deliveryStatus === "failed" && (
              <span className="lm-agent-delivery-status lm-agent-delivery-status--failed">
                发送失败
                <button type="button" onClick={() => onRetry(messageId)}>重试</button>
              </span>
            )}
          </div>
        </div>
      </MessagePrimitive.If>
    </MessagePrimitive.Root>
  );
}

function AgentThread({
  entries,
  project,
  agentRun,
  busyLabel,
  selectedImages,
  isRunning,
  error,
  onClose,
  onConfirm,
  onRevise,
  onRemoveSelection,
  onClearSelection,
  onUploadReference,
  onRetry,
}: Omit<AgentSidebarProps, "onSend"> & {
  entries: ReturnType<typeof mapProjectToAgentEntries>;
  onRetry: (messageId: string) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [filesOpen, setFilesOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [mode, setMode] = useState<"image" | "video">("image");
  const [modelId, setModelId] = useState("loomoon-image-v2");
  const [online, setOnline] = useState(false);
  const historyItems = project.messages
    .filter((message) => message.role === "user")
    .map((message) => ({ id: message.id, title: message.content.slice(0, 30) }));
  const projectFiles = project.canvas.nodes.filter(
    (node) => node.type === "image" && node.assetUrl,
  );
  const showcaseResult = projectFiles.at(-1);
  const isShowcase = project.canvas.nodes.some((node) => node.id.startsWith("showcase-"));
  const activity = describeAgentActivity({
    project,
    entries,
    isRunning,
    ...(agentRun ? { run: agentRun } : {}),
    ...(busyLabel ? { busyLabel } : {}),
  });
  return (
    <aside className="lm-agent-sidebar">
      <header className="lm-agent-header">
        <div><i /><strong>{project.name}</strong></div>
        <nav>
          <button aria-label="新对话" title="新对话"><RiAddLine /></button>
          <button aria-label="会话历史" title="会话历史" onClick={() => setHistoryOpen((open) => !open)}><RiSearchLine /></button>
          <button aria-label="项目文件" title="项目文件" onClick={() => setFilesOpen((open) => !open)}><RiFileList2Line /></button>
          <button aria-label="分享会话" title="分享会话" onClick={() => void navigator.clipboard?.writeText(window.location.href)}><RiShareForwardLine /></button>
          <Button aria-label="关闭 Agent 面板" size="sm" variant="ghost" onClick={onClose}><RiArrowRightSLine /></Button>
        </nav>
      </header>
      {historyOpen && (
        <section className="lm-agent-popover">
          <strong>对话历史</strong>
          <input aria-label="搜索对话" placeholder="搜索对话" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} />
          {filterConversationHistory(historyItems, historyQuery).map((item) => <button key={item.id}>{item.title}</button>)}
          {!historyItems.length && <p>当前还没有历史对话</p>}
        </section>
      )}
      {filesOpen && (
        <section className="lm-agent-popover lm-agent-files">
          <strong>项目文件</strong>
          <div>{projectFiles.map((node) => <img alt="" key={node.id} src={node.assetUrl} />)}</div>
          {!projectFiles.length && <p>生成或上传的图片会显示在这里</p>}
        </section>
      )}
      <ThreadPrimitive.Root className="lm-agent-thread">
        <ThreadPrimitive.Viewport className="lm-agent-viewport">
          {showcaseResult && (
            <section className="lm-agent-result-preview">
              <img alt="Agent 生成结果" src={showcaseResult.assetUrl} />
              <p>已完成！我根据你的创作方向生成了一组视觉方案，并将结果放到了画布中。</p>
              <footer>
                <span>✦ Agent 已完成当前任务</span>
                <div><button aria-label="喜欢结果" type="button"><RiHeartLine /></button><button aria-label="不喜欢结果" type="button"><RiDislikeLine /></button></div>
              </footer>
            </section>
          )}
          {!isShowcase && <ThreadPrimitive.Messages
            components={{ Message: () => <ThreadMessage onRetry={onRetry} /> }}
          />}
          {!isShowcase && activity && (
            <div className={`lm-agent-running lm-agent-running--${activity.tone}`} role="status">
              <i />
              <span>
                <strong>{activity.title}</strong>
                <small>{activity.detail}</small>
              </span>
            </div>
          )}
          {error && <div className="lm-agent-error" role="alert">{error}</div>}
        </ThreadPrimitive.Viewport>
        {entries.some((entry) => entry.kind !== "message") && (
          <div className="lm-agent-action-dock">
            <ToolEntries
              entries={entries}
              isRunning={isRunning}
              onConfirm={onConfirm}
              onRevise={onRevise}
            />
          </div>
        )}
        <ComposerPrimitive.Root className="lm-agent-composer">
          {selectedImages.length > 0 && (
            <div className="lm-agent-selection">
              <span>画布选择 · {selectedImages.length}</span>
              <div>
                {selectedImages.map((node) => (
                  <button
                    aria-label={`移除图片 ${node.id}`}
                    key={node.id}
                    onClick={() => onRemoveSelection(node.id)}
                    type="button"
                  >
                    <img alt="" src={node.assetUrl} />
                  </button>
                ))}
              </div>
              <Button size="sm" variant="ghost" onClick={onClearSelection}>清除</Button>
            </div>
          )}
          <ComposerPrimitive.Input
            aria-label="消息内容"
            className="lm-agent-input"
            placeholder={
              selectedImages.length
                ? "告诉 Agent 如何处理这些图片..."
                : "描述你想创作的视觉内容..."
            }
          />
          <div className="lm-agent-composer-actions">
            <label className="lm-agent-upload">
              + 参考图
              <input
                accept="image/jpeg,image/png,image/webp"
                hidden
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUploadReference(file);
                  event.target.value = "";
                }}
              />
            </label>
            <button className={online ? "is-active" : ""} aria-label="联网搜索" onClick={() => setOnline((value) => !value)} type="button">◎</button>
            <button aria-label="模型偏好" onClick={() => setModelOpen((open) => !open)} type="button">◇</button>
            <span>⌘ Enter</span>
            <ComposerPrimitive.Send
              aria-label="发送消息"
              className="lm-agent-send"
            >
              →
            </ComposerPrimitive.Send>
          </div>
          {modelOpen && (
            <section className="lm-agent-model-menu">
              <header>
                <strong>模型偏好</strong>
                <label>自动选择 <input defaultChecked type="checkbox" /></label>
              </header>
              <nav>
                <button className={mode === "image" ? "is-active" : ""} onClick={() => setMode("image")} type="button">图像</button>
                <button className={mode === "video" ? "is-active" : ""} onClick={() => setMode("video")} type="button">视频</button>
              </nav>
              {modelForMode(availableModels, mode).map((model) => (
                <button className={model.id === modelId ? "is-active" : ""} key={model.id} onClick={() => setModelId(model.id)} type="button">
                  <i />
                  <span><strong>{model.name}</strong><small>{model.description}{model.duration ? ` · ${model.duration}` : ""}</small></span>
                  <b>{model.id === modelId ? "✓" : ""}</b>
                </button>
              ))}
            </section>
          )}
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </aside>
  );
}

export type AgentSidebarProps = {
  project: DemoProject;
  agentMessages?: PersistentAgentMessage[];
  agentSessionId?: string;
  selectedImages: CanvasNode[];
  isRunning: boolean;
  busyLabel?: string;
  error?: string;
  agentRun?: PersistentAgentRun;
  initialMessage?: {
    id: string;
    text: string;
    nodeIds: string[];
    createdAt: string;
  };
  onInitialMessageStarted?: (messageId: string) => void;
  onClose: () => void;
  onSend: (input: AgentSendInput) => Promise<void>;
  onConfirm: (id: string, directionId?: string) => Promise<void>;
  onRevise: (prompt: string) => void;
  onRemoveSelection: (nodeId: string) => void;
  onClearSelection: () => void;
  onUploadReference: (file: File) => void;
};

export function AgentSidebar(props: AgentSidebarProps) {
  const [optimistic, setOptimistic] = useState<AgentUiMessage[]>(() =>
    props.initialMessage
      ? [
          optimisticUserMessage({
            clientMessageId: props.initialMessage.id,
            sessionId: props.agentSessionId ?? "local",
            projectId: props.project.id,
            content: props.initialMessage.text,
            selectionSnapshot: props.initialMessage.nodeIds,
            createdAt: props.initialMessage.createdAt,
          }),
        ]
      : [],
  );
  const attemptedInitialIds = useRef(new Set<string>());
  const combinedMessages = useMemo(
    () => mergeAgentMessages(props.agentMessages ?? [], optimistic),
    [optimistic, props.agentMessages],
  );
  const entries = useMemo(
    () => mapProjectToAgentEntries(
      props.project,
      props.agentMessages ? combinedMessages : undefined,
    ),
    [combinedMessages, props.agentMessages, props.project],
  );
  const selectionAttachment = useMemo(
    () =>
      createCanvasSelectionAttachment(
        props.selectedImages,
        props.project.canvas.version,
      ),
    [props.project.canvas.version, props.selectedImages],
  );

  const sendOptimistically = useCallback(
    async (
      input: AgentSendInput,
      options?: {
        clientMessageId?: string;
        createdAt?: string;
        optimisticAlreadyQueued?: boolean;
      },
    ) => {
      const pendingMessage = optimisticUserMessage({
        clientMessageId: options?.clientMessageId ?? crypto.randomUUID(),
        sessionId: props.agentSessionId ?? "local",
        projectId: props.project.id,
        content: input.text,
        selectionSnapshot: input.nodeIds,
        ...(options?.createdAt ? { createdAt: options.createdAt } : {}),
      });
      if (!options?.optimisticAlreadyQueued) {
        setOptimistic((current) =>
          current.some((message) => message.id === pendingMessage.id)
            ? current
            : [...current, pendingMessage],
        );
      }
      try {
        await props.onSend(input);
      } catch (error) {
        setOptimistic((current) =>
          current.map((message) =>
            message.id === pendingMessage.id
              ? failOptimisticMessage(message)
              : message,
          ),
        );
        throw error;
      }
    },
    [props.agentSessionId, props.onSend, props.project.id],
  );

  useEffect(() => {
    const initial = props.initialMessage;
    if (!initial || attemptedInitialIds.current.has(initial.id)) return;
    attemptedInitialIds.current.add(initial.id);
    setOptimistic((current) =>
      current.some((message) => message.id === initial.id)
        ? current
        : [
            ...current,
            optimisticUserMessage({
              clientMessageId: initial.id,
              sessionId: props.agentSessionId ?? "local",
              projectId: props.project.id,
              content: initial.text,
              selectionSnapshot: initial.nodeIds,
              createdAt: initial.createdAt,
            }),
          ],
    );
    props.onInitialMessageStarted?.(initial.id);
    void sendOptimistically(
      { text: initial.text, nodeIds: initial.nodeIds },
      {
        clientMessageId: initial.id,
        createdAt: initial.createdAt,
        optimisticAlreadyQueued: true,
      },
    ).catch(() => undefined);
  }, [
    props.agentSessionId,
    props.initialMessage,
    props.onInitialMessageStarted,
    props.project.id,
    sendOptimistically,
  ]);

  return (
    <LoomoonAgentRuntimeProvider
      entries={entries}
      isRunning={props.isRunning}
      isSendDisabled={props.isRunning}
      selectionAttachment={selectionAttachment}
      onSend={sendOptimistically}
    >
      <AgentThread
        {...props}
        entries={entries}
        onRetry={(messageId) => {
          const failed = optimistic.find((message) => message.id === messageId);
          if (!failed) return;
          setOptimistic((current) => current.map((message) =>
            message.id === messageId
              ? { ...message, deliveryStatus: "pending" }
              : message
          ));
          void sendOptimistically(
            {
              text: failed.content,
              nodeIds: failed.selectionSnapshot,
            },
            {
              clientMessageId: failed.id,
              createdAt: failed.createdAt,
              optimisticAlreadyQueued: true,
            },
          ).catch(() => undefined);
        }}
      />
    </LoomoonAgentRuntimeProvider>
  );
}
