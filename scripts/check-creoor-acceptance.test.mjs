import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { validateAcceptance } from "./check-creoor-acceptance.mjs";

async function fixture(overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), "creoor-acceptance-"));
  const specPath = join(root, "spec.md");
  const matrixPath = join(root, "acceptance.json");
  const spec = [
    "| CR-PROD-001 | summary | `CR-PROD-001.A01` path |",
    "| CR-A11Y-001 | summary | `CR-A11Y-001.A01` axe |",
  ].join("\n");
  const matrix = {
    version: 1,
    baselineCommit: "draft",
    rows: [
      {
        parentCr: "CR-PROD-001",
        clause: "CR-PROD-001.A01",
        task: 12,
        automatedTest: "e2e/golden-paths.spec.ts",
        manualStep: "none",
        environment: "chromium",
        threshold: "all assertions pass",
        evidence: [],
        gate: "release",
        status: "planned",
      },
      {
        parentCr: "CR-A11Y-001",
        clause: "CR-A11Y-001.A01",
        task: 11,
        automatedTest: "e2e/accessibility.spec.ts",
        manualStep: "none",
        environment: "chromium",
        threshold: "0 violations",
        evidence: [],
        gate: "release",
        status: "planned",
      },
    ],
    ...overrides,
  };
  await writeFile(specPath, spec, "utf8");
  await writeFile(matrixPath, JSON.stringify(matrix), "utf8");
  return { root, specPath, matrixPath };
}

test("accepts a complete plan-phase clause set", async () => {
  const files = await fixture();
  const result = await validateAcceptance({
    ...files,
    phase: "plan",
    expectedParentCount: 2,
  });
  assert.deepEqual(result, { parents: 2, clauses: 2, phase: "plan" });
});

test("rejects a missing atomic clause", async () => {
  const files = await fixture({
    rows: [
      {
        parentCr: "CR-PROD-001",
        clause: "CR-PROD-001.A01",
        task: 12,
        automatedTest: "e2e/golden-paths.spec.ts",
        manualStep: "none",
        environment: "chromium",
        threshold: "all assertions pass",
        evidence: [],
        gate: "release",
        status: "planned",
      },
    ],
  });
  await assert.rejects(
    validateAcceptance({ ...files, phase: "plan", expectedParentCount: 2 }),
    /clause sets differ/i,
  );
});

test("rejects waived release clauses", async () => {
  const files = await fixture();
  const matrix = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(files.matrixPath, "utf8")));
  matrix.rows[0].status = "waived";
  await writeFile(files.matrixPath, JSON.stringify(matrix), "utf8");
  await assert.rejects(
    validateAcceptance({ ...files, phase: "plan", expectedParentCount: 2 }),
    /release clause cannot be waived/i,
  );
});
