import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import type { CanvasGeneratorSnapshot, CanvasNode, ImageModelCapability } from "@loomoon/contracts";
import type { DemoService } from "./demo-service.js";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { AuthService, AuthUser } from "./auth-service.js";
import type { ProjectRegistry } from "./project-registry.js";
import type { AgentCoordinator } from "./agent-coordinator.js";
import { normalizeGeneratorSnapshot } from "./image-model-catalog.js";

interface BuildAppOptions {
  demoService?: DemoService;
  authService?: AuthService;
  resolveDemoService?: (userId: string) => DemoService;
  projectRegistry?: ProjectRegistry;
  assetsRoot?: string;
  providerName?: "bailian" | "mock";
  agentCoordinator?: AgentCoordinator;
  imageModelCatalog?: ImageModelCapability[];
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 25 * 1024 * 1024 });
  const rateLimits = new Map<string, { count: number; resetAt: number }>();
  const generatorSubmissions = new Set<string>();
  const enforceRateLimit = (key: string, limit: number, windowMs = 60_000) => {
    const now = Date.now();
    const current = rateLimits.get(key);
    if (!current || current.resetAt <= now) {
      rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    if (current.count >= limit) throw new Error("APP_RATE_LIMITED");
    current.count += 1;
  };

  app.get("/api/v1/health/live", async () => ({
    status: "ok",
    service: "api"
  }));
  app.get("/api/v1/health/ready", async () => ({
    status: "ready",
    persistence: options.projectRegistry ? "local-json" : "in-memory",
    assets: options.assetsRoot ? "local-scoped" : "disabled",
    provider: options.providerName ?? "test"
  }));

  if (options.imageModelCatalog) {
    app.get("/api/v1/image-models", async () => options.imageModelCatalog);
  }

  if (options.authService) {
    app.post<{ Body: { email: string; password: string } }>("/api/v1/auth/login", async (request, reply) => {
      enforceRateLimit(`login:${request.ip}`, 10);
      const session = await options.authService!.login(request.body.email, request.body.password);
      reply.header(
        "Set-Cookie",
        `loomoon_access=${session.accessToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`
      );
      return session;
    });
    app.get("/api/v1/auth/me", async (request) => requireUser(options.authService!, request));
    app.post("/api/v1/auth/logout", async (request, reply) => {
      const token = bearerToken(request);
      if (token) options.authService!.logout(token);
      reply.header("Set-Cookie", "loomoon_access=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
      return { status: "ok" };
    });
  }

  if (options.assetsRoot) {
    app.get<{ Params: { ownerId: string; filename: string } }>("/assets/:ownerId/:filename", async (request, reply) => {
      if (options.authService) {
        const user = requireUser(options.authService, request);
        if (user.id !== request.params.ownerId) return reply.status(404).send();
      }
      if (!/^[a-z0-9-]+$/i.test(request.params.ownerId)) return reply.status(404).send();
      const filename = basename(request.params.filename);
      if (filename !== request.params.filename) return reply.status(404).send();
      try {
        const bytes = await readFile(join(options.assetsRoot!, request.params.ownerId, filename));
        const extension = filename.split(".").at(-1)?.toLowerCase();
        const mime =
          extension === "jpg" || extension === "jpeg"
            ? "image/jpeg"
            : extension === "webp"
              ? "image/webp"
              : "image/png";
        return reply
          .header("Cache-Control", options.authService ? "private, max-age=3600" : "public, max-age=31536000, immutable")
          .type(mime)
          .send(bytes);
      } catch {
        return reply.status(404).send();
      }
    });
  }

  if (options.agentCoordinator) {
    app.post<{ Params: { projectId: string } }>(
      "/api/v1/projects/:projectId/agent/sessions",
      async (request) => {
        const user = requireUser(options.authService!, request);
        return options.agentCoordinator!.createSession(user.id, request.params.projectId);
      }
    );
    app.post<{
      Params: { sessionId: string };
      Body: { content: string; selectedNodeIds?: string[] };
    }>("/api/v1/agent/sessions/:sessionId/messages", async (request) => {
      const user = requireUser(options.authService!, request);
      enforceRateLimit(`agent:${user.id}`, 30);
      return options.agentCoordinator!.sendMessage({
        userId: user.id,
        sessionId: request.params.sessionId,
        content: request.body.content,
        selectedNodeIds: request.body.selectedNodeIds ?? []
      });
    });
    app.get<{ Params: { sessionId: string } }>(
      "/api/v1/agent/sessions/:sessionId",
      async (request) => {
        const user = requireUser(options.authService!, request);
        return options.agentCoordinator!.getSessionTimeline(user.id, request.params.sessionId);
      }
    );
    app.get<{ Params: { runId: string } }>("/api/v1/agent/runs/:runId", async (request) => {
      const user = requireUser(options.authService!, request);
      return options.agentCoordinator!.getRun(user.id, request.params.runId);
    });
    app.post<{
      Params: { runId: string };
      Body: { pendingActionId: string; directionId?: string };
    }>("/api/v1/agent/runs/:runId/confirm", async (request) => {
      const user = requireUser(options.authService!, request);
      enforceRateLimit(`generation:${user.id}`, 10);
      return options.agentCoordinator!.confirmAction(
        user.id,
        request.params.runId,
        request.body.pendingActionId,
        request.body?.directionId
      );
    });
    app.post<{ Params: { runId: string } }>(
      "/api/v1/agent/runs/:runId/cancel",
      async (request) => {
        const user = requireUser(options.authService!, request);
        return options.agentCoordinator!.cancelAction(user.id, request.params.runId);
      }
    );
  }

  if (options.demoService || options.resolveDemoService || options.projectRegistry) {
    const resolveService = async (request: FastifyRequest, projectId?: string): Promise<DemoService> => {
      if (options.demoService && !options.authService) return options.demoService;
      const user = requireUser(options.authService!, request);
      if (options.projectRegistry) {
        const id = projectId ?? (await options.projectRegistry.defaultProject(user.id)).id;
        return options.projectRegistry.service(user.id, id);
      }
      return options.resolveDemoService!(user.id);
    };

    app.post("/api/v1/demo/bootstrap", async (request) => {
      if (options.projectRegistry) {
        const user = requireUser(options.authService!, request);
        return options.projectRegistry.defaultProject(user.id);
      }
      return (await resolveService(request)).bootstrap();
    });

    if (options.projectRegistry) {
      app.get("/api/v1/projects", async (request) => {
        const user = requireUser(options.authService!, request);
        return options.projectRegistry!.list(user.id);
      });
      app.post<{ Body: { name: string } }>("/api/v1/projects", async (request) => {
        const user = requireUser(options.authService!, request);
        return options.projectRegistry!.create(user.id, request.body.name);
      });
      app.patch<{ Params: { projectId: string }; Body: { name: string } }>("/api/v1/projects/:projectId", async (request) => {
        const user = requireUser(options.authService!, request);
        return options.projectRegistry!.rename(user.id, request.params.projectId, request.body.name);
      });
      app.delete<{ Params: { projectId: string } }>("/api/v1/projects/:projectId", async (request) => {
        const user = requireUser(options.authService!, request);
        await options.projectRegistry!.delete(user.id, request.params.projectId);
        return { status: "ok" };
      });
    }

    app.get<{ Params: { projectId: string } }>("/api/v1/projects/:projectId", async (request) =>
      (await resolveService(request, request.params.projectId)).getProject(request.params.projectId)
    );

    app.get<{ Params: { projectId: string } }>("/api/v1/projects/:projectId/events", async (request, reply) => {
      const service = await resolveService(request, request.params.projectId);
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
      });
      let previousFingerprint = "";
      let eventSequence = 0;
      const publish = async () => {
        try {
          const project = await service.getProject(request.params.projectId);
          const fingerprint = projectFingerprint(project);
          if (fingerprint !== previousFingerprint) {
            previousFingerprint = fingerprint;
            eventSequence += 1;
            reply.raw.write(`id: ${eventSequence}\nevent: project\ndata: ${JSON.stringify(project)}\n\n`);
          } else {
            reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
          }
        } catch {
          reply.raw.end();
        }
      };
      await publish();
      const timer = setInterval(() => void publish(), 1_000);
      request.raw.on("close", () => clearInterval(timer));
    });

    app.post<{
      Params: { projectId: string };
      Body: { content: string; selectedNodeIds?: string[] };
    }>("/api/v1/projects/:projectId/agent/messages", async (request) => {
      const user = options.authService ? requireUser(options.authService, request) : { id: "local" };
      enforceRateLimit(`agent:${user.id}`, 30);
      return (await resolveService(request, request.params.projectId)).sendMessage(request.params.projectId, {
        content: request.body.content,
        selectedNodeIds: request.body.selectedNodeIds ?? []
      });
    });

    app.post<{
      Params: { projectId: string; confirmationId: string };
      Body: { directionId?: string };
    }>("/api/v1/projects/:projectId/agent/confirm/:confirmationId", async (request) => {
      const user = options.authService ? requireUser(options.authService, request) : { id: "local" };
      enforceRateLimit(`generation:${user.id}`, 10);
      return (await resolveService(request, request.params.projectId)).confirm(
        request.params.projectId,
        request.params.confirmationId,
        request.body?.directionId
      );
    });

    app.post<{
      Params: { projectId: string; nodeId: string };
    }>("/api/v1/projects/:projectId/generation-tasks/:nodeId/retry", async (request) =>
      (await resolveService(request, request.params.projectId)).retryGeneration(request.params.projectId, request.params.nodeId)
    );

    if (options.imageModelCatalog) {
      app.post<{
        Params: { projectId: string; generatorNodeId: string };
        Body: { idempotencyKey: string; config: CanvasGeneratorSnapshot };
      }>("/api/v1/projects/:projectId/generators/:generatorNodeId/generate", async (request) => {
        const user = options.authService ? requireUser(options.authService, request) : { id: "local" };
        enforceRateLimit(`generation:${user.id}`, 10);
        const key = `${user.id}:${request.params.projectId}:${request.params.generatorNodeId}:${request.body.idempotencyKey}`;
        const service = await resolveService(request, request.params.projectId);
        if (generatorSubmissions.has(key)) return service.getProject(request.params.projectId);
        const config = normalizeGeneratorSnapshot(request.body.config, options.imageModelCatalog!);
        generatorSubmissions.add(key);
        try {
          return await service.generateFromCanvas(
            request.params.projectId,
            request.params.generatorNodeId,
            config,
          );
        } catch (error) {
          generatorSubmissions.delete(key);
          throw error;
        }
      });
    }

    app.post<{
      Params: { projectId: string };
      Body: { dataUrl: string };
    }>("/api/v1/projects/:projectId/assets/uploads", async (request) =>
      (await resolveService(request, request.params.projectId)).addReferenceImage(request.params.projectId, request.body.dataUrl)
    );

    app.post<{
      Params: { projectId: string };
      Body: {
        nodeId: string;
        instruction: string;
        bbox: [number, number, number, number];
      };
    }>("/api/v1/projects/:projectId/agent/region-edit", async (request) =>
      (await resolveService(request, request.params.projectId)).proposeRegionEdit(request.params.projectId, request.body)
    );

    app.post<{
      Params: { projectId: string; recordId: string };
    }>("/api/v1/projects/:projectId/history/:recordId/add-to-canvas", async (request) =>
      (await resolveService(request, request.params.projectId)).addHistoryToCanvas(request.params.projectId, request.params.recordId)
    );

    app.post<{
      Params: { projectId: string };
      Body: { version: number; nodes: CanvasNode[] };
    }>("/api/v1/projects/:projectId/canvas/operations", async (request) =>
      (await resolveService(request, request.params.projectId)).saveCanvas(request.params.projectId, request.body.nodes, request.body.version)
    );
  }

  app.setErrorHandler((error, _request, reply) => {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    const statusCode =
      code === "APP_RATE_LIMITED"
        ? 429
      : code === "CANVAS_VERSION_CONFLICT"
        ? 409
        : code === "AGENT_SESSION_BUSY" || code === "AGENT_RUN_INVALID_STATE"
          ? 409
        : code === "BAILIAN_RATE_LIMITED"
          ? 429
        : code === "BAILIAN_AUTH_ERROR" || code === "BAILIAN_TIMEOUT" ||
            code === "BAILIAN_INVALID_RESPONSE" || code === "BAILIAN_UNAVAILABLE"
          ? 503
        : code === "UNAUTHORIZED" || code === "INVALID_CREDENTIALS"
          ? 401
        : code === "PROJECT_NOT_FOUND" || code === "CONFIRMATION_NOT_FOUND"
          ? 404
          : code === "CONFIRMATION_EXPIRED"
            ? 409
          : code === "GENERATION_NOT_RETRYABLE"
            ? 409
            : code === "HISTORY_ASSET_UNAVAILABLE"
              ? 409
              : code === "PROJECT_NAME_REQUIRED"
                ? 400
          : code === "EMPTY_MESSAGE" || code === "IMAGE_SELECTION_REQUIRED" ||
              code === "REFERENCE_IMAGE_LIMIT" || code === "IMAGE_SELECTION_LIMIT" ||
              code === "EMPTY_REGION" || code === "IMAGE_TOO_LARGE" ||
              code === "INVALID_IMAGE_BYTES" || code === "INVALID_IMAGE_DATA_URL" ||
              code === "INVALID_IMAGE_MIME" || code === "IMAGE_DECODE_FAILED" ||
              code === "INVALID_ASSET_URL" ||
              code === "INVALID_ASSET_PATH" || code === "INVALID_GENERATOR_CONFIG"
            ? 400
            : code === "IMAGE_MODEL_UNAVAILABLE"
              ? 400
              : code === "GENERATOR_NOT_FOUND"
                ? 404
                : code === "GENERATOR_ALREADY_RUNNING"
                  ? 409
            : 500;
    return reply.status(statusCode).send({
      error: {
        code,
        message: userMessageFor(code),
        requestId: crypto.randomUUID(),
        retryable: statusCode >= 500
      }
    });
  });

  return app;
}

function projectFingerprint(project: {
  canvas: { version: number; nodes: Array<{ id: string; status?: string }> };
  messages: unknown[];
  plans: Array<{ id: string; status: string }>;
}): string {
  return JSON.stringify([
    project.canvas.version,
    project.messages.length,
    project.plans.map((plan) => [plan.id, plan.status]),
    project.canvas.nodes.map((node) => [node.id, node.status])
  ]);
}

function userMessageFor(code: string): string {
  const messages: Record<string, string> = {
    AGENT_SESSION_BUSY: "Agent 正在执行上一项任务，请等待完成后再发送。",
    AGENT_RUN_INVALID_STATE: "当前 Agent 任务状态不允许执行此操作，请刷新后重试。",
    CANVAS_VERSION_CONFLICT: "画布已在其他位置更新，请刷新后重试。",
    APP_RATE_LIMITED: "操作过于频繁，请稍后再试。",
    UNAUTHORIZED: "登录状态已失效，请重新登录。",
    INVALID_CREDENTIALS: "账号或密码错误。",
    PROJECT_NOT_FOUND: "项目不存在或无权访问。",
    CONFIRMATION_NOT_FOUND: "确认已失效，请重新发起操作。",
    CONFIRMATION_EXPIRED: "确认已过期，请重新发起操作。",
    GENERATION_NOT_RETRYABLE: "该任务当前不能重试。",
    HISTORY_ASSET_UNAVAILABLE: "该历史记录没有可重新加入的图片。",
    PROJECT_NAME_REQUIRED: "请输入项目名称。",
    EMPTY_MESSAGE: "请输入创作需求。",
    IMAGE_SELECTION_REQUIRED: "请先选择至少一张图片。",
    IMAGE_SELECTION_LIMIT: "一次最多选择 8 张图片。",
    REFERENCE_IMAGE_LIMIT: "首次创作最多上传 3 张参考图。",
    EMPTY_REGION: "请先框选有效的修改区域。",
    BAILIAN_RATE_LIMITED: "模型服务当前繁忙，请稍后重试。",
    BAILIAN_AUTH_ERROR: "模型服务配置异常，请联系管理员。",
    BAILIAN_TIMEOUT: "模型响应超时，请重试。",
    BAILIAN_INVALID_RESPONSE: "模型返回内容无法处理，请重新提交。",
    BAILIAN_UNAVAILABLE: "模型服务暂时不可用，请稍后重试。",
    IMAGE_TOO_LARGE: "图片不能超过 20 MB。",
    INVALID_IMAGE_BYTES: "图片内容与声明格式不一致。",
    INVALID_IMAGE_DATA_URL: "图片数据格式无效。",
    INVALID_IMAGE_MIME: "仅支持 JPG、PNG 和 WebP。",
    IMAGE_DECODE_FAILED: "图片无法解码，请更换文件。",
    INVALID_ASSET_URL: "资产地址无效。",
    INVALID_ASSET_PATH: "资产路径无效。",
    INVALID_GENERATOR_CONFIG: "图像生成参数无效。",
    IMAGE_MODEL_UNAVAILABLE: "所选图像模型当前不可用。",
    GENERATOR_NOT_FOUND: "图像生成器不存在。",
    GENERATOR_ALREADY_RUNNING: "该图像生成器正在运行。"
  };
  return messages[code] ?? "操作失败，请稍后重试。";
}

function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("loomoon_access="));
  return cookie?.slice("loomoon_access=".length);
}

function requireUser(auth: AuthService, request: FastifyRequest): AuthUser {
  const token = bearerToken(request);
  const user = token ? auth.authenticate(token) : undefined;
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
