import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

import {
  resolveDisposition,
  isLegalDisposition,
  computeAuditHash,
} from "@expense-review-agent/shared";
import type {
  DispositionRequest,
  DispositionResponse,
  SupervisorReviewRequest,
  AuditTrailResponse,
} from "@expense-review-agent/shared";

/**
 * ReviewService — 人工處置、主管稽核、稽核軌跡（對應 API #10/#11/#6）。
 *
 * 領域規則重點（來自 CLAUDE.md，最不能出錯的地方）：
 * - Reviewer 動作必須用 shared 的合法動作矩陣驗證，非法動作回 400（不進 DB）。
 * - 需要理由的處置留白 → 回 400。
 * - MANUAL_REVIEW + ACCEPT → escalate（轉呈主管，不下最終結論）。
 * - 處置與稽核事件在同一 transaction 寫入（要嘛都成功、要嘛都不寫）。
 * - Disposition / SupervisorReview / AuditEvent 是 append-only（DB trigger 保證）。
 */
@Injectable()
export class ReviewService {
  // demo 用的固定 actor（M1 無登入系統）
  private readonly DEMO_REVIEWER_EMAIL = "reviewer@example.test";
  private readonly DEMO_SUPERVISOR_EMAIL = "supervisor@example.test";

  constructor(private readonly prisma: PrismaService) {}

  /** #10 POST /api/cases/:id/disposition */
  async disposition(caseId: string, body: DispositionRequest): Promise<DispositionResponse> {
    const run = await this.prisma.reviewRun.findUnique({
      where: { id: body.runId },
    });
    if (!run || run.caseId !== caseId) {
      throw new NotFoundException("Run not found for this case");
    }
    const recommendation = run.recommendedAction;
    if (!recommendation) {
      throw new BadRequestException("Run has no recommended action");
    }

    // 1) 用 shared 矩陣驗證動作合法性（非法 → 400，不進 DB）
    if (!isLegalDisposition(recommendation, body.action)) {
      throw new BadRequestException(
        `Illegal action "${body.action}" for recommendation "${recommendation}"`,
      );
    }
    const rule = resolveDisposition(recommendation, body.action);

    // 2) 計算一致性徽章 + 判斷是否需要理由
    const consistencyFlag = this.computeConsistencyFlag(body.action, rule.escalates);

    // 需要理由卻留白 → 400（同時也是 DB CHECK 會擋的條件，這裡先擋給好錯誤訊息）
    const reasonRequired =
      rule.reasonRequired ||
      consistencyFlag === "OVERRIDDEN" ||
      consistencyFlag === "HUMAN_ASSUMED";
    if (reasonRequired && !body.reason?.trim()) {
      throw new BadRequestException("This action requires a reason");
    }

    const actor = await this.demoUser(this.DEMO_REVIEWER_EMAIL);

    // 3) 交易：寫 Disposition + AuditEvent（同生共死）
    const result = await this.prisma.$transaction(async (tx) => {
      const disposition = await tx.disposition.create({
        data: {
          caseId,
          runId: run.id,
          actorId: actor.id,
          action: body.action,
          agentClassificationAtDecision: run.classification,
          agentActionAtDecision: run.recommendedAction,
          finalClassification: run.classification,
          finalAction: run.recommendedAction,
          consistencyFlag,
          reason: body.reason ?? null,
          resultingStatus: rule.resultingStatus,
        },
      });

      // 更新案件狀態
      await tx.expenseCase.update({
        where: { id: caseId },
        data: { status: rule.resultingStatus },
      });

      // 附稽核事件（hash chain）
      await this.appendAudit(tx, caseId, "REVIEWER_DISPOSITION", {
        dispositionId: disposition.id,
        action: body.action,
        escalated: rule.escalates ?? false,
      });

      return disposition;
    });

    return {
      dispositionId: result.id,
      resultingStatus: rule.resultingStatus,
      consistencyFlag,
    };
  }

  /** #11 POST /api/cases/:id/supervisor-review */
  async supervisorReview(caseId: string, body: SupervisorReviewRequest) {
    // FLAG_CONCERN 必附 comment（也是 DB CHECK 條件）
    if (body.action === "FLAG_CONCERN" && !body.comment?.trim()) {
      throw new BadRequestException("FLAG_CONCERN requires a comment");
    }
    const c = await this.prisma.expenseCase.findUnique({ where: { id: caseId } });
    if (!c) throw new NotFoundException(`Case ${caseId} not found`);

    const actor = await this.demoUser(this.DEMO_SUPERVISOR_EMAIL);
    // 主管退回一律回 QUEUED（CLAUDE.md）
    const resultingStatus = body.action === "RETURN_TO_REVIEWER" ? "QUEUED" : null;

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.supervisorReview.create({
        data: {
          caseId,
          actorId: actor.id,
          action: body.action,
          comment: body.comment ?? null,
          resultingStatus,
        },
      });
      if (resultingStatus) {
        await tx.expenseCase.update({
          where: { id: caseId },
          data: { status: resultingStatus },
        });
      }
      await this.appendAudit(tx, caseId, "SUPERVISOR_REVIEW", {
        supervisorReviewId: review.id,
        action: body.action,
      });
      return { supervisorReviewId: review.id, resultingStatus };
    });
  }

  /** #6 GET /api/cases/:id/audit — 稽核軌跡 + chain 驗證 */
  async audit(caseId: string): Promise<AuditTrailResponse> {
    const events = await this.prisma.auditEvent.findMany({
      where: { caseId },
      orderBy: { seq: "asc" },
    });

    // 重算 hash chain，驗證有沒有被竄改
    let prevHash: string | null = null;
    let chainValid = true;
    for (const e of events) {
      const expected = computeAuditHash({
        prevHash,
        caseId: e.caseId,
        seq: e.seq,
        type: e.type,
        payload: e.payload,
        createdAt: e.createdAt,
      });
      if (expected !== e.hash || e.prevHash !== prevHash) {
        chainValid = false;
      }
      prevHash = e.hash;
    }

    return {
      events: events.map((e) => ({
        seq: e.seq,
        type: e.type,
        actorLabel: e.actorLabel,
        payload: (e.payload as Record<string, unknown>) ?? {},
        createdAt: e.createdAt.toISOString(),
        hash: e.hash,
      })),
      chainValid,
    };
  }

  // ---- helpers ----

  /** 一致性徽章計算（DEMO 版）。ACCEPT=一致；escalate=轉呈；其餘=覆寫。 */
  private computeConsistencyFlag(
    action: string,
    escalates?: boolean,
  ): "CONSISTENT" | "OVERRIDDEN" | "HUMAN_ASSUMED" | "ESCALATED" | "REASON_MISSING" {
    if (action === "ACCEPT") return escalates ? "ESCALATED" : "CONSISTENT";
    if (action === "MANUAL_JUDGEMENT") return "HUMAN_ASSUMED";
    return "OVERRIDDEN";
  }

  private async demoUser(email: string) {
    const u = await this.prisma.user.findFirst({ where: { email } });
    if (!u) throw new NotFoundException(`Demo user ${email} not seeded`);
    return u;
  }

  /** 在交易內附一筆 hash-chained 稽核事件。 */
  private async appendAudit(
    tx: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0],
    caseId: string,
    type: string,
    payload: Prisma.InputJsonObject,
  ): Promise<void> {
    const last = await tx.auditEvent.findFirst({
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
    await tx.auditEvent.create({
      data: {
        caseId,
        seq,
        type: type as never,
        actorLabel: "system:review-api",
        payload,
        prevHash: last?.hash ?? null,
        hash,
        createdAt,
      },
    });
  }
}
