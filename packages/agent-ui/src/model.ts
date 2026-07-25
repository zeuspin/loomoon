import type {
  AgentMessage,
  ConfirmationGrant,
  CreativePlan,
} from "@loomoon/contracts";

export type MessageEntry = {
  id: string;
  kind: "message";
  role: AgentMessage["role"];
  text: string;
  selectionNodeIds: string[];
  createdAt: string;
  deliveryStatus?: "pending" | "sent" | "failed";
};

export type LoomoonAgentEntry =
  | MessageEntry
  | { id: string; kind: "plan"; plan: CreativePlan }
  | { id: string; kind: "confirmation"; confirmation: ConfirmationGrant }
  | { id: string; kind: "fallback"; text: string };

export type CanvasSelectionAttachment = {
  type: "canvas-selection";
  canvasVersion: number;
  nodeIds: string[];
  assets: Array<{
    assetId: string;
    thumbnailUrl: string;
    width: number;
    height: number;
  }>;
};
