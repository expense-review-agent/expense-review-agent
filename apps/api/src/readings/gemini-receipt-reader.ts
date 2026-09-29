import { Injectable } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import { FIELD_STATUSES, RECEIPT_FIELDS } from "@expense-review-agent/shared";
import { ReaderConfigError } from "./receipt-reader";
import type { ReaderResponse, ReceiptImage, ReceiptReader } from "./receipt-reader";

/**
 * 以 Gemini 讀取憑證（@google/genai 的 interactions API）。
 *
 * 設定（皆為後端環境變數，金鑰不得出現在前端）：
 * - GEMINI_API_KEY   必填；未設定時每次讀取都以「尚未設定金鑰」失敗，不影響其他功能
 * - GEMINI_MODEL     選填，預設 gemini-3.8-flash（Google 文件列為穩定版的快速多模態模型）
 * - GEMINI_BASE_URL  選填，只供本機以假服務驗證流程時使用
 *
 * 本類別只負責「送圖、拿回原始文字」。回應是否合乎格式、能不能採用，
 * 由 ReadingsService 以 shared 的 schema 與規則判斷。
 */

export const PROMPT_VERSION = "receipt-reading-v1";
const DEFAULT_MODEL = "gemini-3.8-flash";

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
- RECOGNIZED：憑證上清楚印有此欄位，value 填入讀到的內容。
- UNREADABLE：憑證上應該有此欄位，但模糊、遮蔽或無法可靠判讀。value 必須是 null。
- NOT_ON_RECEIPT：憑證上沒有此欄位，或欄位明確標示「未提供」。value 必須是 null。

沒有把握就用 UNREADABLE，絕對不要猜測或推算數值。

欄位與格式：
- vendor：店家或公司名稱，照憑證上的寫法。
- issueDate：開立或消費日期，格式 YYYY-MM-DD。
- totalAmount：含稅總金額，只寫數字，可有最多兩位小數；不要千分位、幣別符號或「元」。
- currency：幣別代碼。看到 NT$、新台幣、台幣時填 TWD；其他幣別填 ISO 代碼；沒有任何幣別標示時用 NOT_ON_RECEIPT。
- documentNumber：發票號碼、收據編號或憑證編號，照憑證上的寫法。
- taxId：統一編號欄位的內容，照憑證上的寫法；沒有此欄位或標示「未提供」時用 NOT_ON_RECEIPT。

只描述憑證上看得到的內容，不判斷是否合規、是否可報支或真偽。`;

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
    const interaction = await this.getClient().interactions.create(
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
      { fetchOptions: { signal }, maxRetries: 1 },
    );

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
