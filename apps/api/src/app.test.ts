import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { DemoService, MemoryProjectStore, type DemoProvider } from "./demo-service.js";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthService } from "./auth-service.js";
import type { AgentCoordinator } from "./agent-coordinator.js";

const provider: DemoProvider = {
  async createPlan() {
    return {
      summary: "summary",
      audience: "audience",
      directions: [
        { title: "A", style: "style", composition: "composition", palette: "palette", prompt: "prompt A" },
        { title: "B", style: "style", composition: "composition", palette: "palette", prompt: "prompt B" }
      ]
    };
  },
  async analyzeImages() {
    return "analysis";
  },
  async generateImage() {
    return "data:image/png;base64,AA==";
  }
};

describe("GET /api/v1/health/live", () => {
  it("returns a live status without exposing configuration", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health/live"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "api" });
    expect(response.body).not.toContain("BAILIAN");

    await app.close();
  });
});

describe("demo routes", () => {
  it("reports an active Agent run as a non-retryable conflict", async () => {
    const auth = await AuthService.createDemo();
    const coordinator = {
      sendMessage: async () => {
        throw new Error("AGENT_SESSION_BUSY");
      }
    } as unknown as AgentCoordinator;
    const app = buildApp({ authService: auth, agentCoordinator: coordinator });
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "demo@loomoon.local", password: "loomoon-demo" }
    });
    const token = login.json().accessToken as string;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/agent/sessions/session-1/messages",
      headers: { authorization: `Bearer ${token}` },
      payload: { content: "follow-up" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({
      code: "AGENT_SESSION_BUSY",
      retryable: false
    });
  });

  it("exposes authenticated Agent session, message, and run endpoints", async () => {
    const auth = await AuthService.createDemo();
    const calls: string[] = [];
    const coordinator = {
      createSession: async (userId: string, projectId: string) => {
        calls.push(`session:${userId}:${projectId}`);
        return { id: "session-1", userId, projectId, messageIds: [] };
      },
      getSessionTimeline: async (userId: string, sessionId: string) => {
        calls.push(`timeline:${userId}:${sessionId}`);
        return { session: { id: sessionId }, messages: [] };
      },
      sendMessage: async (input: { userId: string; sessionId: string }) => {
        calls.push(`message:${input.userId}:${input.sessionId}`);
        return { run: { id: "run-1", status: "completed" } };
      },
      getRun: async (userId: string, runId: string) => {
        calls.push(`run:${userId}:${runId}`);
        return { id: runId, status: "completed" };
      },
      confirmAction: async (userId: string, runId: string, actionId: string) => {
        calls.push(`confirm:${userId}:${runId}:${actionId}`);
        return { id: runId, status: "waiting_jobs" };
      },
      cancelAction: async (userId: string, runId: string) => {
        calls.push(`cancel:${userId}:${runId}`);
        return { id: runId, status: "cancelled" };
      }
    } as unknown as AgentCoordinator;
    const app = buildApp({ authService: auth, agentCoordinator: coordinator });
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "demo@loomoon.local", password: "loomoon-demo" }
    });
    const token = login.json().accessToken as string;
    const headers = { authorization: `Bearer ${token}` };

    const session = await app.inject({
      method: "POST",
      url: "/api/v1/projects/project-1/agent/sessions",
      headers
    });
    const sent = await app.inject({
      method: "POST",
      url: "/api/v1/agent/sessions/session-1/messages",
      headers,
      payload: { content: "读取画布", selectedNodeIds: ["node-1"] }
    });
    const timeline = await app.inject({
      method: "GET",
      url: "/api/v1/agent/sessions/session-1",
      headers
    });
    const run = await app.inject({
      method: "GET",
      url: "/api/v1/agent/runs/run-1",
      headers
    });
    const confirmed = await app.inject({
      method: "POST",
      url: "/api/v1/agent/runs/run-1/confirm",
      headers,
      payload: { pendingActionId: "action-1" }
    });
    const cancelled = await app.inject({
      method: "POST",
      url: "/api/v1/agent/runs/run-1/cancel",
      headers
    });

    expect([
      session.statusCode,
      sent.statusCode,
      timeline.statusCode,
      run.statusCode,
      confirmed.statusCode,
      cancelled.statusCode
    ]).toEqual([200, 200, 200, 200, 200, 200]);
    expect(calls).toHaveLength(6);
  });

  it("bootstraps a local project and persists canvas operations with optimistic locking", async () => {
    const service = new DemoService(new MemoryProjectStore(), provider);
    const app = buildApp({ demoService: service });
    const bootstrap = await app.inject({ method: "POST", url: "/api/v1/demo/bootstrap" });
    const project = bootstrap.json();

    expect(bootstrap.statusCode).toBe(200);
    const save = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/canvas/operations`,
      payload: { version: project.canvas.version, nodes: [] }
    });
    expect(save.statusCode).toBe(200);
    expect(save.json().canvas.version).toBe(project.canvas.version + 1);

    const conflict = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/canvas/operations`,
      payload: { version: project.canvas.version, nodes: [] }
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("CANVAS_VERSION_CONFLICT");
  });

  it("serves only files inside the local asset directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-static-"));
    await mkdir(join(root, "public"), { recursive: true });
    await writeFile(join(root, "public", "sample.png"), "image");
    const app = buildApp({ assetsRoot: root });

    const response = await app.inject({ method: "GET", url: "/assets/public/sample.png" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toContain("public");
  });

  it("requires authentication for assets in multi-user mode", async () => {
    const root = await mkdtemp(join(tmpdir(), "loomoon-private-static-"));
    const auth = await AuthService.createDemo();
    const app = buildApp({ assetsRoot: root, authService: auth });

    expect((await app.inject({ method: "GET", url: "/assets/unknown/sample.png" })).statusCode).toBe(401);
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "demo@loomoon.local", password: "loomoon-demo" }
    });
    const userId = login.json().user.id as string;
    await mkdir(join(root, userId), { recursive: true });
    await writeFile(join(root, userId, "sample.png"), "image");
    const response = await app.inject({
      method: "GET",
      url: `/assets/${userId}/sample.png`,
      headers: { authorization: `Bearer ${login.json().accessToken as string}` }
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toContain("private");
    const otherLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "reviewer@loomoon.local", password: "loomoon-review" }
    });
    expect((await app.inject({
      method: "GET",
      url: `/assets/${userId}/sample.png`,
      headers: { authorization: `Bearer ${otherLogin.json().accessToken as string}` }
    })).statusCode).toBe(404);
  });

  it("isolates projects between authenticated demo users", async () => {
    const auth = await AuthService.createDemo();
    const services = new Map<string, DemoService>();
    const app = buildApp({
      authService: auth,
      resolveDemoService: (userId) => {
        let service = services.get(userId);
        if (!service) {
          service = new DemoService(new MemoryProjectStore(), provider);
          services.set(userId, service);
        }
        return service;
      }
    });
    const login = async (email: string, password: string) =>
      app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password } });
    const demoLogin = await login("demo@loomoon.local", "loomoon-demo");
    const reviewerLogin = await login("reviewer@loomoon.local", "loomoon-review");
    const demoToken = demoLogin.json().accessToken as string;
    const reviewerToken = reviewerLogin.json().accessToken as string;
    const demoProject = await app.inject({
      method: "POST",
      url: "/api/v1/demo/bootstrap",
      headers: { authorization: `Bearer ${demoToken}` }
    });
    const reviewerProject = await app.inject({
      method: "POST",
      url: "/api/v1/demo/bootstrap",
      headers: { authorization: `Bearer ${reviewerToken}` }
    });

    expect(demoProject.json().id).not.toBe(reviewerProject.json().id);
    const forbidden = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${demoProject.json().id}`,
      headers: { authorization: `Bearer ${reviewerToken}` }
    });
    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.json().error.code).toBe("PROJECT_NOT_FOUND");
  });
});
