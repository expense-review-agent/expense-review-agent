// =============================================================================
// Hash 路由（不引入 router 套件）
//   #/cases       → 案件總覽
//   #/cases/:id   → 案件總覽 + 開啟該案詳情抽屜
// 抽屜狀態放在網址，重新整理或分享網址都會打開同一案件。
// =============================================================================

import { useSyncExternalStore } from "react";

export type Route = { name: "queue"; caseId: string | null };

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getHash(): string {
  return window.location.hash;
}

export function parseRoute(hash: string): Route {
  const match = /^#\/cases\/([^/?#]+)/.exec(hash);
  return { name: "queue", caseId: match?.[1] ? decodeURIComponent(match[1]) : null };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash);
  return parseRoute(hash);
}

export function caseHref(caseId: string): string {
  return `#/cases/${encodeURIComponent(caseId)}`;
}

export function openCase(caseId: string): void {
  window.location.hash = caseHref(caseId);
}

export function closeCase(): void {
  window.location.hash = "#/cases";
}
