export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ProjectLaunchIntent {
  id: string;
  projectId: string;
  prompt: string;
  createdAt: string;
}

function storageKey(projectId: string): string {
  return `loomoon:project-launch:${encodeURIComponent(projectId)}`;
}

function isLaunchIntent(value: unknown): value is ProjectLaunchIntent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    Boolean(candidate.id.trim()) &&
    typeof candidate.projectId === "string" &&
    Boolean(candidate.projectId.trim()) &&
    typeof candidate.prompt === "string" &&
    Boolean(candidate.prompt.trim()) &&
    typeof candidate.createdAt === "string" &&
    Boolean(candidate.createdAt.trim())
  );
}

export function queueProjectLaunchIntent(
  storage: KeyValueStorage,
  intent: ProjectLaunchIntent,
): void {
  if (!intent.prompt.trim()) throw new Error("PROJECT_LAUNCH_PROMPT_REQUIRED");
  if (!isLaunchIntent(intent)) throw new Error("INVALID_PROJECT_LAUNCH_INTENT");
  storage.setItem(storageKey(intent.projectId), JSON.stringify(intent));
}

export function consumeProjectLaunchIntent(
  storage: KeyValueStorage,
  projectId: string,
): ProjectLaunchIntent | undefined {
  const key = storageKey(projectId);
  const serialized = storage.getItem(key);
  if (serialized === null) return undefined;
  storage.removeItem(key);
  try {
    const intent: unknown = JSON.parse(serialized);
    if (!isLaunchIntent(intent) || intent.projectId !== projectId) {
      return undefined;
    }
    return intent;
  } catch {
    return undefined;
  }
}
