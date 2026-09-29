import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  amountChecksForReading,
  extractionProblems,
  receiptExtractionSchema,
  receiptReadingSchema,
} from "@expense-review-agent/shared";
import type {
  LineAmountCheck,
  ReadingListResponse,
  ReceiptExtraction,
  ReceiptReadingDto,
  StartReadingResponse,
} from "@expense-review-agent/shared";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReceiptImageStore } from "./receipt-image-store";
import { RECEIPT_READER, ReaderConfigError, ReaderUnavailableError } from "./receipt-reader";
import type { ReceiptImage, ReceiptReader } from "./receipt-reader";

/** 本輪沒有登入；觸發讀取的人一律記為示範角色。 */
const DEMO_ACTOR_LABEL = "財務初審人員";
/** 逾時未完成、又沒有結果的讀取，超過這段時間就視為中斷（例如服務重啟）。 */
const STALE_GRACE_MS = 30_000;

const MESSAGES = {
  noReceipts: "此案件沒有憑證可讀取。",
  running: "此案件正在讀取憑證，請稍候。",
  timeout: "讀取逾時（超過 60 秒），請重試。",
  invalid: "AI 回傳的結果不符合欄位格式，本次讀取不採用，請重試。",
  provider: "AI 讀取服務發生錯誤，請稍後重試。",
  interrupted: "讀取未完成（服務中斷），請重試。",
} as const;

class ReadingFailure extends Error {}

const caseInclude = {
  receipts: { orderBy: { receiptKey: "asc" } },
  lines: { orderBy: { lineNo: "asc" }, include: { receipts: { include: { receipt: true } } } },
  readings: { orderBy: { startedAt: "desc" }, take: 1, include: { outcome: true } },
} satisfies Prisma.ExpenseCaseInclude;

type CaseForReading = Prisma.ExpenseCaseGetPayload<{ include: typeof caseInclude }>;

/**
 * ReadingsService — 單據讀取（specs/receipt-reading.md）。
 *
 * 流程：POST 建立讀取紀錄後立刻回 202，背景逐張請 AI 讀取；全部成功才計算 E-01 並寫入結果，
 * 任何一張失敗就整次失敗、不留部分結果。結果只寫在讀取紀錄裡，不碰審查紀錄與處理進度。
 * 規則（格式、無法辨識、金額比對）全部來自 shared，AI 只負責讀。
 */
@Injectable()
export class ReadingsService implements OnApplicationShutdown {
  private readonly logger = new Logger(ReadingsService.name);
  private readonly inFlight = new Map<string, Promise<void>>();
  /** 單次讀取（全部憑證）的上限；測試可縮短 */
  timeoutMs = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly images: ReceiptImageStore,
    @Inject(RECEIPT_READER) private readonly reader: ReceiptReader,
  ) {}

  async start(caseNumber: string): Promise<StartReadingResponse> {
    const c = await this.prisma.expenseCase.findUnique({
      where: { caseNumber },
      include: caseInclude,
    });
    if (!c) throw new NotFoundException(`找不到案件 ${caseNumber}`);
    if (c.receipts.length === 0) throw new BadRequestException(MESSAGES.noReceipts);
    const latest = c.readings[0];
    if (latest && !latest.outcome && !this.isStale(latest.startedAt)) {
      throw new ConflictException(MESSAGES.running);
    }

    let loaded: Array<{ image: ReceiptImage; sha256: string }>;
    try {
      loaded = await Promise.all(
        c.receipts.map((r) => {
          if (!r.imagePath) throw new Error(`憑證 ${r.receiptKey} 沒有圖檔`);
          return this.images.load(r.receiptKey, r.imagePath);
        }),
      );
    } catch (error) {
      this.logger.error(`無法載入 ${caseNumber} 的憑證圖檔`, error as Error);
      throw new InternalServerErrorException("找不到憑證圖檔，無法讀取。");
    }

    const reading = await this.prisma.receiptReading.create({
      data: {
        caseId: c.id,
        actorType: "HUMAN",
        actorLabel: DEMO_ACTOR_LABEL,
        provider: this.reader.provider,
        model: this.reader.model,
        promptVersion: this.reader.promptVersion,
        inputs: loaded.map((l) => ({ receiptKey: l.image.receiptKey, sha256: l.sha256 })),
      },
    });

    const run = this.process(
      reading.id,
      c,
      loaded.map((l) => l.image),
    ).finally(() => this.inFlight.delete(reading.id));
    this.inFlight.set(reading.id, run);
    return { readingId: reading.id, status: "RUNNING" };
  }

  /** 等背景讀取結束（測試使用）。 */
  async settled(readingId: string): Promise<void> {
    await this.inFlight.get(readingId);
  }

  /** 關機時等進行中的讀取寫完結果，避免留下「讀取中」卻永遠沒有結果的紀錄。 */
  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([...this.inFlight.values()]);
  }

  async list(caseNumber: string): Promise<ReadingListResponse> {
    const c = await this.prisma.expenseCase.findUnique({
      where: { caseNumber },
      select: {
        readings: { orderBy: { startedAt: "desc" }, include: { outcome: true } },
      },
    });
    if (!c) throw new NotFoundException(`找不到案件 ${caseNumber}`);
    return { readings: c.readings.map((r) => this.toDto(r)) };
  }

  // ---- 背景讀取 ---------------------------------------------------------------

  private async process(
    readingId: string,
    c: CaseForReading,
    images: ReceiptImage[],
  ): Promise<void> {
    const rawResponses: Array<{ receiptKey: string; text: string }> = [];
    const usage: Array<Record<string, number> | null> = [];
    let result:
      | {
          ok: true;
          extractions: Record<string, ReceiptExtraction>;
          amountChecks: LineAmountCheck[];
        }
      | { ok: false; reason: string };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const timedOut = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener("abort", () =>
        reject(new ReadingFailure(MESSAGES.timeout)),
      );
    });

    try {
      const extractions: Record<string, ReceiptExtraction> = {};
      // 逐張讀取：一張一次請求，失敗能明確指出是哪一張
      for (const image of images) {
        const response = await Promise.race([this.reader.read(image, controller.signal), timedOut]);
        rawResponses.push({ receiptKey: image.receiptKey, text: response.text });
        usage.push(response.usage);
        extractions[image.receiptKey] = this.parse(image.receiptKey, response.text);
      }
      const amountChecks = amountChecksForReading(
        c.lines.map((l) => ({
          key: l.lineKey,
          amount: l.amount.toString(),
          receiptKeys: l.receipts.map((r) => r.receipt.receiptKey),
        })),
        new Map(Object.entries(extractions)),
      );
      result = { ok: true, extractions, amountChecks };
    } catch (error) {
      result = { ok: false, reason: this.failureReason(error, controller.signal.aborted) };
    } finally {
      clearTimeout(timer);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.receiptReadingOutcome.create({
          data: {
            readingId,
            outcome: result.ok ? "SUCCEEDED" : "FAILED",
            rawResponses,
            // 失敗時不寫擷取結果與金額比對（欄位留 NULL），DB 約束也保證不留部分結果
            ...(result.ok
              ? {
                  extractions: result.extractions as unknown as Prisma.InputJsonObject,
                  amountChecks: result.amountChecks as unknown as Prisma.InputJsonArray,
                }
              : {}),
            failureReason: result.ok ? null : result.reason,
            usage,
          },
        });
        await this.audit.append(tx, c.id, {
          type: "RECEIPT_READING",
          actorType: "HUMAN",
          actorLabel: DEMO_ACTOR_LABEL,
          payload: {
            readingId,
            outcome: result.ok ? "SUCCEEDED" : "FAILED",
            provider: this.reader.provider,
            model: this.reader.model,
            promptVersion: this.reader.promptVersion,
            receiptKeys: images.map((i) => i.receiptKey),
            failureReason: result.ok ? null : result.reason,
          },
        });
      });
    } catch (error) {
      // 寫不進結果時，這筆讀取會在逾時後被視為中斷；記錄以便排查
      this.logger.error(`無法寫入讀取結果 ${readingId}`, error as Error);
    }
  }

  /** 解析並驗證一張憑證的回應；不合格就整次失敗。 */
  private parse(receiptKey: string, text: string): ReceiptExtraction {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      this.logger.warn(`${receiptKey} 的回應不是 JSON`);
      throw new ReadingFailure(MESSAGES.invalid);
    }
    const parsed = receiptExtractionSchema.safeParse(json);
    if (!parsed.success) {
      this.logger.warn(`${receiptKey} 的回應不符合 schema：${parsed.error.message}`);
      throw new ReadingFailure(MESSAGES.invalid);
    }
    const problems = extractionProblems(parsed.data);
    if (problems.length > 0) {
      this.logger.warn(`${receiptKey} 的回應違反擷取規則：${problems.join("；")}`);
      throw new ReadingFailure(MESSAGES.invalid);
    }
    return parsed.data;
  }

  private failureReason(error: unknown, aborted: boolean): string {
    if (aborted) return MESSAGES.timeout;
    if (
      error instanceof ReadingFailure ||
      error instanceof ReaderConfigError ||
      error instanceof ReaderUnavailableError
    ) {
      return error.message;
    }
    this.logger.error("AI 讀取服務錯誤", error as Error);
    return MESSAGES.provider;
  }

  private isStale(startedAt: Date): boolean {
    return Date.now() - startedAt.getTime() > this.timeoutMs + STALE_GRACE_MS;
  }

  private toDto(
    r: Prisma.ReceiptReadingGetPayload<{ include: { outcome: true } }>,
  ): ReceiptReadingDto {
    const inputs = r.inputs as Array<{ receiptKey: string }>;
    const outcome = r.outcome;
    const interrupted = !outcome && this.isStale(r.startedAt);
    // 以 shared 的 schema 解析 JSON 欄位：資料庫裡的內容不合契約就讓請求失敗，不回傳半套資料
    return receiptReadingSchema.parse({
      id: r.id,
      status: outcome ? outcome.outcome : interrupted ? "FAILED" : "RUNNING",
      startedAt: r.startedAt.toISOString(),
      finishedAt: outcome ? outcome.finishedAt.toISOString() : null,
      actorLabel: r.actorLabel,
      provider: r.provider,
      model: r.model,
      promptVersion: r.promptVersion,
      receiptKeys: inputs.map((i) => i.receiptKey),
      extractions: outcome?.extractions ?? null,
      amountChecks: outcome?.amountChecks ?? null,
      failureReason: outcome ? outcome.failureReason : interrupted ? MESSAGES.interrupted : null,
    });
  }
}
