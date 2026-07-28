# Repository Guidelines

## Project Structure & Module Organization

Loomoon is a pnpm TypeScript monorepo. Deployable applications live in `apps/`: `web` is the React/Vite/Konva client, `api` is the Fastify service, and `worker-image` processes BullMQ image jobs. Reusable code belongs in `packages/`, including contracts, canvas domain logic, agent runtime/UI, configuration, persistence, and design tokens. Keep tests beside their implementation as `*.test.ts` or `*.test.tsx`. Infrastructure definitions are under `infra/` and `docker-compose.yml`; operational, API, architecture, and acceptance documentation belongs in `docs/`. Repository-level verification utilities live in `scripts/`.

## Build, Test, and Development Commands

Use Node.js 24+ and pnpm 11+.

- `pnpm install`: install all workspace dependencies.
- `pnpm dev`: build shared packages, then run the API and web app.
- `pnpm dev:mock`: run the same flow with a no-cost mock model provider.
- `pnpm build`: build every workspace package and application.
- `pnpm test`: run all Vitest suites.
- `pnpm typecheck`: run strict TypeScript checks across the workspace.
- `pnpm lint`: run the repository's current lint gate (TypeScript checks).
- `pnpm env:check`: validate `.env`; copy `.env.example` before local setup.
- `pnpm demo:verify:mock`: exercise the mock end-to-end demo path.

Target one workspace with filters, for example `pnpm --filter @loomoon/web test`.

## Coding Style & Naming Conventions

Use TypeScript ES modules, two-space indentation, double quotes, and semicolons. Preserve strict compiler settings, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Name React components and exported types in PascalCase, functions and variables in camelCase, and source files in kebab-case (for example, `canvas-state.ts`). Import local TypeScript modules with `.js` extensions where required by NodeNext. No standalone formatter is configured, so follow nearby code and keep changes focused.

## Testing Guidelines

Vitest is the test framework. Add or update colocated tests for behavior changes; prefer descriptive `describe` blocks and outcome-focused `it` statements. There is no enforced coverage threshold, but critical API authorization, agent state, canvas operations, and persistence paths should receive regression tests. Run `pnpm test` and `pnpm typecheck` before submitting.

## Commit & Pull Request Guidelines

The current history uses a short, imperative summary (for example, `Initialize Loomoon agent canvas demo.`). Keep commits narrowly scoped and explain non-obvious decisions in the body. Pull requests should summarize behavior and architecture changes, link relevant issues or design docs, list verification commands, and include screenshots or recordings for UI work. Never commit `.env`, API keys, `.local-data/`, or generated build output.
