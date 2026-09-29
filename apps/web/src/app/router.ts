// =============================================================================
// Hash 路由（不引入 router 套件）
//   #/                      → 案件初審工作台
//   #/cases/EXP-2026-001    → 工作台 + 右側開啟該案詳情
// 開啟的案件放在網址上，重新整理或分享網址都會打開同一案件。
// =============================================================================

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getHash(): string {
  return window.location.hash;
}

export function parseCaseNumber(hash: string): string | null {
  const match = /^#\/cases\/([^/?#]+)/.exec(hash);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** 目前開啟的案件編號；沒有開啟時為 null。 */
export function useSelectedCaseNumber(): string | null {
  return parseCaseNumber(useSyncExternalStore(subscribe, getHash));
}

export function openCase(caseNumber: string): void {
  window.location.hash = `#/cases/${encodeURIComponent(caseNumber)}`;
}

export function closeCase(): void {
  window.location.hash = "#/";
}
