const baseUrl = process.env.LOOMOON_API_URL ?? "http://localhost:3000";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} -> ${response.status}`);
  return payload;
}

const login = await request("/api/v1/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: "demo@loomoon.local", password: "loomoon-demo" })
});
const headers = { Authorization: `Bearer ${login.accessToken}` };
let project;
try {
  project = await request("/api/v1/projects", {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "100 节点性能验收" })
  });
  const nodes = Array.from({ length: 100 }, (_, index) => ({
    id: crypto.randomUUID(),
    type: "text",
    x: (index % 10) * 240,
    y: Math.floor(index / 10) * 120,
    width: 220,
    height: 90,
    text: `性能节点 ${index + 1}`
  }));
  const saveStartedAt = performance.now();
  const saved = await request(`/api/v1/projects/${project.id}/canvas/operations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ version: project.canvas.version, nodes })
  });
  const saveDurationMs = Math.round(performance.now() - saveStartedAt);

  const readStartedAt = performance.now();
  const reads = await Promise.all(
    Array.from({ length: 5 }, () => request(`/api/v1/projects/${project.id}`, { headers }))
  );
  const concurrentReadDurationMs = Math.round(performance.now() - readStartedAt);
  const passed =
    saved.canvas.nodes.length === 100 &&
    reads.every((value) => value.canvas.nodes.length === 100) &&
    saveDurationMs < 5_000 &&
    concurrentReadDurationMs < 5_000;
  console.log(JSON.stringify({
    status: passed ? "ok" : "failed",
    nodeCount: saved.canvas.nodes.length,
    concurrentUsers: reads.length,
    saveDurationMs,
    concurrentReadDurationMs
  }, null, 2));
  if (!passed) process.exitCode = 1;
} finally {
  if (project?.id) {
    await request(`/api/v1/projects/${project.id}`, { method: "DELETE", headers });
  }
}
