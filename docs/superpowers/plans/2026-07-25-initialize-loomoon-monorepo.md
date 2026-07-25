# Initialize Loomoon Monorepo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the empty Loomoon repository as a runnable TypeScript monorepo with Web, API, image Worker, shared packages, local infrastructure, and a Git-ignored location for the Bailian API key.

**Architecture:** Use a pnpm workspace with three applications and focused shared packages. Fastify exposes health endpoints, the Worker validates its configuration at startup, and React/Vite provides the initial Web shell. PostgreSQL, Redis, and MinIO run through Docker Compose; secrets live only in the root `.env`.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript, React, Vite, Fastify, BullMQ, Drizzle ORM, PostgreSQL, Redis, MinIO, Zod, Vitest, Docker Compose.

## Global Constraints

- Keep `/research/repos/` outside Git.
- Never commit `.env`, API keys, MinIO credentials, JWT keys, or database passwords.
- Commit `.env.example` with safe placeholders only.
- Use pnpm workspaces and TypeScript project boundaries.
- Production modules must not access `process.env` outside `packages/config`.
- Do not expose `BAILIAN_API_KEY` through Vite-prefixed variables or browser responses.
- Use tests first for configuration and health behavior.

---

### Task 1: Workspace and secret boundary

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.npmrc`
- Create: `.env.example`
- Create locally, ignored: `.env`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Node.js 24 and pnpm 11 installed on the development machine.
- Produces: workspace scripts `dev`, `build`, `test`, `typecheck`, `lint`; root environment keys consumed by `@loomoon/config`.

- [ ] **Step 1: Extend `.gitignore` before creating secrets**

Add:

```gitignore
/.env
/.env.*
!/.env.example
/node_modules/
/.pnpm-store/
**/dist/
**/.vite/
**/coverage/
/.superpowers/
```

- [ ] **Step 2: Create root workspace manifests**

`package.json`:

```json
{
  "name": "loomoon",
  "private": true,
  "packageManager": "pnpm@11.9.0",
  "engines": { "node": ">=24.0.0" },
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: Create safe environment templates**

`.env.example` contains non-secret local defaults and placeholders:

```dotenv
NODE_ENV=development
API_HOST=0.0.0.0
API_PORT=3000
PUBLIC_APP_URL=http://localhost:5173

DATABASE_URL=postgresql://loomoon:loomoon@localhost:5432/loomoon
REDIS_URL=redis://localhost:6379

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=loomoon-assets
S3_ACCESS_KEY_ID=loomoon
S3_SECRET_ACCESS_KEY=change-me

JWT_SIGNING_KEY=change-me-to-a-long-random-value

BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BAILIAN_API_KEY=replace-with-your-bailian-api-key
BAILIAN_AGENT_MODEL=qwen3.7-plus-2026-05-26
BAILIAN_FAST_MODEL=qwen3.6-flash-2026-04-16
BAILIAN_IMAGE_MODEL=wan2.7-image-pro
BAILIAN_IMAGE_FALLBACK_MODEL=qwen-image-2.0-pro-2026-06-22
BAILIAN_DRAFT_IMAGE_MODEL=wan2.7-image
BAILIAN_MASK_EDIT_MODEL=wanx2.1-imageedit
ENABLE_LEGACY_MASK_EDIT=false
```

Create `.env` by copying `.env.example`; leave `BAILIAN_API_KEY=replace-with-your-bailian-api-key` for the user to replace locally.

- [ ] **Step 4: Verify the secret is ignored**

Run:

```powershell
git check-ignore -v .env
git status --short
```

Expected: `.env` is ignored and `.env.example` is untracked/tracked normally; no API key content appears in `git diff`.

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json pnpm-workspace.yaml tsconfig.base.json .npmrc .env.example
git commit -m "chore: initialize pnpm workspace and environment template"
```

### Task 2: Typed configuration package

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.json`
- Create: `packages/config/src/env.test.ts`
- Create: `packages/config/src/env.ts`
- Create: `packages/config/src/index.ts`

**Interfaces:**
- Consumes: environment names defined in `.env.example`.
- Produces: `parseServerEnv(source: NodeJS.ProcessEnv): ServerEnv` and `serverEnvSchema`.

- [ ] **Step 1: Write failing configuration tests**

```ts
import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env.js";

const valid = {
  NODE_ENV: "development",
  API_HOST: "0.0.0.0",
  API_PORT: "3000",
  PUBLIC_APP_URL: "http://localhost:5173",
  DATABASE_URL: "postgresql://loomoon:loomoon@localhost:5432/loomoon",
  REDIS_URL: "redis://localhost:6379",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "loomoon-assets",
  S3_ACCESS_KEY_ID: "loomoon",
  S3_SECRET_ACCESS_KEY: "secret",
  JWT_SIGNING_KEY: "a".repeat(32),
  BAILIAN_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  BAILIAN_API_KEY: "sk-test",
  BAILIAN_AGENT_MODEL: "qwen3.7-plus-2026-05-26",
  BAILIAN_FAST_MODEL: "qwen3.6-flash-2026-04-16",
  BAILIAN_IMAGE_MODEL: "wan2.7-image-pro",
  BAILIAN_IMAGE_FALLBACK_MODEL: "qwen-image-2.0-pro-2026-06-22",
  ENABLE_LEGACY_MASK_EDIT: "false"
};

describe("parseServerEnv", () => {
  it("parses valid configuration and coerces numeric and boolean values", () => {
    const env = parseServerEnv(valid);
    expect(env.API_PORT).toBe(3000);
    expect(env.ENABLE_LEGACY_MASK_EDIT).toBe(false);
  });

  it("rejects a missing Bailian API key", () => {
    expect(() => parseServerEnv({ ...valid, BAILIAN_API_KEY: "" }))
      .toThrow(/BAILIAN_API_KEY/);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm --filter @loomoon/config test
```

Expected: FAIL because `./env.js` does not exist.

- [ ] **Step 3: Implement the Zod schema and parser**

Implement `parseServerEnv` with URL validation, API port coercion, a minimum 32-character JWT key, required Bailian key, fixed model defaults, and boolean preprocessing for `ENABLE_LEGACY_MASK_EDIT`.

- [ ] **Step 4: Run tests and typecheck**

```bash
pnpm --filter @loomoon/config test
pnpm --filter @loomoon/config typecheck
```

Expected: all config tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/config pnpm-lock.yaml
git commit -m "feat: add validated server configuration"
```

### Task 3: Runnable API, Web, and Worker shells

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/app.test.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/main.ts`
- Create: `apps/worker-image/package.json`
- Create: `apps/worker-image/tsconfig.json`
- Create: `apps/worker-image/src/main.ts`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app.tsx`
- Create: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `parseServerEnv` from `@loomoon/config`.
- Produces: Fastify `buildApp()`, API health endpoint, Worker startup validation, and Lovart-style placeholder workspace.

- [ ] **Step 1: Write the failing API health test**

```ts
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("GET /api/v1/health/live", () => {
  it("returns a live status without exposing configuration", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health/live"
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "api" });
    expect(response.body).not.toContain("BAILIAN");
  });
});
```

- [ ] **Step 2: Run the API test and verify RED**

```bash
pnpm --filter @loomoon/api test
```

Expected: FAIL because `buildApp` does not exist.

- [ ] **Step 3: Implement minimal runnable applications**

Implement:

- `buildApp()` with `GET /api/v1/health/live`;
- API entrypoint that loads root `.env`, validates `@loomoon/config`, and listens;
- Worker entrypoint that loads and validates the same environment, connects to Redis, and registers an empty `image-generation` BullMQ consumer;
- React shell matching the approved top bar, left tool rail, canvas center, and right Agent panel without generation behavior.

- [ ] **Step 4: Verify apps**

```bash
pnpm --filter @loomoon/api test
pnpm -r typecheck
pnpm -r build
```

Expected: health test passes; all packages typecheck; all applications build.

- [ ] **Step 5: Commit**

```bash
git add apps packages pnpm-lock.yaml
git commit -m "feat: add runnable web api and image worker shells"
```

### Task 4: Local infrastructure and developer documentation

**Files:**
- Create: `docker-compose.yml`
- Create: `infra/postgres/init.sql`
- Create: `infra/minio/init.sh`
- Create: `README.md`
- Create: `docs/development/environment.md`

**Interfaces:**
- Consumes: environment variables from root `.env`.
- Produces: PostgreSQL on 5432, Redis on 6379, MinIO API on 9000, MinIO Console on 9001, and documented local commands.

- [ ] **Step 1: Write a configuration validation command**

Add root script:

```json
"env:check": "pnpm --filter @loomoon/config env:check"
```

The command must parse `.env`, print only non-secret service/model names, and exit non-zero for placeholder or missing `BAILIAN_API_KEY`.

- [ ] **Step 2: Run it and verify RED**

```bash
pnpm env:check
```

Expected: FAIL with a safe message identifying `BAILIAN_API_KEY`; the key value is not printed.

- [ ] **Step 3: Add Docker Compose and documentation**

Compose must use named volumes and health checks for PostgreSQL, Redis, and MinIO. Documentation must instruct the user to:

```powershell
Copy-Item .env.example .env
# Edit .env and replace BAILIAN_API_KEY locally.
docker compose up -d postgres redis minio minio-init
pnpm install
pnpm env:check
pnpm dev
```

The README must list:

- Web: `http://localhost:5173`
- API: `http://localhost:3000/api/v1/health/live`
- MinIO Console: `http://localhost:9001`
- the exact location `.env` for the Bailian key;
- a warning never to use a `VITE_` prefix for server secrets.

- [ ] **Step 4: Verify infrastructure configuration**

```bash
docker compose config
pnpm env:check
pnpm test
pnpm typecheck
pnpm build
git status --short --ignored
```

Expected:

- Compose configuration renders without errors;
- environment validation succeeds after a real local key is provided;
- tests, typecheck, and build exit 0;
- `.env`, `.superpowers/`, and `/research/repos/` are ignored.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml infra README.md docs/development package.json pnpm-lock.yaml
git commit -m "chore: add local infrastructure and setup documentation"
```

