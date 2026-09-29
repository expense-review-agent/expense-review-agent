import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  batchCompleteResponseSchema,
  caseDetailSchema,
  caseListResponseSchema,
  readingListResponseSchema,
  startReadingResponseSchema,
  workflowActionResponseSchema,
} from "@expense-review-agent/shared/browser";
import type { WorkflowActionRequest } from "@expense-review-agent/shared/browser";
import { request } from "./client";

export const caseKeys = {
  all: ["cases"] as const,
  list: () => ["cases", "list"] as const,
  detail: (caseNumber: string) => ["cases", "detail", caseNumber] as const,
  readings: (caseNumber: string) => ["cases", "readings", caseNumber] as const,
};

const READING_POLL_MS = 1000;

/** 單據讀取紀錄（由新到舊）。最新一筆讀取中時每秒輪詢，結束就停。 */
export function useReadings(caseNumber: string) {
  return useQuery({
    queryKey: caseKeys.readings(caseNumber),
    queryFn: () =>
      request(`/cases/${encodeURIComponent(caseNumber)}/readings`, readingListResponseSchema),
    select: (data) => data.readings,
    refetchInterval: (query) =>
      query.state.data?.readings[0]?.status === "RUNNING" ? READING_POLL_MS : false,
  });
}

/** 開始讀取；伺服器回 202 後重新取得讀取紀錄，進入輪詢。 */
export function useStartReading(caseNumber: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request(`/cases/${encodeURIComponent(caseNumber)}/readings`, startReadingResponseSchema, {
        method: "POST",
        body: {},
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: caseKeys.readings(caseNumber) }),
  });
}

export function useCaseList() {
  return useQuery({
    queryKey: caseKeys.list(),
    queryFn: () => request("/cases", caseListResponseSchema),
    select: (data) => data.items,
  });
}

export function useCaseDetail(caseNumber: string) {
  return useQuery({
    queryKey: caseKeys.detail(caseNumber),
    queryFn: () => request(`/cases/${encodeURIComponent(caseNumber)}`, caseDetailSchema),
  });
}

/** 完成初審／退回補件。成功後重新取得列表與詳情，畫面以伺服器狀態為準。 */
export function useWorkflowAction(caseNumber: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: WorkflowActionRequest) =>
      request(`/cases/${encodeURIComponent(caseNumber)}/actions`, workflowActionResponseSchema, {
        method: "POST",
        body,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: caseKeys.all }),
  });
}

export function useBatchComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (caseNumbers: string[]) =>
      request("/cases/batch-complete", batchCompleteResponseSchema, {
        method: "POST",
        body: { caseNumbers },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: caseKeys.all }),
  });
}
