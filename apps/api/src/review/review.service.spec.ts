// ReviewService — disposition 寫入的單元測試。
//
// 這是 apps/api 的第一個測試檔。用手寫的 fake Prisma 注入，不連 DB、不加套件。
//
// 重點在兩件 CLAUDE.md 認定「錯了等於產品失效」的事：
//   1. 非法／缺件的請求必須在碰 DB 前被擋下（斷言 $transaction 從未被呼叫）
//   2. 寫入的 finalAction / finalClassification / consistencyFlag 必須反映
//      「人」的結論，而不是 Agent 建議的複本

import { BadRequestException } from "@nestjs/common";
import { ReviewService } from "./review.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { DispositionRequest } from "@expense-review-agent/shared";

const CASE_ID = "case_1";
const RUN_ID = "run_1";

interface RunFixture {
  classification: string | null;
  recommendedAction: string | null;
}

/** 記錄下傳給 disposition.create 的 data，供斷言檢查。 */
interface Captured {
  dispositionData: Record<string, unknown> | null;
  auditPayload: Record<string, unknown> | null;
  transactionCalls: number;
}

function makeService(run: RunFixture) {
  const captured: Captured = {
    dispositionData: null,
    auditPayload: null,
    transactionCalls: 0,
  };

  const tx = {
    disposition: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        captured.dispositionData = data;
        return Promise.resolve({ id: "disp_1", ...data });
      },
    },
    expenseCase: { update: () => Promise.resolve({}) },
    auditEvent: {
      findFirst: () => Promise.resolve(null),
      create: ({ data }: { data: Record<string, unknown> }) => {
        captured.auditPayload = data.payload as Record<string, unknown>;
        return Promise.resolve({ id: "audit_1" });
      },
    },
  };

  const prisma = {
    reviewRun: {
      findUnique: () => Promise.resolve({ id: RUN_ID, caseId: CASE_ID, ...run }),
    },
    user: {
      findFirst: () => Promise.resolve({ id: "user_1", email: "reviewer@example.test" }),
    },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => {
      captured.transactionCalls += 1;
      return fn(tx);
    },
  };

  const service = new ReviewService(prisma as unknown as PrismaService);
  return { service, captured };
}

function body(over: Partial<DispositionRequest>): DispositionRequest {
  return { runId: RUN_ID, action: "ACCEPT", ...over } as DispositionRequest;
}

const APPROVE_RUN: RunFixture = { classification: "NORMAL", recommendedAction: "APPROVE" };
const MANUAL_RUN: RunFixture = { classification: "HUMAN", recommendedAction: "MANUAL_REVIEW" };

// ---------------------------------------------------------------------------
// 400 路徑 — 每一個都必須在任何 DB 寫入前被擋下
// ---------------------------------------------------------------------------

describe("disposition — rejected before any state change", () => {
  it("rejects an action the matrix does not permit for this recommendation", async () => {
    // 真實的矩陣缺口：REQUEST_INFO 建議下沒有 REQUEST_INFO 這條路徑
    // （採用建議本身就是補件，再退補件是重複動作）。
    const { service, captured } = makeService({
      classification: "MISSING",
      recommendedAction: "REQUEST_INFO",
    });
    await expect(
      service.disposition(CASE_ID, body({ action: "REQUEST_INFO", reason: "補件" })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(captured.transactionCalls).toBe(0);
  });

  it("rejects an action outside the reviewer action vocabulary", async () => {
    const { service, captured } = makeService(APPROVE_RUN);
    await expect(
      service.disposition(CASE_ID, body({ action: "NOT_AN_ACTION" as never })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(captured.transactionCalls).toBe(0);
  });

  it("rejects a required reason left blank", async () => {
    const { service, captured } = makeService(APPROVE_RUN);
    // APPROVE + MANUAL_JUDGEMENT 改判成 REQUEST_INFO → OVERRIDDEN，理由必填
    await expect(
      service.disposition(
        CASE_ID,
        body({ action: "MANUAL_JUDGEMENT", finalAction: "REQUEST_INFO", reason: "   " }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(captured.transactionCalls).toBe(0);
  });

  it("rejects MANUAL_JUDGEMENT with no finalAction", async () => {
    const { service, captured } = makeService(APPROVE_RUN);
    await expect(
      service.disposition(CASE_ID, body({ action: "MANUAL_JUDGEMENT", reason: "改判" })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(captured.transactionCalls).toBe(0);
  });

  it("rejects a non-MANUAL_JUDGEMENT action that carries a finalAction", async () => {
    const { service, captured } = makeService(APPROVE_RUN);
    await expect(
      service.disposition(CASE_ID, body({ action: "ACCEPT", finalAction: "REQUEST_INFO" })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(captured.transactionCalls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 徽章寫入路徑 — 五種 flag 都要能實際寫出，且三個欄位正確
// ---------------------------------------------------------------------------

describe("disposition — persisted conclusion and badge", () => {
  it("CONSISTENT: accepting an APPROVE suggestion keeps the agent conclusion", async () => {
    const { service, captured } = makeService(APPROVE_RUN);
    const res = await service.disposition(CASE_ID, body({ action: "ACCEPT" }));

    expect(res.consistencyFlag).toBe("CONSISTENT");
    expect(captured.dispositionData).toMatchObject({
      agentActionAtDecision: "APPROVE",
      finalAction: "APPROVE",
      finalClassification: "NORMAL",
      consistencyFlag: "CONSISTENT",
    });
  });

  it("OVERRIDDEN: human judgement replaces a concluded agent suggestion", async () => {
    const { service, captured } = makeService(APPROVE_RUN);
    const res = await service.disposition(
      CASE_ID,
      body({ action: "MANUAL_JUDGEMENT", finalAction: "REQUEST_INFO", reason: "缺發票" }),
    );

    expect(res.consistencyFlag).toBe("OVERRIDDEN");
    expect(captured.dispositionData).toMatchObject({
      agentActionAtDecision: "APPROVE",
      finalAction: "REQUEST_INFO",
      // 人工改了結論 → 無從反推分類，不硬湊
      finalClassification: null,
      consistencyFlag: "OVERRIDDEN",
    });
  });

  it("HUMAN_ASSUMED: human concludes on a case the agent left to a human", async () => {
    const { service, captured } = makeService(MANUAL_RUN);
    const res = await service.disposition(
      CASE_ID,
      body({ action: "MANUAL_JUDGEMENT", finalAction: "APPROVE", reason: "主管口頭核可" }),
    );

    expect(res.consistencyFlag).toBe("HUMAN_ASSUMED");
    expect(captured.dispositionData).toMatchObject({
      agentActionAtDecision: "MANUAL_REVIEW",
      finalAction: "APPROVE",
      finalClassification: null,
      consistencyFlag: "HUMAN_ASSUMED",
    });
  });

  it("ESCALATED: accepting MANUAL_REVIEW concludes nothing and escalates", async () => {
    const { service, captured } = makeService(MANUAL_RUN);
    const res = await service.disposition(CASE_ID, body({ action: "ACCEPT" }));

    expect(res.consistencyFlag).toBe("ESCALATED");
    expect(captured.dispositionData).toMatchObject({
      agentActionAtDecision: "MANUAL_REVIEW",
      finalAction: "MANUAL_REVIEW",
      finalClassification: "HUMAN",
      consistencyFlag: "ESCALATED",
    });
  });

  it("PENDING_DECISION: HOLD records no conclusion and needs no reason", async () => {
    const { service, captured } = makeService(MANUAL_RUN);
    const res = await service.disposition(CASE_ID, body({ action: "HOLD" }));

    expect(res.consistencyFlag).toBe("PENDING_DECISION");
    expect(res.resultingStatus).toBe("QUEUED");
    expect(captured.dispositionData).toMatchObject({
      finalAction: null,
      finalClassification: null,
      consistencyFlag: "PENDING_DECISION",
    });
  });

  it("never copies the agent suggestion into finalAction when the human differs", async () => {
    const { service, captured } = makeService(APPROVE_RUN);
    await service.disposition(
      CASE_ID,
      body({ action: "MANUAL_JUDGEMENT", finalAction: "MANUAL_REVIEW", reason: "轉人工" }),
    );
    const data = captured.dispositionData!;
    expect(data.finalAction).not.toBe(data.agentActionAtDecision);
  });

  it("audit payload carries the human conclusion and the badge", async () => {
    const { service, captured } = makeService(APPROVE_RUN);
    await service.disposition(
      CASE_ID,
      body({ action: "MANUAL_JUDGEMENT", finalAction: "REQUEST_INFO", reason: "缺發票" }),
    );
    expect(captured.auditPayload).toMatchObject({
      action: "MANUAL_JUDGEMENT",
      finalAction: "REQUEST_INFO",
      consistencyFlag: "OVERRIDDEN",
    });
  });
});
