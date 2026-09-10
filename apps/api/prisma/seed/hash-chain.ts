import { createHash } from "node:crypto";

// =============================================================================
// AuditEvent hash chain helper（seed 用）。
// ⚠️ 必須與 packages/shared/src/hash-chain.ts 邏輯完全一致——seed 與 api 寫入的
//    hash 才能被同一套驗證還原。改這裡也要改那裡。
//    （seed 用 node --experimental-strip-types 直接跑 .ts，故保留本地副本，
//      不 import workspace dist，避免額外的模組解析風險。）
//
// 穩定設計：payload 用 sorted-key 序列化（避開 JSONB 重排）、createdAt 用毫秒整數。
// =============================================================================

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

export function computeAuditHash(input: {
  prevHash: string | null;
  caseId: string;
  seq: number;
  type: string;
  payload: unknown;
  createdAt: Date;
}): string {
  const canonical = [
    input.prevHash ?? "",
    input.caseId,
    String(input.seq),
    input.type,
    stableStringify(input.payload ?? {}),
    String(input.createdAt.getTime()),
  ].join("||");
  return createHash("sha256").update(canonical).digest("hex");
}
