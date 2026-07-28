import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PARENT_PATTERN = /\bCR-[A-Z0-9]+-[0-9]{3}\b(?!\.A)/g;
const CLAUSE_PATTERN = /\bCR-[A-Z0-9]+-[0-9]{3}\.A[0-9]{2}\b/g;
const VALID_GATES = new Set(["release", "waivable"]);
const VALID_STATUSES = new Set(["planned", "passed", "failed", "waived"]);

function uniqueMatches(text, pattern) {
  return [...new Set(text.match(pattern) ?? [])].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function requireText(row, key) {
  if (typeof row[key] !== "string" || row[key].trim() === "") {
    throw new Error(`${row.clause ?? "unknown clause"}: ${key} is required`);
  }
}

export async function validateAcceptance({
  specPath,
  matrixPath,
  phase = "plan",
  expectedParentCount = 21,
}) {
  const [spec, matrixText] = await Promise.all([
    readFile(specPath, "utf8"),
    readFile(matrixPath, "utf8"),
  ]);
  const matrix = JSON.parse(matrixText);
  if (!Array.isArray(matrix.rows)) throw new Error("acceptance rows must be an array");

  const parents = uniqueMatches(spec, PARENT_PATTERN);
  const clauses = uniqueMatches(spec, CLAUSE_PATTERN);
  if (parents.length !== expectedParentCount) {
    throw new Error(`expected ${expectedParentCount} parent CR IDs, got ${parents.length}`);
  }
  if (clauses.length === 0) throw new Error("no atomic acceptance clauses found");

  const rowClauses = matrix.rows.map((row) => row.clause);
  if (new Set(rowClauses).size !== rowClauses.length) throw new Error("duplicate acceptance clause row");
  const missing = difference(clauses, rowClauses);
  const extra = difference(rowClauses, clauses);
  if (missing.length || extra.length) {
    throw new Error(`clause sets differ; missing=${missing.join(",")}; extra=${extra.join(",")}`);
  }

  for (const row of matrix.rows) {
    if (!parents.includes(row.parentCr)) throw new Error(`${row.clause}: unknown parent CR`);
    if (!row.clause.startsWith(`${row.parentCr}.`)) throw new Error(`${row.clause}: parent mismatch`);
    if (!Number.isInteger(row.task) || row.task < 0 || row.task > 13) throw new Error(`${row.clause}: invalid task`);
    for (const key of ["automatedTest", "manualStep", "environment", "threshold"]) requireText(row, key);
    if (!Array.isArray(row.evidence)) throw new Error(`${row.clause}: evidence must be an array`);
    if (!VALID_GATES.has(row.gate)) throw new Error(`${row.clause}: invalid gate`);
    if (!VALID_STATUSES.has(row.status)) throw new Error(`${row.clause}: invalid status`);
    if (row.gate === "release" && row.status === "waived") {
      throw new Error(`${row.clause}: release clause cannot be waived`);
    }
    if (phase === "release" && row.gate === "release" && row.status !== "passed") {
      throw new Error(`${row.clause}: release clause is not passed`);
    }
    if (phase === "release") {
      if (row.evidence.length === 0) throw new Error(`${row.clause}: release evidence is required`);
      for (const evidence of row.evidence) {
        requireText({ clause: row.clause, value: evidence.path }, "value");
        requireText({ clause: row.clause, value: evidence.sha256 }, "value");
        await access(resolve(evidence.path));
      }
    }
  }

  return { parents: parents.length, clauses: clauses.length, phase };
}

async function main() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const phaseArg = process.argv.find((arg) => arg.startsWith("--phase="));
  const phase = phaseArg?.split("=")[1] ?? "plan";
  const result = await validateAcceptance({
    specPath: resolve(root, "docs/superpowers/specs/2026-07-28-creoor-workbench-design.md"),
    matrixPath: resolve(root, "docs/development/creoor-acceptance.json"),
    phase,
  });
  process.stdout.write(`Creoor acceptance ${result.phase}: ${result.parents} parents, ${result.clauses} clauses\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
