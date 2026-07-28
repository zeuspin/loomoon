# Image Generator Seed and Model Migration Design

## Goal

Make multi-image generation reliably produce independent variants, expose random and fixed seed modes in the image generator, and automatically recover projects that reference a retired image model.

## Model migration

After the client loads the current image model catalog, each existing image generator is checked against the available model IDs. A valid model selection is preserved. A missing or retired model ID, including the legacy `loomoon-image-v2`, is replaced with the first available model and persisted through the existing canvas save flow.

The API continues to reject arbitrary unknown model IDs. Migration belongs at the project/UI boundary so invalid direct API requests do not silently select a different billable model.

## Seed modes

Generator configuration gains a `seedMode` value of `random` or `fixed` and an optional integer `seed`.

- New and legacy generators default to `random`.
- Random mode creates a fresh cryptographically secure integer in the inclusive range `0` to `2147483647` for every output image. Seeds are independent; no base seed or incrementing sequence is used.
- Fixed mode accepts one integer in the same range and permits exactly one output image.
- Switching from random to fixed automatically changes the output count to one. Two- and four-image controls are disabled while fixed mode is active.
- Switching back to random re-enables multiple output counts without restoring an earlier count implicitly.

The API validates all constraints independently of the UI. A fixed seed with an output count other than one is invalid.

## Provider and persistence flow

The API generation service resolves one seed per output before invoking the provider. It passes that seed in the provider request's `parameters.seed`. The resulting image node and generation-history record retain the actual seed used, enabling future reproducibility features without adding them now.

## Interface

The settings popover adds a compact “随机种子” section below output count:

- Segmented controls: “随机” and “固定”.
- Fixed mode displays a numeric input with the supported range.
- Disabled output-count choices remain visible so the one-image limitation is discoverable.

## Errors and compatibility

- Missing seed-mode fields in saved projects normalize to random mode.
- Invalid fixed seeds and fixed/multi-output combinations return `INVALID_GENERATOR_CONFIG`.
- If no image models are available, no migration occurs and generation remains unavailable.
- Provider errors retain the existing error handling.

## Verification

Tests cover model-ID resolution, legacy configuration defaults, fixed-mode UI constraints, server validation, random-seed uniqueness and range, fixed-seed passthrough, provider request serialization, and seed persistence. Focused suites run first, followed by web/API/provider tests, type checking, and builds.
