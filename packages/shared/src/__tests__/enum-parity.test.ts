// Parity test: shared Zod enums MUST match the Prisma schema enums one-to-one.
// Uses Node's built-in test runner (node:test) — no extra dependency.
//
// Run: node --test (via `pnpm --filter shared test`)
//
// The Prisma enum values are mirrored here as the "expected" source, read from
// apps/api/prisma/schema.prisma at test time so drift on either side fails.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  classificationSchema,
  recommendedActionSchema,
  reviewerActionSchema,
  supervisorActionSchema,
  ruleOutcomeSchema,
  caseStatusSchema,
  consistencyFlagSchema,
  confidenceLevelSchema,
} from "../enums.ts";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, "../../../../apps/api/prisma/schema.prisma");
const schemaSrc = readFileSync(schemaPath, "utf-8");

/** Parse `enum Name { A B // comment\n C }` from the Prisma schema. */
function prismaEnum(name: string): string[] {
  const m = schemaSrc.match(new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`Prisma enum ${name} not found in schema.prisma`);
  return m[1]
    .split("\n")
    .map((l) => l.split("//")[0].trim())
    .filter(Boolean);
}

const cases: Array<[string, readonly string[], string]> = [
  ["Classification", classificationSchema.options, "Classification"],
  ["RecommendedAction", recommendedActionSchema.options, "RecommendedAction"],
  ["ReviewerAction", reviewerActionSchema.options, "ReviewerAction"],
  ["SupervisorAction", supervisorActionSchema.options, "SupervisorAction"],
  ["RuleOutcome", ruleOutcomeSchema.options, "RuleOutcome"],
  ["CaseStatus", caseStatusSchema.options, "CaseStatus"],
  ["ConsistencyFlag", consistencyFlagSchema.options, "ConsistencyFlag"],
  ["ConfidenceLevel", confidenceLevelSchema.options, "ConfidenceLevel"],
];

for (const [label, sharedValues, prismaName] of cases) {
  test(`${label} matches Prisma enum one-to-one`, () => {
    const expected = [...prismaEnum(prismaName)].sort();
    const actual = [...sharedValues].sort();
    assert.deepEqual(actual, expected, `Shared enum ${label} diverged from Prisma ${prismaName}`);
  });
}
