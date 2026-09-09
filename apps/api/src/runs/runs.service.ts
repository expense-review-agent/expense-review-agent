import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { computeAuditHash } from "../common/hash-chain";
import type { CreateRunResponse, RunStateResponse } from "@expense-review-agent/shared";

/**
 * RunsService — 非同步 Agent 初審（對應 API #8/#9）。
 *
 * DEMO 級判定：M1 沒有完整規則引擎。這裡示範「非同步契約」：
 * - create() 建立一個 ReviewRun，立刻回 202 + runId（不阻塞）。
 * - 判定用最簡化的方式：沿用該案件既有 currentRun 的分類（seed 已算好），
 *   或標記為 SUCCEEDED。真正的規則引擎屬後續 change（見 backlog / design）。
 *
 * 這樣設計的用意：之後 Phase 2 接 OCR / 真引擎時，只換 runner 內部實作，
 * 不動這個 API 契約（POST 回 202、GET 輪詢狀態）。
 */
@Injectable()
export class RunsService {
  private readonly ENGINE_VERSION = "m1-review-engine@0.1.0";

  constructor(private readonly prisma: PrismaService) {}

  /** #8 POST /api/cases/:id/runs — 建立 run，回 202 + runId。 */
  async create(caseId: string): Promise<CreateRunResponse> {
    const c = await this.prisma.expenseCase.findUnique({
      where: { id: caseId },
      include: { currentRun: true, reviewRuns: true },
    });
    if (!c) throw new NotFoundException(`Case ${caseId} not found`);

    const roundNo = (c.reviewRuns?.length ?? 0) + 1;

    // DEMO 判定：沿用既有 currentRun 的結果（seed 已算好），沒有就先給預設。
    const prev = c.currentRun;
    const run = await this.prisma.reviewRun.create({
      data: {
        caseId,
        roundNo,
        status: "SUCCEEDED", // DEMO：同步算完就標成功
        engineVersion: this.ENGINE_VERSION,
        policyVersionId: c.policyVersionId,
        classification: prev?.classification ?? "NORMAL",
        recommendedAction: prev?.recommendedAction ?? "APPROVE",
        confidenceLevel: prev?.confidenceLevel ?? "HIGH",
      },
    });

    // 記一筆稽核事件（run 完成）
    await this.appendAudit(caseId, "RUN_COMPLETED", {
      runId: run.id,
      classification: run.classification,
    });

    return { runId: run.id, status: "SUCCEEDED" };
  }

  /** #9 GET /api/runs/:runId — 查詢 run 狀態。 */
  async state(runId: string): Promise<RunStateResponse> {
    const run = await this.prisma.reviewRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    return {
      runId: run.id,
      status: run.status,
      caseId: run.caseId,
      classification: run.classification,
    };
  }

  /** 附加一筆 hash-chained 稽核事件（append-only）。 */
  private async appendAudit(
    caseId: string,
    type: string,
    payload: Prisma.InputJsonObject,
  ): Promise<void> {
    const last = await this.prisma.auditEvent.findFirst({
      where: { caseId },
      orderBy: { seq: "desc" },
    });
    const seq = (last?.seq ?? 0) + 1;
    const createdAt = new Date();
    const hash = computeAuditHash({
      prevHash: last?.hash ?? null,
      caseId,
      seq,
      type,
      payload,
      createdAt,
    });
    await this.prisma.auditEvent.create({
      data: {
        caseId,
        seq,
        type: type as never,
        actorLabel: "system:review-engine",
        payload,
        prevHash: last?.hash ?? null,
        hash,
        createdAt,
      },
    });
  }
}
