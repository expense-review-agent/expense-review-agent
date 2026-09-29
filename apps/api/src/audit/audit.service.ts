import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { computeAuditHash } from "@expense-review-agent/shared";
import type { ActorType, AuditEventType, AuditTrailResponse } from "@expense-review-agent/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  type: AuditEventType;
  actorType: ActorType;
  actorLabel: string;
  payload: Prisma.InputJsonObject;
}

/**
 * AuditService — hash-chained 稽核事件。
 *
 * 寫入一律在呼叫端的交易內進行，與它記錄的動作同生共死。
 * AuditEvent 是 append-only（DB trigger 保證）；`(caseId, seq)` unique，
 * 兩個交易同時寫入同一案件時，後到的會因 seq 衝突而整筆回滾。
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async append(tx: Prisma.TransactionClient, caseId: string, entry: AuditEntry): Promise<void> {
    const last = await tx.auditEvent.findFirst({ where: { caseId }, orderBy: { seq: "desc" } });
    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.hash ?? null;
    const createdAt = new Date();
    const hash = computeAuditHash({
      prevHash,
      caseId,
      seq,
      type: entry.type,
      payload: entry.payload,
      createdAt,
    });
    await tx.auditEvent.create({
      data: {
        caseId,
        seq,
        type: entry.type,
        actorType: entry.actorType,
        actorLabel: entry.actorLabel,
        payload: entry.payload,
        prevHash,
        hash,
        createdAt,
      },
    });
  }

  /** 稽核軌跡，並重算 hash chain 驗證沒有被竄改或缺號。 */
  async trail(caseId: string): Promise<AuditTrailResponse> {
    const events = await this.prisma.auditEvent.findMany({
      where: { caseId },
      orderBy: { seq: "asc" },
    });

    let prevHash: string | null = null;
    let chainValid = true;
    for (const [index, e] of events.entries()) {
      const expected = computeAuditHash({
        prevHash,
        caseId: e.caseId,
        seq: e.seq,
        type: e.type,
        payload: e.payload,
        createdAt: e.createdAt,
      });
      if (e.seq !== index + 1 || e.prevHash !== prevHash || e.hash !== expected) {
        chainValid = false;
      }
      prevHash = e.hash;
    }

    return {
      events: events.map((e) => ({
        seq: e.seq,
        type: e.type,
        actorType: e.actorType,
        actorLabel: e.actorLabel,
        payload: (e.payload ?? {}) as Record<string, unknown>,
        createdAt: e.createdAt.toISOString(),
        hash: e.hash,
      })),
      chainValid,
    };
  }
}
