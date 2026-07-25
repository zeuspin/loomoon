import { z } from "zod";

const booleanFromString = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return value;
}, z.boolean());

const bailianApiKey = z
  .string()
  .trim()
  .min(1, "BAILIAN_API_KEY is required")
  .refine(
    (value) => value !== "replace-with-your-bailian-api-key",
    "BAILIAN_API_KEY must be replaced with a real key"
  );

export const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  PUBLIC_APP_URL: z.url(),
  DEMO_PROVIDER: z.enum(["bailian", "mock"]).default("bailian"),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  JWT_SIGNING_KEY: z.string().min(32),
  BAILIAN_BASE_URL: z.url(),
  BAILIAN_API_KEY: bailianApiKey,
  BAILIAN_AGENT_MODEL: z.string().min(1),
  BAILIAN_FAST_MODEL: z.string().min(1),
  BAILIAN_IMAGE_MODEL: z.string().min(1),
  BAILIAN_IMAGE_FALLBACK_MODEL: z.string().min(1),
  BAILIAN_DRAFT_IMAGE_MODEL: z.string().min(1).optional(),
  BAILIAN_MASK_EDIT_MODEL: z.string().min(1).optional(),
  ENABLE_LEGACY_MASK_EDIT: booleanFromString.default(false)
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  source: Record<string, string | undefined>
): ServerEnv {
  return serverEnvSchema.parse(source);
}
