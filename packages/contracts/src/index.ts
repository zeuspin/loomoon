export type EntityId = string;

export interface VersionedEntity {
  id: EntityId;
  version: number;
}

export type CanvasNodeType = "image" | "text" | "artboard" | "generation-placeholder";

export interface CanvasNode {
  id: EntityId;
  type: CanvasNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  prompt?: string;
  assetUrl?: string;
  assetId?: EntityId;
  directionId?: EntityId;
  planId?: EntityId;
  sourceNodeIds?: EntityId[];
  editBbox?: [number, number, number, number];
  groupId?: EntityId;
  locked?: boolean;
  status?: "queued" | "running" | "succeeded" | "failed";
  errorCode?: string;
  providerRequestId?: string;
  resolvedModel?: string;
}

export interface CanvasDocument extends VersionedEntity {
  projectId: EntityId;
  nodes: CanvasNode[];
  updatedAt: string;
}

export interface CanvasOperation {
  id: EntityId;
  actor: "user" | "agent" | "system";
  type: "replace_snapshot" | "agent_layout" | "asset_added" | "generation_result" | "recovery";
  baseVersion: number;
  resultVersion: number;
  idempotencyKey: string;
  nodeIds: EntityId[];
  createdAt: string;
}

export interface CreativeDirection {
  id: EntityId;
  title: string;
  style: string;
  composition: string;
  palette: string;
  prompt: string;
}

export interface CreativePlan {
  id: EntityId;
  brief: string;
  summary: string;
  audience: string;
  directions: [CreativeDirection, CreativeDirection];
  status: "awaiting_confirmation" | "confirmed" | "completed" | "failed";
  version: number;
  confirmedBy?: EntityId;
  confirmedAt?: string;
  providerRequestId?: string;
  resolvedModel?: string;
  createdAt: string;
}

export interface AgentMessage {
  id: EntityId;
  role: "user" | "assistant" | "system";
  content: string;
  selectionSnapshot: EntityId[];
  agentRunId?: EntityId;
  createdAt: string;
}

export interface ConfirmationGrant {
  id: EntityId;
  action: "generate_candidates" | "edit_images" | "edit_region" | "generate_from_references";
  summary: string;
  targetNodeIds: EntityId[];
  taskCount: number;
  inputHash: string;
  status: "pending" | "consumed" | "expired";
  expiresAt: string;
  consumedAt?: string;
  bbox?: [number, number, number, number];
}

export interface AuditEvent {
  id: EntityId;
  userId: EntityId;
  projectId: EntityId;
  agentRunId: EntityId;
  action: string;
  targetIds: EntityId[];
  status: "proposed" | "confirmed" | "started" | "succeeded" | "failed";
  createdAt: string;
  detail?: string;
}

export interface GenerationRecord {
  id: EntityId;
  nodeId: EntityId;
  assetUrl?: string;
  type: "text_to_image" | "image_edit" | "region_edit";
  status: "succeeded" | "failed";
  prompt: string;
  sourceNodeIds: EntityId[];
  createdAt: string;
  retryOfId?: EntityId;
  errorCode?: string;
  providerRequestId?: string;
  resolvedModel?: string;
}

export interface DemoProject {
  id: EntityId;
  name: string;
  canvas: CanvasDocument;
  canvasOperations: CanvasOperation[];
  messages: AgentMessage[];
  plans: CreativePlan[];
  generationHistory: GenerationRecord[];
  confirmations: ConfirmationGrant[];
  auditLog: AuditEvent[];
}

export interface AgentRunResult {
  kind: "plan" | "analysis" | "confirmation";
  message: AgentMessage;
  plan?: CreativePlan;
  confirmation?: {
    id: EntityId;
    action: "generate_candidates" | "edit_images" | "edit_region" | "generate_from_references";
    summary: string;
    targetNodeIds: EntityId[];
    taskCount: number;
    bbox?: [number, number, number, number];
  };
}

export type AgentRunStatus =
  | "created"
  | "streaming"
  | "waiting_confirmation"
  | "tool_running"
  | "waiting_jobs"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentSession {
  id: EntityId;
  userId: EntityId;
  projectId: EntityId;
  createdAt: string;
  updatedAt: string;
  messageIds: EntityId[];
  activeRunId?: EntityId;
}

export interface PersistentAgentRun {
  id: EntityId;
  sessionId: EntityId;
  userId: EntityId;
  projectId: EntityId;
  status: AgentRunStatus;
  selectionSnapshot: EntityId[];
  toolCallCount: number;
  paidTaskCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorCode?: string;
}

export interface PersistentAgentMessage {
  id: EntityId;
  sessionId: EntityId;
  runId?: EntityId;
  userId: EntityId;
  projectId: EntityId;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  selectionSnapshot: EntityId[];
  createdAt: string;
  toolCallId?: EntityId;
}

export type AgentToolCallStatus =
  | "proposed"
  | "running"
  | "waiting_confirmation"
  | "waiting_jobs"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface AgentToolCall {
  id: EntityId;
  runId: EntityId;
  sessionId: EntityId;
  userId: EntityId;
  projectId: EntityId;
  toolName: string;
  input: Record<string, unknown>;
  inputHash: string;
  status: AgentToolCallStatus;
  createdAt: string;
  updatedAt: string;
  result?: Record<string, unknown>;
  errorCode?: string;
}

export interface PendingAgentAction {
  id: EntityId;
  runId: EntityId;
  toolCallId: EntityId;
  userId: EntityId;
  projectId: EntityId;
  toolName: string;
  input: Record<string, unknown>;
  inputHash: string;
  targetNodeIds: EntityId[];
  taskCount: number;
  status: "pending" | "confirmed" | "completed" | "failed" | "expired" | "cancelled";
  expiresAt: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface AgentStateDocument {
  sessions: AgentSession[];
  runs: PersistentAgentRun[];
  messages: PersistentAgentMessage[];
  toolCalls: AgentToolCall[];
  pendingActions: PendingAgentAction[];
}
