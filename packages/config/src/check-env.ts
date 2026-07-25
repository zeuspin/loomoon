import { parseServerEnv } from "./env.js";

try {
  const env = parseServerEnv(process.env);

  console.log("Environment configuration is valid.");
  console.log(`API: ${env.API_HOST}:${env.API_PORT}`);
  console.log(`Agent model: ${env.BAILIAN_AGENT_MODEL}`);
  console.log(`Image model: ${env.BAILIAN_IMAGE_MODEL}`);
  console.log(`Legacy mask edit: ${String(env.ENABLE_LEGACY_MASK_EDIT)}`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Environment configuration is invalid: ${message}`);
  process.exitCode = 1;
}
