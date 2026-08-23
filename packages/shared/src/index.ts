import { z } from "zod";

export const caseVerdictSchema = z.enum(["NORMAL", "EXCEPTION", "MISSING", "HUMAN"]);
export type CaseVerdict = z.infer<typeof caseVerdictSchema>;

export const reviewActionSchema = z.enum([
  "ADOPT",
  "OVERRIDE",
  "REQUEST_DOCUMENT",
  "ESCALATE_TO_HUMAN",
]);
export type ReviewAction = z.infer<typeof reviewActionSchema>;

export const agentSuggestionSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  verdict: caseVerdictSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  evidence: z.record(z.string(), z.unknown()),
});
export type AgentSuggestion = z.infer<typeof agentSuggestionSchema>;
