import type {
  AgentRunResult,
  AgentSession,
  CanvasGeneratorSnapshot,
  CanvasNode,
  DemoProject,
  ImageModelCapability,
  PersistentAgentMessage,
  PersistentAgentRun
} from "@loomoon/contracts";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
  }
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  status: "empty" | "planning" | "generating" | "ready" | "attention";
  coverUrl?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    }
  });
  const text = await response.text();
  let payload: unknown;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(
        "服务返回了无法识别的响应，请稍后重试。",
        "INVALID_SERVICE_RESPONSE",
        response.status
      );
    }
  }
  if (!response.ok) {
    if (!text) {
      throw new ApiError(
        "服务正在重新连接，请稍后重试。",
        "SERVICE_UNAVAILABLE",
        response.status
      );
    }
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error: { message?: string } }).error.message
        : undefined;
    const code =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: { code?: string } }).error.code ?? "REQUEST_FAILED")
        : "REQUEST_FAILED";
    throw new ApiError(message || `请求失败 (${response.status})`, code, response.status);
  }
  if (!text) throw new ApiError("服务未返回数据，请稍后重试。", "EMPTY_RESPONSE", response.status);
  return payload as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string; displayName: string } }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  me: () => request<{ id: string; email: string; displayName: string }>("/api/v1/auth/me"),
  logout: () => request<{ status: string }>("/api/v1/auth/logout", { method: "POST" }),
  bootstrap: () => request<DemoProject>("/api/v1/demo/bootstrap", { method: "POST" }),
  listProjects: () => request<ProjectSummary[]>("/api/v1/projects"),
  getProject: (projectId: string) => request<DemoProject>(`/api/v1/projects/${projectId}`),
  getImageModels: () => request<ImageModelCapability[]>("/api/v1/image-models"),
  generateFromCanvas: (
    projectId: string,
    generatorNodeId: string,
    config: CanvasGeneratorSnapshot,
    idempotencyKey: string,
  ) => request<DemoProject>(
    `/api/v1/projects/${projectId}/generators/${generatorNodeId}/generate`,
    {
      method: "POST",
      body: JSON.stringify({ config, idempotencyKey }),
    },
  ),
  createProject: (name: string) =>
    request<DemoProject>("/api/v1/projects", { method: "POST", body: JSON.stringify({ name }) }),
  renameProject: (projectId: string, name: string) =>
    request<DemoProject>(`/api/v1/projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteProject: (projectId: string) =>
    request<{ status: string }>(`/api/v1/projects/${projectId}`, { method: "DELETE" }),
  sendMessage: (projectId: string, content: string, selectedNodeIds: string[]) =>
    request<AgentRunResult>(`/api/v1/projects/${projectId}/agent/messages`, {
      method: "POST",
      body: JSON.stringify({ content, selectedNodeIds })
    }),
  createAgentSession: (projectId: string) =>
    request<AgentSession>(`/api/v1/projects/${projectId}/agent/sessions`, {
      method: "POST",
      body: JSON.stringify({})
    }),
  getAgentSession: (sessionId: string) =>
    request<{
      session: AgentSession;
      messages: PersistentAgentMessage[];
    }>(`/api/v1/agent/sessions/${sessionId}`),
  sendAgentMessage: (sessionId: string, content: string, selectedNodeIds: string[]) =>
    request<{
      session: AgentSession;
      run: PersistentAgentRun;
      message: PersistentAgentMessage;
    }>(`/api/v1/agent/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, selectedNodeIds })
    }),
  getAgentRun: (runId: string) =>
    request<PersistentAgentRun>(`/api/v1/agent/runs/${runId}`),
  confirmAgentRun: (runId: string, pendingActionId: string, directionId?: string) =>
    request<PersistentAgentRun>(`/api/v1/agent/runs/${runId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ pendingActionId, directionId })
    }),
  cancelAgentRun: (runId: string) =>
    request<PersistentAgentRun>(`/api/v1/agent/runs/${runId}/cancel`, {
      method: "POST",
      body: JSON.stringify({})
    }),
  confirm: (projectId: string, confirmationId: string, directionId?: string) =>
    request<DemoProject>(`/api/v1/projects/${projectId}/agent/confirm/${confirmationId}`, {
      method: "POST",
      body: JSON.stringify({ directionId })
    }),
  retryGeneration: (projectId: string, nodeId: string) =>
    request<DemoProject>(`/api/v1/projects/${projectId}/generation-tasks/${nodeId}/retry`, {
      method: "POST"
    }),
  uploadReference: (projectId: string, dataUrl: string) =>
    request<DemoProject>(`/api/v1/projects/${projectId}/assets/uploads`, {
      method: "POST",
      body: JSON.stringify({ dataUrl })
    }),
  proposeRegionEdit: (
    projectId: string,
    input: {
      nodeId: string;
      instruction: string;
      bbox: [number, number, number, number];
    }
  ) =>
    request<AgentRunResult>(`/api/v1/projects/${projectId}/agent/region-edit`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  addHistoryToCanvas: (projectId: string, recordId: string) =>
    request<DemoProject>(`/api/v1/projects/${projectId}/history/${recordId}/add-to-canvas`, {
      method: "POST"
    }),
  saveCanvas: (projectId: string, version: number, nodes: CanvasNode[]) =>
    request<DemoProject>(`/api/v1/projects/${projectId}/canvas/operations`, {
      method: "POST",
      body: JSON.stringify({ version, nodes })
    })
};
