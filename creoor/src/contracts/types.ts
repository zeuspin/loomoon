export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type ProjectId = Brand<string, "ProjectId">;
export type AssetId = Brand<string, "AssetId">;
export type NodeId = Brand<string, "NodeId">;
export type SessionId = Brand<string, "SessionId">;
export type ReferenceId = Brand<string, "ReferenceId">;
export type RequestId = Brand<string, "RequestId">;
export type GeneratorId = Brand<string, "GeneratorId">;

export type CanvasPoint = Brand<{ x: number; y: number }, "CanvasPoint">;
export type StageLocalPoint = Brand<{ x: number; y: number }, "StageLocalPoint">;
export type ClientPoint = Brand<{ x: number; y: number }, "ClientPoint">;
export type OverlayPoint = Brand<{ x: number; y: number }, "OverlayPoint">;

export type PanelPlacement =
  | { kind: "docked"; edge: "top" | "right" | "bottom" | "left"; offset: number; size: number }
  | { kind: "floating"; x: number; y: number; width: number; height: number };

export type PanelInteraction =
  | { kind: "idle" }
  | { kind: "dragging"; origin: PanelPlacement }
  | { kind: "resizing"; origin: PanelPlacement; edge: string };

export type PanelState = {
  placement: PanelPlacement;
  visibility: "expanded" | "collapsed" | "peek";
  persistence: "auto" | "pinned";
  interaction: PanelInteraction;
};

export type PersistedPanelState = Pick<PanelState, "placement" | "persistence"> & {
  visibility: "expanded" | "collapsed";
};

export type ToolId = "select" | "hand" | "brush" | "lasso" | "text" | "upload" | "generator";
export type GeneratorStatus =
  | "empty"
  | "configured"
  | "queued"
  | "generating"
  | "paused"
  | "completed"
  | "partial"
  | "failed"
  | "retrying"
  | "cancelled";

export type ProjectDocument = { id: ProjectId; title: string; nodeIds: NodeId[]; updatedAt: number };
export type WorkspaceState = { currentProjectId: ProjectId; currentTool: ToolId; panels: Record<string, PanelState> };
export type SessionState = { currentSessionId: SessionId; sessionIds: SessionId[] };
export type EphemeralInteractionState = { hoveredNodeId?: NodeId; selectedNodeIds: NodeId[] };

