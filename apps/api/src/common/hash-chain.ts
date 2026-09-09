import { createHash } from "node:crypto";

/**
 * AuditEvent hash chain helper（與 prisma/seed/hash-chain.ts 同一公式）。
 * hash = sha256(prevHash || caseId || seq || type || payload || createdAt)
 *
 * 之所以複製一份在 api：seed 是獨立用 node 跑的腳本，api 是 NestJS 執行期。
 * 兩處必須用「同一個公式」，chain 驗證才會一致（見 design.md Open Question：
 * 未來可抽到 packages/shared 共用）。
 */
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
    JSON.stringify(input.payload ?? {}),
    input.createdAt.toISOString(),
  ].join("||");
  return createHash("sha256").update(canonical).digest("hex");
}
