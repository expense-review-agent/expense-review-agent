import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  caseDetailSchema,
  caseHistoryResponseSchema,
  caseListResponseSchema,
  dispositionResponseSchema,
  policyListResponseSchema,
  relatedCasesResponseSchema,
} from "@expense-review-agent/shared/browser";
import type { CaseHistoryScope, DispositionRequest } from "@expense-review-agent/shared/browser";
import { request } from "./client";

export const caseKeys = {
  all: ["cases"] as const,
  list: () => ["cases", "list"] as const,
  /** 已結案列表是獨立查詢：總覽刻意不撈這些案件，混在一起會讓統計又算錯。 */
  closedList: () => ["cases", "list", "closed"] as const,
  detail: (id: string) => ["cases", id] as const,
  related: (id: string) => ["cases", id, "related"] as const,
  history: (id: string, scope: CaseHistoryScope) => ["cases", id, "history", scope] as const,
};

export const policyKeys = {
  all: ["policies"] as const,
  list: () => ["policies", "list"] as const,
};

/** Agent 當前的檢查依據（唯讀）。後端已含沒有條文的產品內建 guardrail。 */
export function usePolicyList() {
  return useQuery({
    queryKey: policyKeys.list(),
    queryFn: () => request("/policies", policyListResponseSchema),
    select: (data) => data.items,
  });
}

export function useCaseList() {
  return useQuery({
    queryKey: caseKeys.list(),
    queryFn: () => request("/cases", caseListResponseSchema),
    select: (data) => data.items,
  });
}

/** 已結案案件：由後端依流程狀態篩選，不在前端從全部案件過濾。 */
export function useClosedCaseList() {
  return useQuery({
    queryKey: caseKeys.closedList(),
    queryFn: () => request("/cases?caseStatus=REVIEW_CLOSED", caseListResponseSchema),
    select: (data) => data.items,
  });
}

/** 申請人／部門申請紀錄。以案件為查詢起點（見後端 history 的註解）。 */
export function useCaseHistory(caseId: string, scope: CaseHistoryScope | null) {
  return useQuery({
    queryKey: caseKeys.history(caseId, scope ?? "applicant"),
    queryFn: () =>
      request(
        `/cases/${encodeURIComponent(caseId)}/history?scope=${scope ?? "applicant"}`,
        caseHistoryResponseSchema,
      ),
    enabled: scope !== null,
  });
}

export function useCaseDetail(id: string | null) {
  return useQuery({
    queryKey: caseKeys.detail(id ?? ""),
    queryFn: () => request(`/cases/${encodeURIComponent(id ?? "")}`, caseDetailSchema),
    enabled: id !== null,
  });
}

export function useRelatedCases(id: string, enabled: boolean) {
  return useQuery({
    queryKey: caseKeys.related(id),
    queryFn: () => request(`/cases/${encodeURIComponent(id)}/related`, relatedCasesResponseSchema),
    enabled,
    select: (data) => data.related,
  });
}

export function useDisposition(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DispositionRequest) =>
      request(`/cases/${encodeURIComponent(caseId)}/disposition`, dispositionResponseSchema, {
        method: "POST",
        body,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: caseKeys.all }),
  });
}
