import { z } from "zod";
import { classificationSchema, recommendedActionSchema, confidenceLevelSchema } from "./enums";

export * from "./enums";
export * from "./domain/disposition";
export * from "./api";

// =============================================================================
// Agent suggestion payload shared by web/api
// =============================================================================

export const agentSuggestionSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  classification: classificationSchema,
  recommendedAction: recommendedActionSchema,
  /// 0..1；DB 以 Decimal(5,4) 儲存，跨層以 string 傳遞避免精度流失時可改為 z.string()
  confidenceScore: z.number().min(0).max(1).nullable(),
  confidenceLevel: confidenceLevelSchema,
  reasoningKey: z.string(),
  reasoningParams: z.record(z.string(), z.unknown()).default({}),
});
export type AgentSuggestion = z.infer<typeof agentSuggestionSchema>;
