// =============================================================================
// API client —— 所有回應都以 packages/shared 的 Zod schema 驗證。
// 回應不符契約時視為錯誤，不以不完整資料渲染判定結果。
// =============================================================================

import type { z } from "zod";

const API_BASE = "/api";

export type ApiErrorKind = "http" | "network" | "contract";

export class ApiError extends Error {
  readonly status: number | null;
  readonly kind: ApiErrorKind;

  constructor(message: string, kind: ApiErrorKind, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** NestJS 錯誤格式：{ statusCode, message: string | string[], error } */
function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const { message } = body;
    if (typeof message === "string" && message) return message;
    if (Array.isArray(message) && message.length) return message.join("；");
  }
  return fallback;
}

export async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: { method: "POST"; body: unknown },
): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: init ? { "Content-Type": "application/json" } : undefined,
      body: init ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("無法連線到後端服務，請確認 API 已啟動。", "network");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    // dev proxy / gateway 連不到後端時回 502–504 且沒有 NestJS 錯誤內容
    if (response.status >= 502 && response.status <= 504 && body === null) {
      throw new ApiError("無法連線到後端服務，請確認 API 已啟動。", "network", response.status);
    }
    throw new ApiError(
      extractMessage(body, `請求失敗（HTTP ${response.status}）`),
      "http",
      response.status,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error(`[api] ${path} 回應不符契約`, parsed.error);
    throw new ApiError("後端回應的資料格式不符合契約，無法顯示。", "contract", response.status);
  }
  return parsed.data;
}
