const baseUrl = process.env.LOOMOON_API_URL ?? "http://localhost:3000";
const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "demo@loomoon.local", password: "loomoon-demo" })
});
const login = await loginResponse.json();
const bootstrapResponse = await fetch(`${baseUrl}/api/v1/demo/bootstrap`, {
  method: "POST",
  headers: { Authorization: `Bearer ${login.accessToken}` }
});
const project = await bootstrapResponse.json();
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5_000);
try {
  const response = await fetch(`${baseUrl}/api/v1/projects/${project.id}/events`, {
    headers: { Authorization: `Bearer ${login.accessToken}` },
    signal: controller.signal
  });
  const reader = response.body.getReader();
  const { value } = await reader.read();
  const firstEvent = new TextDecoder().decode(value);
  const passed = response.status === 200 && firstEvent.includes("event: project") && firstEvent.includes("data:");
  console.log(JSON.stringify({ status: passed ? "ok" : "failed", event: "project" }, null, 2));
  if (!passed) process.exitCode = 1;
  await reader.cancel();
} finally {
  clearTimeout(timeout);
}
