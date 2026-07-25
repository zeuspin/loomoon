type JsonRecord = Record<string, unknown>;

export function parseJsonObject(content: string): JsonRecord {
  const normalized = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const value: unknown = JSON.parse(normalized);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Model response is not a JSON object");
  }
  return value as JsonRecord;
}

export function extractImageUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const output = (payload as JsonRecord).output;
  if (!output || typeof output !== "object") return [];
  const choices = (output as JsonRecord).choices;
  if (!Array.isArray(choices)) return [];

  return choices.flatMap((choice) => {
    if (!choice || typeof choice !== "object") return [];
    const message = (choice as JsonRecord).message;
    if (!message || typeof message !== "object") return [];
    const content = (message as JsonRecord).content;
    if (!Array.isArray(content)) return [];
    return content.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const image = (item as JsonRecord).image;
      return typeof image === "string" ? [image] : [];
    });
  });
}
