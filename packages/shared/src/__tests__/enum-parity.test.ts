// shared 的詞彙必須與 Prisma schema 的 enum 一一對應，否則前後端與 DB 會各說各話。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ACTOR_TYPES,
  AUDIT_EVENT_TYPES,
  CASE_STATUSES,
  CHECK_STATUSES,
  FINDING_KINDS,
  RECOMMENDATIONS,
  REVIEW_DIMENSIONS,
  REVIEW_SOURCES,
  WORKFLOW_ACTIONS,
} from "../domain/vocabulary.ts";

const schema = readFileSync(
  new URL("../../../../apps/api/prisma/schema.prisma", import.meta.url),
  "utf8",
);

function prismaEnum(name: string): string[] {
  const match = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema);
  assert.ok(match, `schema.prisma 找不到 enum ${name}`);
  return match[1]!
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter(Boolean);
}

const pairs: Array<[string, readonly string[]]> = [
  ["CaseStatus", CASE_STATUSES],
  ["Recommendation", RECOMMENDATIONS],
  ["ReviewDimension", REVIEW_DIMENSIONS],
  ["CheckStatus", CHECK_STATUSES],
  ["FindingKind", FINDING_KINDS],
  ["WorkflowAction", WORKFLOW_ACTIONS],
  ["ActorType", ACTOR_TYPES],
  ["ReviewSource", REVIEW_SOURCES],
  ["AuditEventType", AUDIT_EVENT_TYPES],
];

for (const [name, values] of pairs) {
  test(`enum ${name} 與 shared 詞彙一致`, () => {
    assert.deepEqual(prismaEnum(name), [...values]);
  });
}
