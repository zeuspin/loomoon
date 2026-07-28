# Fashion Skills Review Design

## Objective

Create an internal Loomoon review page for assessing third-party fashion-related Agent Skills discovered through skills.sh. The page helps a reviewer decide whether Loomoon should adopt, independently rewrite, defer, or reject each candidate. It does not install, execute, publish, or enable any skill.

## Scope

The first review set contains:

- Fashion Model Photography
- Garment Lifestyle Photography
- Fashion Sketch CN
- Seamless Pattern Generation
- Morpheus Fashion Design
- Marvelous Designer Simulation Workflow
- Fashion Styling
- MCS TechPack Creator

The review recommends four possible Loomoon capabilities:

1. 服装系列设计与技术稿
2. 面料印花与连续纹样
3. 时装模特与型录摄影
4. 服装生活方式场景摄影

No video capability is included.

## Audit Method

Every candidate is reviewed without installing dependencies or executing scripts. The evidence model records:

- skills.sh source URL and install count when available;
- source repository and inspected revision;
- files present in the skill package;
- declared and repository-level license information;
- shell, script, executable, filesystem, credential, and network requirements;
- external destinations receiving user assets or prompts;
- compatibility with Loomoon's existing image tools;
- fit with an infinite-canvas workflow;
- reviewer conclusion and remediation requirements.

skills.sh audit badges are displayed only as third-party evidence. Loomoon's conclusion is based on source inspection and remains independent of those badges.

## Decision Classes

### Adopt with adaptation

The candidate is instruction-only, has no unacceptable execution requirement, has a usable license declaration, and can be translated into Loomoon's `SKILL.md` plus `runtime.json` format. Adaptation removes references to unavailable tools and maps the workflow to Loomoon's controlled tools.

### Independent rewrite

The domain workflow is valuable, but the source has no sufficiently clear reuse license or depends on an external service Loomoon will not trust. Loomoon may author an original skill from domain requirements, but must not translate or copy protected wording, examples, or structure from the candidate.

### Defer

The candidate may become useful after Loomoon adds a missing capability or resolves a dependency, but it is not approved for the current runtime.

### Reject

The candidate is irrelevant, deceptive, legally problematic, requests unsafe execution, exposes credentials, sends user assets to an unapproved service, or cannot be reconciled with Loomoon's security boundary.

Rejected candidates cannot be marked for adoption in the review UI.

## Initial Audit Conclusions

### Fashion Model Photography

- Decision: adopt with adaptation.
- Fit: high for editorial, campaign, catalog, and lookbook imagery.
- Runtime: instruction-only; maps to Loomoon image analysis and generation tools.
- License: the skill frontmatter declares Apache-2.0. Adaptation must preserve source attribution and the license declaration.
- Required changes: translate terminology, remove unsupported assumptions, add structured garment/model/reference roles, and use Loomoon confirmation and output planning.

### Garment Lifestyle Photography

- Decision: adopt with adaptation.
- Fit: high for contextual garment imagery and campaign storytelling.
- Runtime: instruction-only; no script is bundled in the inspected skill directory.
- License: the skill frontmatter declares Apache-2.0. Adaptation must preserve source attribution and the license declaration.
- Required changes: translate terminology, enforce product fidelity, expose environment and audience requirements, and use Loomoon tools only.

### Fashion Sketch CN

- Decision: independent rewrite.
- Fit: very high for concept boards, fashion flats, material boards, BOM data, measurements, and tech-pack drafts.
- Runtime: instruction and references only; no executable script in the inspected package.
- License: no clear repository or skill license was found. The original content must not be translated or copied.
- Rewrite boundary: use independently authored fashion-domain requirements and Loomoon's canvas model. Do not reproduce its visual template, wording, table structure, or example prompts.

### Seamless Pattern Generation

- Decision: independent rewrite.
- Fit: very high for textile prints and repeat-pattern exploration.
- Runtime risk: the original workflow sends prompts and credentials to EachLabs through repeated curl requests.
- License: no clear repository or skill license was found.
- Rewrite boundary: use Loomoon's own generation provider and author an original workflow for motifs, repeat previews, colorways, scale tests, and garment mockups.

### Morpheus Fashion Design

- Decision: reject.
- Risk: uploads product, logo, and model images to ComfyDeploy; depends on a fixed external deployment; contains a hard-coded Gemini API key in its bundled script; and has no clear reuse license.
- The skill and script must never be executed in Loomoon.

### Marvelous Designer Simulation Workflow

- Decision: reject.
- Risk: explicitly describes unauthorized commercial-software unlocking, downloads a patch executable, and handles API credentials. It is incompatible with Loomoon's legal and security requirements.

### Fashion Styling

- Decision: reject as irrelevant.
- Reason: this is a project-specific React/CSS restyling guide for a fashion storefront, not a garment-design workflow. It also lacks a clear reusable license.

### MCS TechPack Creator

- Decision: reject as a search false positive.
- Reason: “techpack” refers to packaging Claude Code configuration, not apparel technical specification packages.

## Infinite Canvas Integration

Approved or independently rewritten capabilities should create structured canvas regions instead of returning only prose.

### 服装系列设计与技术稿

```text
设计简报 → 趋势/灵感板 → 系列配色与面料 → 款式正背面图
          → 工艺与尺寸信息 → BOM/Tech Pack 草案
```

### 面料印花与连续纹样

```text
纹样需求 → motif 探索 → repeat 母版 → 平铺接缝预览
          → 比例/配色变化 → 服装应用预览
```

### 时装模特与型录摄影

```text
服装主图 + 模特参考 → 造型与拍摄方案 → 两张样片
                    → 确认 → 型录/Editorial 系列
```

### 服装生活方式场景摄影

```text
服装 + 受众/场景 → 场景板 → 构图与人物动作 → 样片
                 → 确认 → 生活方式系列
```

Every generated result retains its source nodes and appears beside the relevant brief, reference, and plan nodes.

## Route and Page Behavior

Add an internal route:

```text
/skills-review
```

The route is a normal Loomoon shell page and does not modify the agent sidebar or canvas runtime.

The page provides:

- summary counts for candidates, recommended adaptations, independent rewrites, and rejections;
- filters for all, adopt, rewrite, defer, and reject;
- search by skill, source, domain, or risk;
- candidate cards with source facts, audit evidence, canvas fit, permissions, license status, and proposed Chinese capability;
- an expandable evidence panel;
- reviewer choices of adopt, rewrite, defer, or reject where allowed;
- disabled adoption controls for rejected candidates;
- a comparison summary of current decisions;
- local persistence in `localStorage`;
- a copy-as-JSON action for handing decisions back to implementation work.

The page performs no backend write and makes no request to third-party skill services.

## Data Model

Review content is stored as typed local audit data, separate from page components:

```ts
type FashionSkillAudit = {
  id: string;
  sourceName: string;
  sourceUrl: string;
  repositoryUrl: string;
  inspectedRevision: string;
  installCount?: number;
  proposedName?: string;
  domainTags: string[];
  canvasFit: "high" | "medium" | "low" | "none";
  auditConclusion: "adopt" | "rewrite" | "defer" | "reject";
  license: LicenseFinding;
  permissions: PermissionFinding[];
  evidence: AuditEvidence[];
  canvasWorkflow?: CanvasWorkflowStep[];
  remediation: string[];
};
```

Reviewer choices are stored separately so the evidence cannot be edited through the UI.

## Visual System

This page is an extension of Loomoon's existing visual language:

- white and gray surfaces with `#111` primary text;
- restrained red and amber only for security state;
- existing project typography;
- an 8px spacing grid;
- non-circular radii no greater than 4px;
- no decorative gradients;
- border and background hierarchy instead of card shadows;
- 120–180ms state transitions with reduced-motion support;
- a two-column desktop layout with filters/summary on the left and audit cards on the right;
- a single-column responsive layout on narrow viewports.

Facts, external audit claims, and Loomoon recommendations use visibly distinct labels so recommendations are not presented as scanner output.

## V0 Boundary

The first viewable draft includes:

- the route;
- page shell and responsive layout;
- all eight candidate summaries;
- status filters;
- candidate selection controls;
- expandable evidence placeholders backed by real audit text;
- local decision persistence;
- JSON copy output.

It does not create translated skill packages, change the Agent runtime, install dependencies, or provide final production polish. Those actions start only after the reviewer chooses candidates.

## Acceptance

- The page renders inside the existing shell at `/skills-review`.
- It follows the flat-style radius and no-gradient contract.
- All eight candidates are present with the correct conclusion.
- Rejected candidates cannot be selected for adoption.
- Choices survive reload through local storage.
- Exported JSON contains candidate ID, source revision, audit conclusion, reviewer choice, and proposed Loomoon capability.
- Source and repository links are explicit.
- No third-party script, package, API, or image is loaded by the page.
- No concrete candidate logic is embedded in rendering components; the UI is driven by typed audit data.
- Existing application routes and tests continue to pass.
