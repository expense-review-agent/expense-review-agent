import { Injectable } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import { FIELD_STATUSES, RECEIPT_FIELDS } from "@expense-review-agent/shared";
import { ReaderConfigError, ReaderUnavailableError } from "./receipt-reader";
import type { ReaderResponse, ReceiptImage, ReceiptReader } from "./receipt-reader";

/**
 * 以 Gemini 讀取憑證（@google/genai 的 interactions API）。
 *
 * 設定（皆為後端環境變數，金鑰不得出現在前端）：
 * - GEMINI_API_KEY   必填；未設定時每次讀取都以「尚未設定金鑰」失敗，不影響其他功能
 * - GEMINI_MODEL     選填，預設 gemini-3.5-flash-lite（穩定版；換模型前先跑 eval:reading）
 * - GEMINI_BASE_URL  選填，只供本機以假服務驗證流程時使用
 *
 * 本類別只負責「送圖、拿回原始文字」。回應是否合乎格式、能不能採用，
 * 由 ReadingsService 以 shared 的 schema 與規則判斷。
 */

export const PROMPT_VERSION = "receipt-reading-v2";
// 以示範憑證量測過（eval:reading，2026-09-29 讀取指示 v2 連續兩次全對）；免費方案每日額度也較寬鬆
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

const FIELD_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: [...FIELD_STATUSES] },
    value: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["status", "value"],
};

/** 與 shared 的 receiptExtractionSchema 相同形狀。 */
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(RECEIPT_FIELDS.map((field) => [field, FIELD_SCHEMA])),
  required: [...RECEIPT_FIELDS],
};

export const READING_PROMPT = `你是費用初審的單據讀取助手。請讀取圖片中的這一張憑證，只回傳符合指定 JSON schema 的結果。

每個欄位都要給 status 與 value：
- RECOGNIZED：欄位清楚可讀，value 照抄讀到的內容。
- UNREADABLE：這個欄位應該在憑證上，但被遮住、模糊、裁切或無法可靠判讀。value 必須是 null。
- NOT_ON_RECEIPT：憑證版面上確實沒有這個欄位，或欄位內容明確寫著「未提供」。value 必須是 null。

分辨 UNREADABLE 與 NOT_ON_RECEIPT：只要有一部分被遮住、模糊或看不清楚，就用 UNREADABLE；
只有在你能清楚看到整張憑證、而且確定沒有這個欄位時，才用 NOT_ON_RECEIPT。
沒有把握就用 UNREADABLE，絕對不要猜測或推算數值。

只照抄看得到的內容，不判斷內容是否有效或合規（例如統一編號是不是 8 碼數字、是否為示範值），
那是後續規則的工作。

欄位與格式：
- vendor：店家或公司名稱，完整照抄，包含括號內的文字。
- issueDate：開立或消費日期，格式 YYYY-MM-DD。
- totalAmount：含稅總金額，只寫數字，可有最多兩位小數；不要千分位、幣別符號或「元」。
  每張憑證都應該有總金額；看不到時用 UNREADABLE，不要用 NOT_ON_RECEIPT。
- currency：幣別代碼。看到 NT$、新台幣、台幣時填 TWD；其他幣別填 ISO 代碼；沒有任何幣別標示時用 NOT_ON_RECEIPT。
- documentNumber：發票號碼、收據編號或憑證編號，照憑證上的寫法。
- taxId：「統一編號」欄位的內容，照抄欄位上寫的任何文字（即使不是號碼）。
  沒有統一編號欄位，或欄位寫「未提供」時，才用 NOT_ON_RECEIPT。

只描述憑證上看得到的內容，不判斷是否合規、是否可報支或真偽。`;

/**
 * 把 Gemini 的「暫時無法使用」錯誤轉成 ReaderUnavailableError；其他錯誤回傳 null。
 * 狀態碼取自 SDK 錯誤物件的 statusCode／status（APIError 與 GoogleGenAiError 皆有 statusCode）。
 */
export function classifyGeminiError(error: unknown): ReaderUnavailableError | null {
  if (!(error instanceof Error)) return null;
  const { statusCode, status } = error as { statusCode?: unknown; status?: unknown };
  const code =
    typeof statusCode === "number" ? statusCode : typeof status === "number" ? status : null;
  if (code === 429) {
    return /per day|daily/i.test(error.message)
      ? new ReaderUnavailableError(
          "daily_quota",
          "AI 讀取服務今日的使用額度已用完，請明天再試，或升級服務方案。",
        )
      : new ReaderUnavailableError("rate_limited", "AI 讀取服務請求過於頻繁，請稍後再試。");
  }
  if (code !== null && code >= 500) {
    return new ReaderUnavailableError("busy", "AI 讀取服務目前忙碌，請稍後重試。");
  }
  return null;
}

@Injectable()
export class GeminiReceiptReader implements ReceiptReader {
  readonly provider = "gemini";
  readonly model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  readonly promptVersion = PROMPT_VERSION;

  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new ReaderConfigError("尚未設定 AI 服務金鑰（GEMINI_API_KEY），無法讀取憑證。");
    }
    const baseUrl = process.env.GEMINI_BASE_URL?.trim();
    this.client ??= new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });
    return this.client;
  }

  async read(image: ReceiptImage, signal: AbortSignal): Promise<ReaderResponse> {
    const client = this.getClient();
    let interaction: Awaited<ReturnType<typeof client.interactions.create>>;
    try {
      interaction = await client.interactions.create(
        {
          model: this.model,
          input: [
            { type: "text", text: READING_PROMPT },
            { type: "image", data: image.base64, mime_type: image.mimeType },
          ],
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: EXTRACTION_JSON_SCHEMA,
          },
          generation_config: { thinking_level: "low" },
        },
        // 不讓 SDK 自動重試：免費方案有每日額度，失敗的請求也算次數；要不要重試由呼叫端決定
        { fetchOptions: { signal }, maxRetries: 0 },
      );
    } catch (error) {
      throw classifyGeminiError(error) ?? error;
    }

    const text = interaction.output_text;
    if (interaction.status !== "completed" || typeof text !== "string") {
      throw new Error(`Gemini interaction ended with status ${interaction.status}`);
    }
    const usage = interaction.usage;
    return {
      text,
      usage: usage
        ? {
            inputTokens: usage.total_input_tokens ?? 0,
            outputTokens: usage.total_output_tokens ?? 0,
            thoughtTokens: usage.total_thought_tokens ?? 0,
          }
        : null,
    };
  }
}
