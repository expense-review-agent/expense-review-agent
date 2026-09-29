// ReadingsService — 單據讀取流程的單元測試（specs/receipt-reading.md）。
//
// 用手寫的 fake Prisma 與 fake 讀取服務，不連 DB、不呼叫真的 AI。重點：
//   1. 不能讀的情況在寫入前擋下（沒有憑證、正在讀取中）
//   2. 讀取成功：保存原始回應、擷取結果、以讀到的金額算出的 E-01 結果
//   3. 任何失敗（沒金鑰、逾時、服務錯誤、格式不合）→ 整次失敗，不留部分結果
//   4. 讀取不碰審查紀錄與處理進度

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ReadingsService } from "./readings.service";
import { ReaderConfigError, ReaderUnavailableError } from "./receipt-reader";
import type { ReaderResponse, ReceiptImage, ReceiptReader } from "./receipt-reader";
import type { ReceiptImageStore } from "./receipt-image-store";
import type { AuditEntry, AuditService } from "../audit/audit.service";
import type { PrismaService } from "../prisma/prisma.service";

const field = (value: string) => ({ status: "RECOGNIZED", value });
const extractionJson = (amount: string) =>
  JSON.stringify({
    vendor: field("城際客運"),
    issueDate: field("2026-09-18"),
    totalAmount: field(amount),
    currency: field("TWD"),
    documentNumber: field("EV-003"),
    taxId: { status: "NOT_ON_RECEIPT", value: null },
  });

type ReadFn = (image: ReceiptImage, signal: AbortSignal) => Promise<ReaderResponse>;

function fakeReader(read: ReadFn): ReceiptReader {
  return { provider: "fake", model: "fake-model", promptVersion: "test-v1", read };
}

interface CaseOptions {
  receipts?: string[];
  lines?: Array<{ key: string; amount: string; receiptKeys: string[] }>;
  running?: { startedAt: Date } | null;
}

function makeService(read: ReadFn, options: CaseOptions = {}) {
  const receipts = options.receipts ?? ["EV-003"];
  const lines = options.lines ?? [{ key: "EXP-2026-003", amount: "1680", receiptKeys: ["EV-003"] }];
  const captured = {
    readings: [] as Array<Record<string, unknown>>,
    outcomes: [] as Array<Record<string, unknown>>,
    audits: [] as AuditEntry[],
    otherWrites: 0,
  };

  const caseRow = {
    id: "c3",
    caseNumber: "EXP-2026-003",
    receipts: receipts.map((key) => ({ receiptKey: key, imagePath: `/fixtures/${key}.png` })),
    lines: lines.map((l) => ({
      lineKey: l.key,
      amount: { toString: () => l.amount },
      receipts: l.receiptKeys.map((key) => ({ receipt: { receiptKey: key } })),
    })),
    readings: options.running
      ? [{ id: "old", startedAt: options.running.startedAt, outcome: null }]
      : [],
  };

  const tx = {
    receiptReadingOutcome: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        captured.outcomes.push(data);
        return Promise.resolve(data);
      },
    },
    // 讀取不得寫入審查紀錄或處理進度
    reviewRecord: { create: () => (captured.otherWrites++, Promise.resolve({})) },
    expenseCase: { update: () => (captured.otherWrites++, Promise.resolve({})) },
  };

  const prisma = {
    expenseCase: {
      findUnique: ({ where }: { where: { caseNumber: string } }) =>
        Promise.resolve(where.caseNumber === "EXP-2026-003" ? caseRow : null),
    },
    receiptReading: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        captured.readings.push(data);
        return Promise.resolve({ id: "reading-1", ...data });
      },
    },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };

  const images = {
    load: (receiptKey: string) =>
      Promise.resolve({
        image: { receiptKey, mimeType: "image/png" as const, base64: "AAAA" },
        sha256: `sha-${receiptKey}`,
      }),
  };
  const audit = {
    append: (_tx: unknown, _caseId: string, entry: AuditEntry) => {
      captured.audits.push(entry);
      return Promise.resolve();
    },
  };

  const service = new ReadingsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    images as unknown as ReceiptImageStore,
    fakeReader(read),
  );
  return { service, captured };
}

const respond =
  (text: string): ReadFn =>
  () =>
    Promise.resolve({ text, usage: { inputTokens: 1 } });

describe("ReadingsService.start — 擋在寫入之前", () => {
  it("找不到案件回 404", async () => {
    const { service, captured } = makeService(respond(extractionJson("1480")));
    await expect(service.start("EXP-404")).rejects.toBeInstanceOf(NotFoundException);
    expect(captured.readings).toHaveLength(0);
  });

  it("案件沒有憑證時不提供讀取（4.7）", async () => {
    const { service, captured } = makeService(respond("{}"), { receipts: [], lines: [] });
    await expect(service.start("EXP-2026-003")).rejects.toBeInstanceOf(BadRequestException);
    expect(captured.readings).toHaveLength(0);
  });

  it("正在讀取中不可重複觸發（5.5）", async () => {
    const { service, captured } = makeService(respond("{}"), {
      running: { startedAt: new Date() },
    });
    await expect(service.start("EXP-2026-003")).rejects.toBeInstanceOf(ConflictException);
    expect(captured.readings).toHaveLength(0);
  });

  it("前一次讀取逾時未完成（服務中斷）時，可以重新讀取", async () => {
    const { service } = makeService(respond(extractionJson("1480")), {
      running: { startedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    await expect(service.start("EXP-2026-003")).resolves.toMatchObject({ status: "RUNNING" });
  });
});

describe("ReadingsService — 讀取成功", () => {
  it("保存原始回應、擷取結果與 E-01 結果，並附稽核事件", async () => {
    const { service, captured } = makeService(respond(extractionJson("1480")));
    const started = await service.start("EXP-2026-003");
    expect(started).toEqual({ readingId: "reading-1", status: "RUNNING" });
    await service.settled("reading-1");

    expect(captured.readings[0]).toMatchObject({
      caseId: "c3",
      actorType: "HUMAN",
      provider: "fake",
      model: "fake-model",
      promptVersion: "test-v1",
      inputs: [{ receiptKey: "EV-003", sha256: "sha-EV-003" }],
    });
    const outcome = captured.outcomes[0]!;
    expect(outcome).toMatchObject({
      readingId: "reading-1",
      outcome: "SUCCEEDED",
      failureReason: null,
    });
    expect(outcome.rawResponses).toEqual([{ receiptKey: "EV-003", text: extractionJson("1480") }]);
    expect(outcome.amountChecks).toEqual([
      {
        lineKey: "EXP-2026-003",
        result: expect.objectContaining({ status: "MISMATCH", differenceCents: 20000 }),
      },
    ]);
    expect(captured.audits[0]).toMatchObject({
      type: "RECEIPT_READING",
      payload: { readingId: "reading-1", outcome: "SUCCEEDED" },
    });
    expect(captured.otherWrites).toBe(0);
  });
});

describe("ReadingsService — 失敗時整次不採用（4.8）", () => {
  async function failedOutcome(read: ReadFn, options?: CaseOptions) {
    const { service, captured } = makeService(read, options);
    await service.start("EXP-2026-003");
    await service.settled("reading-1");
    const outcome = captured.outcomes[0]!;
    expect(outcome.outcome).toBe("FAILED");
    // 不寫入擷取結果與金額比對（DB 欄位為 NULL）
    expect(outcome).not.toHaveProperty("extractions");
    expect(outcome).not.toHaveProperty("amountChecks");
    expect(captured.otherWrites).toBe(0);
    return outcome;
  }

  it("沒有設定金鑰：顯示設定問題", async () => {
    const outcome = await failedOutcome(() =>
      Promise.reject(
        new ReaderConfigError("尚未設定 AI 服務金鑰（GEMINI_API_KEY），無法讀取憑證。"),
      ),
    );
    expect(outcome.failureReason).toContain("GEMINI_API_KEY");
  });

  it("今日額度用完：直接告訴使用者，不當成一般錯誤", async () => {
    const outcome = await failedOutcome(() =>
      Promise.reject(
        new ReaderUnavailableError(
          "daily_quota",
          "AI 讀取服務今日的使用額度已用完，請明天再試，或升級服務方案。",
        ),
      ),
    );
    expect(outcome.failureReason).toBe(
      "AI 讀取服務今日的使用額度已用完，請明天再試，或升級服務方案。",
    );
  });

  it("讀取服務錯誤：不外洩內部訊息", async () => {
    const outcome = await failedOutcome(() => Promise.reject(new Error("socket hang up 10.0.0.1")));
    expect(outcome.failureReason).toBe("AI 讀取服務發生錯誤，請稍後重試。");
  });

  it("回應不是 JSON", async () => {
    const outcome = await failedOutcome(respond("好的，這張收據金額是 1480 元"));
    expect(outcome.failureReason).toContain("不符合欄位格式");
    expect(outcome.rawResponses).toEqual([
      { receiptKey: "EV-003", text: "好的，這張收據金額是 1480 元" },
    ]);
  });

  it("JSON 形狀對但違反規則（無法辨識卻帶猜測值）", async () => {
    const bad = JSON.parse(extractionJson("1480")) as Record<string, unknown>;
    bad.totalAmount = { status: "UNREADABLE", value: "1480" };
    const outcome = await failedOutcome(respond(JSON.stringify(bad)));
    expect(outcome.failureReason).toContain("不符合欄位格式");
  });

  it("多張憑證中有一張失敗 → 整次失敗，不留部分結果", async () => {
    await failedOutcome(
      (image) =>
        image.receiptKey === "B"
          ? Promise.resolve({ text: "not json", usage: null })
          : Promise.resolve({ text: extractionJson("100"), usage: null }),
      {
        receipts: ["A", "B"],
        lines: [{ key: "L1", amount: "200", receiptKeys: ["A", "B"] }],
      },
    );
  });

  it("逾時：中止讀取並顯示逾時", async () => {
    const { service, captured } = makeService(
      (_image, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    service.timeoutMs = 20;
    await service.start("EXP-2026-003");
    await service.settled("reading-1");
    expect(captured.outcomes[0]).toMatchObject({ outcome: "FAILED" });
    expect(captured.outcomes[0]?.failureReason).toContain("逾時");
  });
});
