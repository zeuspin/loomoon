process.loadEnvFile?.(".env");

const apiKey = process.env.BAILIAN_API_KEY;
const baseUrl = process.env.BAILIAN_BASE_URL;
const model = process.env.BAILIAN_AGENT_MODEL;
if (!apiKey || !baseUrl || !model) {
  throw new Error("BAILIAN_API_KEY、BAILIAN_BASE_URL 和 BAILIAN_AGENT_MODEL 必须配置在根目录 .env");
}

const startedAt = Date.now();
const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "只回复 LOOMOON_MODEL_OK" }],
    max_tokens: 32
  }),
  signal: AbortSignal.timeout(30_000)
});
const payload = await response.json();
if (!response.ok) {
  const requestId = payload?.request_id ?? response.headers.get("x-request-id") ?? "unknown";
  throw new Error(`百炼模型检查失败：HTTP ${response.status}，requestId=${requestId}`);
}
console.log(JSON.stringify({
  status: "ok",
  configuredModel: model,
  responseModel: payload.model ?? model,
  requestId: payload.request_id ?? payload.id ?? "unknown",
  durationMs: Date.now() - startedAt
}, null, 2));
