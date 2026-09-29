import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  batchCompleteRequestSchema,
  validateBatchComplete,
  validateWorkflowAction,
  workflowActionRequestSchema,
} from "@expense-review-agent/shared";
import type {
  BatchCompleteResponse,
  CaseStatus,
  Recommendation,
  WorkflowAction,
  WorkflowActionResponse,
} from "@expense-review-agent/shared";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { toActionRecord } from "./mappers";

/** 本輪沒有登入；處理者一律記為示範角色。 */
const DEMO_ACTOR_LABEL = "財務初審人員";

/** 取案件與最新一筆審查紀錄（含是否已處理）。 */
const latestReviewInclude = {
  reviews: { orderBy: { seq: "desc" }, take: 1, include: { action: true } },
} satisfies Prisma.ExpenseCaseInclude;

type CaseWithLatest = Prisma.ExpenseCaseGetPayload<{ include: typeof latestReviewInclude }>;

function latestOf(c: CaseWithLatest) {
  const latest = c.reviews[0];
  if (!latest) throw new Error(`案件 ${c.caseNumber} 沒有審查紀錄`);
  return latest;
}

/**
 * WorkflowService — 人工完成初審／退回補件，以及批次完成初審。
 *
 * 規則的唯一實作在 shared（validateWorkflowAction / validateBatchComplete），
 * 這裡負責在碰 DB 前擋下不合法的請求，並把處理紀錄、處理進度與稽核事件
 * 寫在同一個交易內。DB 的 trigger 與 unique 約束是最後一道防線
 * （見 prisma/migrations/GOVERNANCE_SQL.md）。
 */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async act(caseNumber: string, body: unknown): Promise<WorkflowActionResponse> {
    const parsed = workflowActionRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("請求格式不正確。");
    const request = parsed.data;

    const c = await this.prisma.expenseCase.findUnique({
      where: { caseNumber },
      include: latestReviewInclude,
    });
    if (!c) throw new NotFoundException(`找不到案件 ${caseNumber}`);
    const latest = latestOf(c);

    const result = validateWorkflowAction({
      latestReview: { key: latest.reviewKey, recommendation: latest.recommendation },
      targetReviewKey: request.reviewKey,
      alreadyHandled: latest.action !== null,
      action: request.action,
      reason: request.reason,
    });
    if (!result.ok) {
      throw result.code === "REASON_REQUIRED"
        ? new BadRequestException(result.message)
        : new ConflictException(result.message);
    }

    const created = await this.withConflictMapping(() =>
      this.prisma.$transaction((tx) =>
        this.record(tx, {
          caseId: c.id,
          reviewId: latest.id,
          reviewKey: latest.reviewKey,
          action: request.action,
          reason: result.reason,
          originalRecommendation: result.originalRecommendation,
          resultingStatus: result.resultingStatus,
          batchId: null,
        }),
      ),
    );

    return { caseNumber, status: result.resultingStatus, action: toActionRecord(created) };
  }

  async batchComplete(body: unknown): Promise<BatchCompleteResponse> {
    const parsed = batchCompleteRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("請求格式不正確。");
    const { caseNumbers } = parsed.data;

    if (caseNumbers.length === 0 || new Set(caseNumbers).size !== caseNumbers.length) {
      throw new BadRequestException("請選取尚未處理的案件。");
    }
    const found = await this.prisma.expenseCase.findMany({
      where: { caseNumber: { in: caseNumbers } },
      include: latestReviewInclude,
    });
    const byNumber = new Map(found.map((c) => [c.caseNumber, c]));
    const missing = caseNumbers.filter((n) => !byNumber.has(n));
    if (missing.length > 0) throw new NotFoundException(`找不到案件 ${missing.join("、")}`);

    // 依請求順序處理，稽核與回應的順序可預期
    const cases = caseNumbers.map((n) => byNumber.get(n)!);
    const check = validateBatchComplete(
      cases.map((c) => {
        const latest = latestOf(c);
        return {
          caseNumber: c.caseNumber,
          latestRecommendation: latest.recommendation,
          handled: latest.action !== null,
        };
      }),
    );
    if (!check.ok) {
      throw check.code === "EMPTY_OR_DUPLICATE"
        ? new BadRequestException(check.message)
        : new ConflictException(check.message);
    }

    const batchId = randomUUID();
    await this.withConflictMapping(() =>
      this.prisma.$transaction(async (tx) => {
        for (const c of cases) {
          const latest = latestOf(c);
          await this.record(tx, {
            caseId: c.id,
            reviewId: latest.id,
            reviewKey: latest.reviewKey,
            action: "PROCEED",
            reason: "",
            originalRecommendation: latest.recommendation,
            resultingStatus: "REVIEW_COMPLETED",
            batchId,
          });
        }
      }),
    );

    return {
      results: cases.map((c) => ({
        caseNumber: c.caseNumber,
        status: "REVIEW_COMPLETED" as const,
      })),
    };
  }

  /** 在交易內寫入處理紀錄、推進處理進度、附稽核事件。 */
  private async record(
    tx: Prisma.TransactionClient,
    input: {
      caseId: string;
      reviewId: string;
      reviewKey: string;
      action: WorkflowAction;
      reason: string;
      originalRecommendation: Recommendation;
      resultingStatus: CaseStatus;
      batchId: string | null;
    },
  ) {
    const created = await tx.workflowActionRecord.create({
      data: {
        caseId: input.caseId,
        reviewId: input.reviewId,
        action: input.action,
        actorType: "HUMAN",
        actorLabel: DEMO_ACTOR_LABEL,
        reason: input.reason,
        originalRecommendation: input.originalRecommendation,
        resultingStatus: input.resultingStatus,
        batchId: input.batchId,
      },
      include: { review: true },
    });
    await tx.expenseCase.update({
      where: { id: input.caseId },
      data: { status: input.resultingStatus },
    });
    await this.audit.append(tx, input.caseId, {
      type: "WORKFLOW_ACTION",
      actorType: "HUMAN",
      actorLabel: DEMO_ACTOR_LABEL,
      payload: {
        reviewKey: input.reviewKey,
        action: input.action,
        originalRecommendation: input.originalRecommendation,
        resultingStatus: input.resultingStatus,
        reason: input.reason,
        batchId: input.batchId,
      },
    });
    return created;
  }

  /** 兩個請求同時處理同一案件時，後到的會撞上唯一鍵；回 409 而不是 500。 */
  private async withConflictMapping<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("此案件已完成處理。");
      }
      throw error;
    }
  }
}
