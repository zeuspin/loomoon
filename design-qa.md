# Design QA — Xingliu unauthenticated home

- Source visual truth: `/Users/xuke/Desktop/截屏2026-07-25 下午10.38.54.png`
- Implementation: `http://localhost:6001/`
- Implementation screenshot: `docs/design-qa-assets/xingliu-home-implementation-final.png`
- Combined comparison: `docs/design-qa-assets/xingliu-home-comparison-final.png`
- Source pixels: 2950 × 1544 (`@2x` capture)
- Normalized source: 1475 × 772 CSS-equivalent pixels
- Implementation comparison crop: 1475 × 772 CSS pixels
- State: desktop, logged out, light theme, composer empty

## Full-view comparison evidence

The source and implementation were placed in one side-by-side image after density normalization. The final pass aligns the header, hero center, rail, 730px composer, quick actions, inspiration heading, category row, and five-column first viewport.

## Focused comparison evidence

The hero/composer and inspiration-header regions were inspected separately in the combined image. A separate crop was unnecessary after normalization because both regions remain legible at full comparison resolution.

## Required fidelity surfaces

- Fonts and typography: PingFang/system Chinese stack, title weight, muted subtitle, prompt, category and chip hierarchy match the source. The Loomoon wordmark is the explicitly permitted brand exception.
- Spacing and layout rhythm: hero center is offset to account for the left rail; title, composer, quick chips, inspiration heading and five-column content align within single-digit CSS-pixel tolerance.
- Colors and tokens: white canvas, near-black type, gray subtitle/borders, disabled send state and subtle elevation match the source.
- Image quality and assets: placeholder photos were replaced with locally bundled Xingliu UGC cover assets. Images retain their original WebP bytes and aspect treatment.
- Copy and content: header actions, hero subtitle, quick actions and inspiration categories match the source. Rotating prompt text intentionally changes over time as in Xingliu.

## Comparison history

### Initial pass — blocked

- P1: global flat-style selector forced homepage pills and circular controls into square 2px corners.
- P1: inspiration content rendered four columns and was substantially too narrow/inset.
- P1: hero and inspiration vertical positions differed by roughly 60–150px.
- P2: header lacked `回到星流Beta`; navigation and composer used text glyphs instead of matching outline icons.
- Fixes: scoped the flat policy to the legacy workspace, restored source radii, implemented five columns, recalibrated section spacing, added the missing header action, and adopted Remix outline icons.

### Second pass — blocked

- P2: accurate CSS viewport comparison showed the hero needed a 57px content offset and the rail/inspiration rhythm needed further correction.
- Fixes: applied the hero offset, matched the rail position, corrected top padding and section spacing, and used real Xingliu cover assets.

### Final pass

- No actionable P0/P1/P2 mismatch remains for the supplied logged-out desktop screenshot.
- P3: UGC contents are live/dynamic on Xingliu, so individual card artwork may change independently of the layout.

## Interactions checked

- Rotating composer prompt
- Logged-out protected actions opening login
- Header actions
- Quick-prompt controls
- Inspiration category controls and card grid
- Browser console: no errors

## Final result

final result: passed

---

# Design QA — Xingliu Canvas

- Source visual truth: `docs/xingliu-feature-audit-2026-07-25/03-canvas-overview.png`
- Implementation: `http://localhost:6001/canvas?projectId=5c1a83d9-6048-43e7-94d0-7c7b202456c0`
- Implementation screenshot: `docs/design-qa-assets/canvas-current-final.png`
- Combined comparison: `docs/design-qa-assets/canvas-comparison-final.png`
- State: desktop, logged in, mock showcase project, Agent result completed

## Comparison findings

- P0/P1: none after the final pass.
- P2 fixed: removed the legacy full-width toolbar, restored the gray infinite-canvas background, matched the floating left tool rail and inset right Agent panel, recalibrated artwork positions after the 72% stage transform, removed the unrelated selected-object command strip, and moved zoom controls next to the Agent boundary.
- P2 fixed: replaced text-symbol approximations in the persistent Canvas and Agent toolbars with Remix outline icons.
- P2 fixed: the Agent panel now receives the live Canvas node set and presents a generated-result preview, completion text, feedback actions, and a bottom composer in the same hierarchy as the reference.
- P3: mock project artwork differs from the captured Xingliu generation. Its layout, aspect treatment, row rhythm, and selected-result state are reproduced; generated content remains intentionally mocked.
- Explicit exception: Loomoon branding replaces the Xingliu logo.

## Interactions checked

- Add-tool popover opens and closes.
- Zoom increases from 72% to 82%; “适应” restores the default view.
- Canvas items remain selectable and draggable; selected images are forwarded to the Agent composer.
- Agent history/files/share/close controls remain wired.
- Mobile breakpoint uses full-width Canvas sizing, a bottom horizontal tool rail, and a fixed 82vh Agent drawer.
- Browser runtime: no application errors observed; Vite development and React DevTools messages only.

## Toolbar interaction correction

The earlier toolbar pass was invalid because it compared only the collapsed silhouette. A second audit clicked the live Xingliu controls and measured the expanded states.

- Collapsed rail: seven 44px controls inside a 50px white rail, 8px selected background, and a divider before image/video generation.
- Add menu: 200px wide, 185px high, single-column rows for upload image, upload video, and smart artboard, including the `F` shortcut.
- Shape menu: two labeled rows matching Xingliu’s shape and shape-text icon groups.
- Text: inserts and selects a canvas text object.
- Pencil: enters a persistent active mode, disables canvas panning, uses a crosshair cursor, and draws freehand strokes.
- Image/video generation: creates and selects a generator artboard, changes zoom to 51%, and opens the matching floating generator composer below the artboard.
- Evidence: `docs/design-qa-assets/canvas-toolbar-add-final.png`, `docs/design-qa-assets/canvas-toolbar-shape-final.png`, and `docs/design-qa-assets/canvas-toolbar-image-generator-final.png`.

## Verification

- `pnpm --filter @loomoon/web test` — 52 tests passed.
- `pnpm --filter @loomoon/web typecheck` — passed.
- `pnpm --filter @loomoon/web build` — passed (bundle-size warning only).

## Final result

final result: passed for the supplied desktop Canvas reference; mobile behavior is implemented but awaits a Xingliu mobile source screenshot for pixel-level visual comparison.

---

# Interaction QA — New project and Agent isolation

- Date: 2026-07-27
- Browser: user-selected Chrome
- Desktop viewport: browser default
- Mobile viewport: 390 × 844
- Mock login: `demo@loomoon.local`

## Desktop checks

- Home recent-project “新建项目” created project `80479dca-3c75-484d-879b-511c419be510` and navigated to its canonical Canvas URL.
- The new project rendered an empty infinite Canvas, an empty Agent conversation, no selected layer, and the disabled empty composer state.
- Homepage prompt “验收：为夏日气泡水设计一张极简社交海报” created project `6fce291b-a3fb-49f0-bcc4-2ff02433ac15`.
- The prompt appeared immediately as the first user message with `发送中...`, then reconciled to the persisted timeline without duplication and produced the mock creative-direction response.
- Canvas project-menu creation produced project `86dd2526-77bf-4b26-887e-c131dcf3567e`, updated the URL, and displayed no messages from the preceding prompt project.
- Browser Back restored the prompt project's URL, project title, user prompt, Agent response and pending creative plan.

## Mobile checks

- At 390 × 844, the homepage composer, recent-project creation card and inspiration sections remained reachable.
- The mobile navigation opened and exposed the global “新建项目” control without clipping.
- The temporary viewport override was reset after verification.

## Automated verification

- `pnpm test` — passed: API 44 tests, Agent UI 22 tests, Web 92 tests, plus all remaining workspace suites.
- `pnpm typecheck` — passed across all workspaces.
- `pnpm build` — passed; only the existing Vite chunk-size warning remains.

## Final result

final result: passed for blank project creation, URL-driven project switching, project-scoped Agent conversations, homepage first-message handoff, desktop behavior and the 390 × 844 mobile entry points.
