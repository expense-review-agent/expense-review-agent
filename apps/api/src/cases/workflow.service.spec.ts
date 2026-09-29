// WorkflowService — 人工流程動作與批次完成的單元測試。
//
// 用手寫的 fake Prisma 注入，不連 DB、不加套件。重點：
//   1. 不合法的請求必須在碰 DB 前被擋下（斷言 $transaction 從未被呼叫）
//   2. 寫入的處理紀錄保留原始建議、執行者與原因，並推進處理進度
//   3. 批次是全有全無：任一筆不合格，整批不執行

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Recommendation } from "@expense-review-agent/shared";
import { WorkflowService } from "./workflow.service";
import type { AuditEntry, AuditService } from "../audit/audit.service";
import type { PrismaService } from "../prisma/prisma.service";

interface CaseFixture {
  id: string;
  caseNumber: string;
  latestKey: string;
  recommendation: Recommendation;
  handled?: boolean;
}

function caseRow(f: CaseFixture) {
  return {
    id: f.id,
    caseNumber: f.caseNumber,
    reviews: [
      {
        id: `${f.id}-review`,
        reviewKey: f.latestKey,
        recommendation: f.recommendation,
        action: f.handled ? { id: "existing" } : null,
      },
    ],
  };
}

function makeService(fixtures: CaseFixture[], options: { failCreateWith?: Error } = {}) {
  const captured = {
    transactionCalls: 0,
    actions: [] as Array<Record<string, unknown>>,
    statusUpdates: [] as Array<{ id: string; status: string }>,
    audits: [] as Array<{ caseId: string; entry: AuditEntry }>,
  };

  const rows = fixtures.map(caseRow);
  const tx = {
    workflowActionRecord: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        if (options.failCreateWith) return Promise.reject(options.failCreateWith);
        captured.actions.push(data);
        const review = rows.flatMap((r) => r.reviews).find((r) => r.id === data.reviewId);
        return Promise.resolve({
          ...data,
          id: `action-${captured.actions.length}`,
          createdAt: new Date("2026-09-29T01:00:00Z"),
          review,
        });
      },
    },
    expenseCase: {
      update: ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        captured.statusUpdates.push({ id: where.id, status: data.status });
        return Promise.resolve({});
      },
    },
  };

  const prisma = {
    expenseCase: {
      findUnique: ({ where }: { where: { caseNumber: string } }) =>
        Promise.resolve(rows.find((r) => r.caseNumber === where.caseNumber) ?? null),
      findMany: ({ where }: { where: { caseNumber: { in: string[] } } }) =>
        Promise.resolve(rows.filter((r) => where.caseNumber.in.includes(r.caseNumber))),
    },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => {
      captured.transactionCalls += 1;
      return fn(tx);
    },
  };

  const audit = {
    append: (_tx: unknown, caseId: string, entry: AuditEntry) => {
      captured.audits.push({ caseId, entry });
      return Promise.resolve();
    },
  };

  const service = new WorkflowService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { service, captured };
}

const EXCEPTION_CASE: CaseFixture = {
  id: "c3",
  caseNumber: "EXP-2026-003",
  latestKey: "REV-003-1",
  recommendation: "MANUAL_REVIEW",
};
const APPROVE_CASE: CaseFixture = {
  id: "c1",
  caseNumber: "EXP-2026-001",
  latestKey: "REV-001-2",
  recommendation: "APPROVE",
};

describe("WorkflowService.act — 擋在寫入之前", () => {
  it("請求格式錯誤回 400", async () => {
    const { service, captured } = makeService([EXCEPTION_CASE]);
    await expect(service.act("EXP-2026-003", { action: "APPROVE" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(captured.transactionCalls).toBe(0);
  });

  it("找不到案件回 404", async () => {
    const { service, captured } = makeService([]);
    await expect(
      service.act("EXP-404", { reviewKey: "REV", action: "PROCEED", reason: "x" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(captured.transactionCalls).toBe(0);
  });

  it("例外案件人工通過沒有填原因回 400", async () => {
    const { service, captured } = makeService([EXCEPTION_CASE]);
    await expect(
      service.act("EXP-2026-003", { reviewKey: "REV-003-1", action: "PROCEED", reason: "  " }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(captured.transactionCalls).toBe(0);
  });

  it("處理歷史紀錄回 409", async () => {
    const { service, captured } = makeService([APPROVE_CASE]);
    await expect(
      service.act("EXP-2026-001", { reviewKey: "REV-001-1", action: "PROCEED" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(captured.transactionCalls).toBe(0);
  });

  it("已處理的案件重複送出回 409", async () => {
    const { service, captured } = makeService([{ ...APPROVE_CASE, handled: true }]);
    await expect(
      service.act("EXP-2026-001", { reviewKey: "REV-001-2", action: "PROCEED" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(captured.transactionCalls).toBe(0);
  });
});

describe("WorkflowService.act — 寫入內容", () => {
  it("保留原始建議、執行者與原因，推進處理進度並留下稽核事件", async () => {
    const { service, captured } = makeService([EXCEPTION_CASE]);
    const response = await service.act("EXP-2026-003", {
      reviewKey: "REV-003-1",
      action: "PROCEED",
      reason: " 已核對額外交通費證明 ",
    });

    expect(captured.actions).toHaveLength(1);
    expect(captured.actions[0]).toMatchObject({
      caseId: "c3",
      reviewId: "c3-review",
      action: "PROCEED",
      actorType: "HUMAN",
      actorLabel: "財務初審人員",
      reason: "已核對額外交通費證明",
      originalRecommendation: "MANUAL_REVIEW",
      resultingStatus: "REVIEW_COMPLETED",
    });
    expect(captured.statusUpdates).toEqual([{ id: "c3", status: "REVIEW_COMPLETED" }]);
    expect(captured.audits).toHaveLength(1);
    expect(captured.audits[0]?.entry).toMatchObject({
      type: "WORKFLOW_ACTION",
      actorType: "HUMAN",
      payload: {
        reviewKey: "REV-003-1",
        action: "PROCEED",
        originalRecommendation: "MANUAL_REVIEW",
      },
    });
    expect(response).toMatchObject({
      caseNumber: "EXP-2026-003",
      status: "REVIEW_COMPLETED",
      action: { reviewKey: "REV-003-1", reason: "已核對額外交通費證明" },
    });
  });

  it("退回補件進入待補件", async () => {
    const { service, captured } = makeService([APPROVE_CASE]);
    const response = await service.act("EXP-2026-001", {
      reviewKey: "REV-001-2",
      action: "REQUEST_INFO",
      reason: "請補充住宿明細",
    });
    expect(response.status).toBe("AWAITING_INFO");
    expect(captured.statusUpdates).toEqual([{ id: "c1", status: "AWAITING_INFO" }]);
  });

  it("同時送出造成唯一鍵衝突時回 409，而不是 500", async () => {
    const race = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "test",
    });
    const { service } = makeService([APPROVE_CASE], { failCreateWith: race });
    await expect(
      service.act("EXP-2026-001", { reviewKey: "REV-001-2", action: "PROCEED" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("WorkflowService.batchComplete", () => {
  const second: CaseFixture = {
    ...APPROVE_CASE,
    id: "c9",
    caseNumber: "EXP-2026-009",
    latestKey: "REV-009-1",
  };

  it("空選取或重複案件回 400", async () => {
    const { service, captured } = makeService([APPROVE_CASE]);
    await expect(service.batchComplete({ caseNumbers: [] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.batchComplete({ caseNumbers: ["EXP-2026-001", "EXP-2026-001"] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(captured.transactionCalls).toBe(0);
  });

  it("包含不存在的案件回 404", async () => {
    const { service, captured } = makeService([APPROVE_CASE]);
    await expect(
      service.batchComplete({ caseNumbers: ["EXP-2026-001", "EXP-404"] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(captured.transactionCalls).toBe(0);
  });

  it("混入非建議通過或已處理的案件時整批不執行", async () => {
    const { service, captured } = makeService([APPROVE_CASE, EXCEPTION_CASE]);
    await expect(
      service.batchComplete({ caseNumbers: ["EXP-2026-001", "EXP-2026-003"] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(captured.transactionCalls).toBe(0);
  });

  it("在同一交易內完成整批，每筆各有處理紀錄與稽核事件", async () => {
    const { service, captured } = makeService([APPROVE_CASE, second]);
    const response = await service.batchComplete({
      caseNumbers: ["EXP-2026-001", "EXP-2026-009"],
    });

    expect(captured.transactionCalls).toBe(1);
    expect(captured.actions).toHaveLength(2);
    const batchIds = new Set(captured.actions.map((a) => a.batchId));
    expect(batchIds.size).toBe(1);
    expect([...batchIds][0]).toEqual(expect.any(String));
    expect(captured.actions.every((a) => a.originalRecommendation === "APPROVE")).toBe(true);
    expect(captured.audits.map((a) => a.caseId)).toEqual(["c1", "c9"]);
    expect(response.results).toEqual([
      { caseNumber: "EXP-2026-001", status: "REVIEW_COMPLETED" },
      { caseNumber: "EXP-2026-009", status: "REVIEW_COMPLETED" },
    ]);
  });
});
