import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DemoProject } from "@loomoon/contracts";
import { DemoService, JsonProjectStore, type DemoProvider } from "./demo-service.js";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  status: "empty" | "planning" | "generating" | "ready" | "attention";
  coverUrl?: string;
}

interface CatalogEntry {
  id: string;
  name: string;
  updatedAt: string;
  file: string;
}

export class ProjectRegistry {
  readonly #services = new Map<string, DemoService>();

  constructor(
    private readonly root: string,
    private readonly provider: DemoProvider,
    private readonly materializeAsset: (userId: string, url: string) => Promise<string>
  ) {}

  async list(userId: string): Promise<ProjectSummary[]> {
    const entries = await this.#readCatalog(userId);
    return Promise.all(entries.map(async (entry) => {
      try {
        const project = JSON.parse(
          await readFile(resolve(this.#userRoot(userId), entry.file), "utf8")
        ) as DemoProject;
        const coverUrl = project.canvas.nodes.findLast(
          (node) => node.type === "image" && node.status === "succeeded" && node.assetUrl
        )?.assetUrl;
        return {
          id: project.id,
          name: project.name,
          updatedAt: project.canvas.updatedAt,
          status: projectStatus(project),
          ...(coverUrl ? { coverUrl } : {})
        };
      } catch {
        return { id: entry.id, name: entry.name, updatedAt: entry.updatedAt, status: "attention" as const };
      }
    }));
  }

  async create(userId: string, name: string): Promise<DemoProject> {
    const normalized = name.trim();
    if (!normalized) throw new Error("PROJECT_NAME_REQUIRED");
    const file = `${crypto.randomUUID()}.json`;
    const service = new DemoService(
      new JsonProjectStore(resolve(this.#userRoot(userId), file)),
      this.provider,
      (url) => this.materializeAsset(userId, url),
      userId
    );
    let project = await service.bootstrap();
    project = await service.renameProject(project.id, normalized);
    const entries = await this.#readCatalog(userId);
    entries.push({
      id: project.id,
      name: project.name,
      updatedAt: project.canvas.updatedAt,
      file
    });
    await this.#writeCatalog(userId, entries);
    this.#services.set(this.#key(userId, project.id), service);
    return project;
  }

  async defaultProject(userId: string): Promise<DemoProject> {
    const [first] = await this.list(userId);
    if (!first) return this.create(userId, "我的视觉创作");
    return this.resolve(userId, first.id);
  }

  async resolve(userId: string, projectId: string): Promise<DemoProject> {
    const service = await this.service(userId, projectId);
    return service.getProject(projectId);
  }

  async service(userId: string, projectId: string): Promise<DemoService> {
    const key = this.#key(userId, projectId);
    const cached = this.#services.get(key);
    if (cached) return cached;
    const entry = (await this.#readCatalog(userId)).find((item) => item.id === projectId);
    if (!entry) throw new Error("PROJECT_NOT_FOUND");
    const service = new DemoService(
      new JsonProjectStore(resolve(this.#userRoot(userId), entry.file)),
      this.provider,
      (url) => this.materializeAsset(userId, url),
      userId
    );
    this.#services.set(key, service);
    return service;
  }

  async rename(userId: string, projectId: string, name: string): Promise<DemoProject> {
    const service = await this.service(userId, projectId);
    const project = await service.renameProject(projectId, name);
    const entries = await this.#readCatalog(userId);
    const entry = entries.find((item) => item.id === projectId)!;
    entry.name = project.name;
    entry.updatedAt = project.canvas.updatedAt;
    await this.#writeCatalog(userId, entries);
    return project;
  }

  async delete(userId: string, projectId: string): Promise<void> {
    const entries = await this.#readCatalog(userId);
    const entry = entries.find((item) => item.id === projectId);
    if (!entry) throw new Error("PROJECT_NOT_FOUND");
    const remaining = entries.filter((item) => item.id !== projectId);
    await this.#writeCatalog(userId, remaining);
    this.#services.delete(this.#key(userId, projectId));
    await rm(resolve(this.#userRoot(userId), entry.file), { force: true });
  }

  async #readCatalog(userId: string): Promise<CatalogEntry[]> {
    try {
      return JSON.parse(await readFile(resolve(this.#userRoot(userId), "index.json"), "utf8")) as CatalogEntry[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async #writeCatalog(userId: string, entries: CatalogEntry[]): Promise<void> {
    const root = this.#userRoot(userId);
    await mkdir(root, { recursive: true });
    await writeFile(resolve(root, "index.json"), JSON.stringify(entries, null, 2), "utf8");
  }

  #userRoot(userId: string): string {
    if (!/^[a-z0-9-]+$/i.test(userId)) throw new Error("INVALID_USER_ID");
    return resolve(this.root, "projects", userId);
  }

  #key(userId: string, projectId: string): string {
    return `${userId}:${projectId}`;
  }
}

function projectStatus(project: DemoProject): ProjectSummary["status"] {
  if (project.plans.some((plan) => plan.status === "awaiting_confirmation")) return "planning";
  if (project.canvas.nodes.some((node) => node.status === "running" || node.status === "queued")) return "generating";
  if (project.canvas.nodes.some((node) => node.status === "failed")) return "attention";
  if (project.canvas.nodes.some((node) => node.type === "image")) return "ready";
  return "empty";
}
