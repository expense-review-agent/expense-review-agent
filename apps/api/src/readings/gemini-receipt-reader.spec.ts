// Gemini 錯誤分類：服務暫時無法使用時，要告訴使用者是「忙碌」「太頻繁」還是「今日額度用完」，
// 而不是一律顯示「服務錯誤」。狀態碼取自 SDK 錯誤物件的 statusCode / status。

import { classifyGeminiError } from "./gemini-receipt-reader";
import { ReaderUnavailableError } from "./receipt-reader";

const sdkError = (status: number, message: string) =>
  Object.assign(new Error(`${status} ${message}`), { status, statusCode: status });

describe("classifyGeminiError", () => {
  it("每日免費額度用完 → daily_quota，提示明天再試或升級方案", () => {
    const result = classifyGeminiError(
      sdkError(
        429,
        "Rate limit exceeded for model gemini-3.8-flash (limit: 20 requests per day on Free Tier).",
      ),
    );
    expect(result).toBeInstanceOf(ReaderUnavailableError);
    expect(result?.kind).toBe("daily_quota");
    expect(result?.message).toContain("今日");
  });

  it("其他 429 → rate_limited", () => {
    expect(classifyGeminiError(sdkError(429, "Too many requests per minute"))?.kind).toBe(
      "rate_limited",
    );
  });

  it("503 高負載與其他 5xx → busy", () => {
    expect(
      classifyGeminiError(sdkError(503, "gemini-3.8-flash is currently experiencing high demand"))
        ?.kind,
    ).toBe("busy");
    expect(classifyGeminiError(sdkError(500, "internal"))?.kind).toBe("busy");
  });

  it("只有 statusCode 沒有 status 也能判斷", () => {
    const error = Object.assign(new Error("503 busy"), { statusCode: 503 });
    expect(classifyGeminiError(error)?.kind).toBe("busy");
  });

  it("其他錯誤（例如 400、網路中斷）不在此分類，交由呼叫端處理", () => {
    expect(classifyGeminiError(sdkError(400, "bad request"))).toBeNull();
    expect(classifyGeminiError(new Error("socket hang up"))).toBeNull();
  });
});
