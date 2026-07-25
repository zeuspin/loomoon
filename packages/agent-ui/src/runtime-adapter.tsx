import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { useCallback, useMemo, type ReactNode } from "react";
import type {
  CanvasSelectionAttachment,
  LoomoonAgentEntry,
  MessageEntry,
} from "./model.js";

export type AgentSendInput = {
  text: string;
  nodeIds: string[];
};

export function parseOutgoingMessage(
  message: AppendMessage,
  attachment?: CanvasSelectionAttachment,
): AgentSendInput {
  const text = message.content
    .filter(
      (part): part is Extract<typeof part, { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("")
    .trim();

  if (!text) throw new Error("消息必须包含文本内容");

  return {
    text,
    nodeIds: [...new Set(attachment?.nodeIds ?? [])],
  };
}

function convertMessage(message: MessageEntry): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    content: [{ type: "text", text: message.text }],
    createdAt: new Date(message.createdAt),
    metadata: {
      custom: {
        selectionNodeIds: message.selectionNodeIds,
        deliveryStatus: message.deliveryStatus,
      },
    },
  };
}

export type LoomoonAgentRuntimeProviderProps = {
  children: ReactNode;
  entries: LoomoonAgentEntry[];
  isRunning: boolean;
  isSendDisabled?: boolean;
  selectionAttachment?: CanvasSelectionAttachment | undefined;
  onSend: (input: AgentSendInput) => Promise<void>;
};

export function LoomoonAgentRuntimeProvider({
  children,
  entries,
  isRunning,
  isSendDisabled = false,
  selectionAttachment,
  onSend,
}: LoomoonAgentRuntimeProviderProps) {
  const messages = useMemo(
    () =>
      entries.filter(
        (entry): entry is MessageEntry => entry.kind === "message",
      ),
    [entries],
  );
  const onNew = useCallback(
    async (message: AppendMessage) => {
      await onSend(parseOutgoingMessage(message, selectionAttachment));
    },
    [onSend, selectionAttachment],
  );
  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage,
    isRunning,
    isSendDisabled,
    onNew,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
