import "dotenv/config";
import { parseServerEnv } from "@loomoon/config";
import { Worker } from "bullmq";

const env = parseServerEnv(process.env);
const redisUrl = new URL(env.REDIS_URL);

const worker = new Worker(
  "image-generation",
  async (job) => {
    throw new Error(`No image processor registered for job ${job.id}`);
  },
  {
    connection: {
      host: redisUrl.hostname,
      port: redisUrl.port ? Number(redisUrl.port) : 6379,
      password: redisUrl.password || undefined,
      db: redisUrl.pathname.length > 1 ? Number(redisUrl.pathname.slice(1)) : 0
    },
    autorun: false
  }
);

await worker.run();
