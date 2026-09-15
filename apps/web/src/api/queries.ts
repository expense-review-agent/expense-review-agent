import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  caseDetailSchema,
  caseListResponseSchema,
  dispositionResponseSchema,
  relatedCasesResponseSchema,
} from "@expense-review-agent/shared/browser";
import type { DispositionRequest } from "@expense-review-agent/shared/browser";
import { request } from "./client";

export const caseKeys = {
  all: ["cases"] as const,
  list: () => ["cases", "list"] as const,
  detail: (id: string) => ["cases", id] as const,
  related: (id: string) => ["cases", id, "related"] as const,
};

export function useCaseList() {
  return useQuery({
    queryKey: caseKeys.list(),
    queryFn: () => request("/cases", caseListResponseSchema),
    select: (data) => data.items,
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
