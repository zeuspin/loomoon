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
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} -> ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function login(email, password) {
  return request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

const checks = [];
let temporaryProject;
try {
  const health = await request("/api/v1/health/live");
  checks.push(["API health", health.status === "ok"]);

  const demo = await login("demo@loomoon.local", "loomoon-demo");
  const reviewer = await login("reviewer@loomoon.local", "loomoon-review");
  const demoHeaders = { Authorization: `Bearer ${demo.accessToken}` };
  const reviewerHeaders = { Authorization: `Bearer ${reviewer.accessToken}` };

  temporaryProject = await request("/api/v1/projects", {
    method: "POST",
    headers: demoHeaders,
    body: JSON.stringify({ name: "自动验收 · 可删除" })
  });
  checks.push(["Project creation", Boolean(temporaryProject.id)]);

  const planResult = await request(`/api/v1/projects/${temporaryProject.id}/agent/messages`, {
    method: "POST",
    headers: demoHeaders,
    body: JSON.stringify({
      content: "为青柠气泡水设计清爽、年轻、略带未来感的社交媒体主视觉",
      selectedNodeIds: []
    })
  });
  checks.push(["Real Bailian plan has 2 directions", planResult.plan?.directions?.length === 2]);

  const projectBeforeConfirmation = await request(`/api/v1/projects/${temporaryProject.id}`, {
    headers: demoHeaders
  });
  checks.push([
    "No paid image result before confirmation",
    projectBeforeConfirmation.canvas.nodes.filter((node) => node.type === "image").length === 0
  ]);
  checks.push([
    "Persistent confirmation grant",
    projectBeforeConfirmation.confirmations.some(
      (grant) => grant.id === planResult.plan.id && grant.status === "pending" && grant.taskCount === 4
    )
  ]);
  checks.push([
    "Audit trail",
    projectBeforeConfirmation.auditLog.some((event) => event.action === "create_creative_plan")
  ]);

  const onePixelPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const withUpload = await request(`/api/v1/projects/${temporaryProject.id}/assets/uploads`, {
    method: "POST",
    headers: demoHeaders,
    body: JSON.stringify({ dataUrl: onePixelPng })
  });
  const uploadedUrl = withUpload.canvas.nodes.findLast((node) => node.assetUrl)?.assetUrl;
  const ownAsset = await fetch(`${baseUrl}${uploadedUrl}`, { headers: demoHeaders });
  const crossAsset = await fetch(`${baseUrl}${uploadedUrl}`, { headers: reviewerHeaders });
  checks.push(["Owner can download scoped asset", ownAsset.status === 200]);
  checks.push(["Other user cannot download scoped asset", crossAsset.status === 404]);

  const crossAccess = await fetch(`${baseUrl}/api/v1/projects/${temporaryProject.id}`, {
    headers: reviewerHeaders
  });
  checks.push(["Cross-user project access rejected without existence leak", crossAccess.status === 404]);

  const failed = checks.filter(([, passed]) => !passed);
  console.table(checks.map(([check, passed]) => ({ check, result: passed ? "PASS" : "FAIL" })));
  if (failed.length > 0) process.exitCode = 1;
} finally {
  if (temporaryProject?.id) {
    const demo = await login("demo@loomoon.local", "loomoon-demo");
    await request(`/api/v1/projects/${temporaryProject.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${demo.accessToken}` }
    });
  }
}
