// 讀取服務的介面。供應商細節（目前是 Gemini）只存在實作裡，
// 審查流程只依賴這個介面，換供應商不影響 ReadingsService（CLAUDE.md LLM 使用規則）。

export const RECEIPT_READER = Symbol("RECEIPT_READER");

export interface ReceiptImage {
  receiptKey: string;
  mimeType: "image/png";
  base64: string;
}

export interface ReaderResponse {
  /** 模型的原始文字回應（預期為 JSON），原樣保存供回放 */
  text: string;
  /** 讀取服務回報的用量，供估算費用 */
  usage: Record<string, number> | null;
}

export interface ReceiptReader {
  readonly provider: string;
  readonly model: string;
  /** 讀取指示的版本；改 prompt 或 schema 就要改版本 */
  readonly promptVersion: string;
  read(image: ReceiptImage, signal: AbortSignal): Promise<ReaderResponse>;
}

/** 設定問題（例如沒有金鑰）：訊息可直接顯示給使用者。 */
export class ReaderConfigError extends Error {}

/**
 * 讀取服務暫時無法使用（忙碌、太頻繁、今日額度用完）。訊息可直接顯示給使用者。
 * 與讀錯不同：不代表 AI 讀不懂這張憑證。
 */
export type UnavailableKind = "busy" | "rate_limited" | "daily_quota";

export class ReaderUnavailableError extends Error {
  constructor(
    readonly kind: UnavailableKind,
    message: string,
  ) {
    super(message);
  }
}
