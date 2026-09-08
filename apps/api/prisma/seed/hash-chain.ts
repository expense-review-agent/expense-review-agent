import { createHash } from "node:crypto";

/**
 * AuditEvent hash chain helper.
 * hash = sha256(prevHash || caseId || seq || type || payload || createdAt)
 * Matches the formula documented on the AuditEvent model in schema.prisma.
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
