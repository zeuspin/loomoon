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
import { useMemo, useState } from "react";
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
        <div><i /><strong>Design Agent</strong></div>
        <Button aria-label="关闭 Agent 面板" size="sm" variant="ghost" onClick={onClose}>×</Button>
      </header>
      <ThreadPrimitive.Root className="lm-agent-thread">
        <ThreadPrimitive.Viewport className="lm-agent-viewport">
          <ThreadPrimitive.Messages
            components={{ Message: () => <ThreadMessage onRetry={onRetry} /> }}
          />
          {activity && (
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
            <span>⌘ Enter</span>
            <ComposerPrimitive.Send
              aria-label="发送消息"
              className="lm-agent-send"
            >
              →
            </ComposerPrimitive.Send>
          </div>
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
  onClose: () => void;
  onSend: (input: AgentSendInput) => Promise<void>;
  onConfirm: (id: string, directionId?: string) => Promise<void>;
  onRevise: (prompt: string) => void;
  onRemoveSelection: (nodeId: string) => void;
  onClearSelection: () => void;
  onUploadReference: (file: File) => void;
};

export function AgentSidebar(props: AgentSidebarProps) {
  const [optimistic, setOptimistic] = useState<AgentUiMessage[]>([]);
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

  return (
    <LoomoonAgentRuntimeProvider
      entries={entries}
      isRunning={props.isRunning}
      isSendDisabled={props.isRunning}
      selectionAttachment={selectionAttachment}
      onSend={async (input) => {
        const pendingMessage = optimisticUserMessage({
          clientMessageId: crypto.randomUUID(),
          sessionId: props.agentSessionId ?? "local",
          projectId: props.project.id,
          content: input.text,
          selectionSnapshot: input.nodeIds,
        });
        setOptimistic((current) => [...current, pendingMessage]);
        try {
          await props.onSend(input);
        } catch (error) {
          setOptimistic((current) => current.map((message) =>
            message.id === pendingMessage.id
              ? failOptimisticMessage(message)
              : message
          ));
          throw error;
        }
      }}
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
          void props.onSend({
            text: failed.content,
            nodeIds: failed.selectionSnapshot,
          }).catch(() => {
            setOptimistic((current) => current.map((message) =>
              message.id === messageId
                ? failOptimisticMessage(message)
                : message
            ));
          });
        }}
      />
    </LoomoonAgentRuntimeProvider>
  );
}
