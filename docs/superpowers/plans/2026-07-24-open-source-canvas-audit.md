# Open-source Canvas Repository Audit Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task.

**Goal:** Produce a source-backed architecture and product-fit assessment of eight open-source candidates for a Lovart-like infinite-canvas Agent product backed by private ComfyUI infrastructure.

**Architecture:** Keep all upstream repositories as unmodified shallow clones under `research/repos`. Generate normalized, source-cited findings under `research/analysis`, separating verified implementation facts from architectural inference and product recommendations.

**Tech Stack:** Git, PowerShell, ripgrep, JavaScript/TypeScript, Python, Vue, React, FastAPI, ComfyUI HTTP/WebSocket APIs.

## Global Constraints

- Do not modify upstream repository contents.
- Record repository commit SHAs so findings remain reproducible.
- Treat README claims separately from verified source implementations.
- Evaluate commercial-use restrictions and copyleft obligations explicitly.
- Optimize recommendations for private-datacenter ComfyUI workflow execution.

---

### Task 1: Acquire and inventory repositories

**Files:**
- Create: `research/analysis/repository-inventory.md`
- Create: `research/analysis/repository-snapshots.json`

**Interfaces:**
- Consumes: the eight GitHub repository URLs supplied by the user.
- Produces: immutable commit SHAs, disk locations, branch names, dependency manifests, and license locations.

- [ ] Clone every repository with `--depth 1` into `research/repos/<owner>__<repo>`.
- [ ] Record HEAD SHA, commit date, default branch, tags, repository size, and detected manifests.
- [ ] Verify that no clone has local modifications.

### Task 2: Identify canvas and state-management foundations

**Files:**
- Create: `research/analysis/canvas-foundations.md`

**Interfaces:**
- Consumes: repository snapshots from Task 1.
- Produces: the canvas engine, graph/state model, persistence format, collaboration mechanism, undo/redo model, and extension points for each candidate.

- [ ] Inspect dependency manifests and imports for tldraw, React Flow/Xyflow, Vue Flow, Fabric, Konva, Pixi, Excalidraw, and custom canvas engines.
- [ ] Trace the primary canvas component to node/shape serialization.
- [ ] Trace selection, edges, grouping, undo/redo, and project persistence.
- [ ] Distinguish reusable SDK architecture from application-specific canvas code.

### Task 3: Trace Agent execution architecture

**Files:**
- Create: `research/analysis/agent-runtime.md`

**Interfaces:**
- Consumes: tool schemas, Agent prompts, chat endpoints, runtime packages, and canvas mutation APIs.
- Produces: a comparable Agent-loop model for every repository.

- [ ] Locate planner loops, tool definitions, model adapters, memory/context construction, and streaming protocols.
- [ ] Verify whether Agents can inspect and mutate canvas state or only generate media.
- [ ] Trace cancellation, retry, checkpointing, human approval, and multi-Agent behavior.
- [ ] Identify hard-coded model/vendor dependencies.

### Task 4: Trace media generation and ComfyUI integration

**Files:**
- Create: `research/analysis/comfyui-integration.md`

**Interfaces:**
- Consumes: generation providers, workflow loaders, queue clients, upload/download handlers, and media result models.
- Produces: an integration-cost estimate for private ComfyUI clusters.

- [ ] Locate direct ComfyUI HTTP and WebSocket clients.
- [ ] Verify workflow JSON parameter mapping, asset upload, progress, cancellation, result retrieval, and error handling.
- [ ] Trace asynchronous job infrastructure, storage, concurrency, and retry behavior.
- [ ] Assess the changes required for a multi-tenant ComfyUI gateway and GPU scheduler.

### Task 5: Evaluate product and operational completeness

**Files:**
- Create: `research/analysis/product-capabilities.md`

**Interfaces:**
- Consumes: verified implementations from Tasks 2–4.
- Produces: a Lovart capability matrix that marks implemented, partial, claimed-only, and absent functionality.

- [ ] Audit image/video/audio/text generation, storyboarding, timelines, layer editing, object editing, brand kits, consistency controls, export formats, and asset libraries.
- [ ] Audit authentication, projects, permissions, collaboration, tenancy, observability, deployment, and data migration.
- [ ] Note implementation maturity and test coverage for critical paths.

### Task 6: Audit licenses and upstream risk

**Files:**
- Create: `research/analysis/license-and-maintenance-risk.md`

**Interfaces:**
- Consumes: repository licenses, package licenses, contribution notes, release metadata, and commit history.
- Produces: commercial-use constraints and maintenance-risk ratings.

- [ ] Quote and cite exact upstream license files and additional README restrictions.
- [ ] Flag AGPL, source-available, commercial-license, trademark, and contradictory-license issues.
- [ ] Assess bus factor, release discipline, migration stability, and divergence between community and commercial editions.

### Task 7: Produce recommendation and target architecture

**Files:**
- Create: `research/analysis/final-recommendation.md`

**Interfaces:**
- Consumes: all preceding audit reports.
- Produces: a ranked shortlist, build-vs-fork decision, target architecture, phased implementation estimate, and PoC plan.

- [ ] Recalculate product-fit and foundation-fit scores using source evidence.
- [ ] Recommend one rapid-fork route and one long-term proprietary-foundation route.
- [ ] Define the boundary between canvas client, Agent runtime, ComfyUI gateway, scheduler, and asset service.
- [ ] Specify a minimal PoC that can falsify the recommendation before a full fork.

### Task 8: Verification

**Files:**
- Verify: `research/analysis/*.md`
- Verify: `research/analysis/repository-snapshots.json`

**Interfaces:**
- Consumes: all audit artifacts.
- Produces: a reproducible and internally consistent evidence package.

- [ ] Check that every factual claim cites a repository path and commit SHA.
- [ ] Search reports for unsupported placeholders or claimed-only features presented as implemented.
- [ ] Confirm all eight repositories are covered in every comparison.
- [ ] Confirm upstream clones remain clean and unmodified.
