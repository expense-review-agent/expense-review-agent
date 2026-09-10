import { createHash } from "node:crypto";

// =============================================================================
// AuditEvent hash chain helper（前後端 + seed 共用的唯一實作）
// hash = sha256(prevHash || caseId || seq || type || payloadCanonical || createdAtMs)
//
// 兩個關鍵設計，避免「寫入時算的 hash」與「從 DB 讀回重算的 hash」對不上：
//
// 1. payload 穩定序列化（stableStringify）：
//    PostgreSQL 的 JSONB 會正規化 JSON、重排 key。若直接 JSON.stringify，
//    寫入時與讀回時的 key 順序可能不同 → hash 不一致。這裡遞迴地把物件 key
//    排序後再序列化，讓任何 key 順序都得到同一個字串。
//
// 2. createdAt 用「毫秒整數」而非 ISO 字串：
//    DB 欄位是 TIMESTAMP(3)（毫秒精度）。用 getTime()（毫秒 epoch 整數）當輸入，
//    避免 ISO 字串在時區/精度序列化上的任何差異。寫入與讀回都取 getTime()，
//    毫秒精度下必定一致。
// =============================================================================

/** 遞迴穩定序列化：物件 key 依字典序排序，確保輸出與 key 順序無關。 */
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
    String(input.createdAt.getTime()), // 毫秒 epoch，避免 ISO 精度差異
  ].join("||");
  return createHash("sha256").update(canonical).digest("hex");
}
