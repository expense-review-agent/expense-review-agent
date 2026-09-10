import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

import {
  resolveDisposition,
  isLegalDisposition,
  deriveConsistencyFlag,
  computeAuditHash,
} from "@expense-review-agent/shared";
import type {
  DispositionRequest,
  DispositionResponse,
  SupervisorReviewRequest,
  AuditTrailResponse,
  RecommendedAction,
  ReviewerAction,
} from "@expense-review-agent/shared";

/**
 * ReviewService — 人工處置、主管稽核、稽核軌跡（對應 API #10/#11/#6）。
 *
 * 領域規則重點（來自 CLAUDE.md，最不能出錯的地方）：
 * - Reviewer 動作必須用 shared 的合法動作矩陣驗證，非法動作回 400（不進 DB）。
 * - 需要理由的處置留白 → 回 400。
 * - MANUAL_REVIEW + ACCEPT → escalate（轉呈主管，不下最終結論）。
 * - finalAction / finalClassification 記錄「人工」的結論，不是 Agent 建議的複本。
 * - 一致性徽章由 shared 的 deriveConsistencyFlag() 依 finalAction 與
 *   agentActionAtDecision 算出後固化寫入；api 端不得自行實作算式。
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

    // 2) finalAction 的帶法驗證（在碰 DB 前擋下）
    //    MANUAL_JUDGEMENT 的結論由 UI modal 指定，必填；其餘動作的結論由動作本身
    //    決定，若也帶 finalAction 就一律拒絕——靜默忽略會讓前端誤以為它生效了。
    if (body.action === "MANUAL_JUDGEMENT" && !body.finalAction) {
      throw new BadRequestException("MANUAL_JUDGEMENT requires a finalAction");
    }
    if (body.action !== "MANUAL_JUDGEMENT" && body.finalAction) {
      throw new BadRequestException(
        `finalAction is only accepted for MANUAL_JUDGEMENT, not "${body.action}"`,
      );
    }

    // 3) 人工最終結論。這是「人」的結論，不是 Agent 建議的複本。
    const finalAction = this.resolveFinalAction(body.action, recommendation, body.finalAction);

    // 分類是 Agent 的判定語彙，人工不重新分類——只有在人工採用了 Agent 的結論時，
    // 分類才等同 Agent 分類；人工改了結論就無從反推分類（MANUAL_REVIEW 可能來自
    // EXCEPTION 或 HUMAN），留 null 而不硬湊一個 Agent 從未做出的判定。
    const finalClassification =
      finalAction !== null && finalAction === run.recommendedAction ? run.classification : null;

    // 4) 一致性徽章：唯一算式在 shared，api 不自行實作
    const { flag: consistencyFlag, reasonRequired: flagNeedsReason } = deriveConsistencyFlag({
      agentActionAtDecision: run.recommendedAction,
      finalAction,
    });

    // 需要理由卻留白 → 400（同時也是 DB CHECK 會擋的條件，這裡先擋給好錯誤訊息）
    const reasonRequired = Boolean(rule.reasonRequired) || flagNeedsReason;
    if (reasonRequired && !body.reason?.trim()) {
      throw new BadRequestException("This action requires a reason");
    }

    const actor = await this.demoUser(this.DEMO_REVIEWER_EMAIL);

    // 5) 交易：寫 Disposition + AuditEvent（同生共死）
    const result = await this.prisma.$transaction(async (tx) => {
      const disposition = await tx.disposition.create({
        data: {
          caseId,
          runId: run.id,
          actorId: actor.id,
          action: body.action,
          agentClassificationAtDecision: run.classification,
          agentActionAtDecision: run.recommendedAction,
          finalClassification,
          finalAction,
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
      // payload 帶上人工結論與徽章，稽核頁不必回查 Disposition 表即可讀出結論
      await this.appendAudit(tx, caseId, "REVIEWER_DISPOSITION", {
        dispositionId: disposition.id,
        action: body.action,
        finalAction,
        consistencyFlag,
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

  /**
   * 由 Reviewer 動作推導人工最終結論。
   *
   * - ACCEPT           → 採用 Agent 建議，結論等於決策當下的建議
   * - REQUEST_INFO     → 退回補件
   * - MANUAL_JUDGEMENT → UI modal 指定（呼叫端已驗證必填）
   * - HOLD             → 保留待處理，尚未下結論
   *
   * 徽章不看這裡的動作標籤，只看推導出的結論——算式在 shared。
   */
  private resolveFinalAction(
    action: ReviewerAction,
    recommendation: RecommendedAction,
    specified: RecommendedAction | undefined,
  ): RecommendedAction | null {
    switch (action) {
      case "ACCEPT":
        return recommendation;
      case "REQUEST_INFO":
        return "REQUEST_INFO";
      case "MANUAL_JUDGEMENT":
        return specified ?? null;
      case "HOLD":
        return null;
    }
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
