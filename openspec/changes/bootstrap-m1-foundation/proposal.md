## Why

The repo has a complete, decided data model (`apps/api/prisma/schema.prisma` v3,
aligned to prototype ReviewCopilot v0.3) but **nothing is bootstrapped for team
development**: there is no Prisma migration (the database has never been built),
`packages/shared` still ships stale placeholder types (`ADOPT/OVERRIDE`) that
contradict the decided domain contract, there is no seed, and no onboarding or
governance documentation. This blocks inexperienced teammates from entering
feature development, and leaves the "single source of truth" (schema + shared
domain) inconsistent with itself.

This change serves **M1 Review Copilot** — specifically the foundation both
**M1-U1** (reviewer completes review from agent output) and **M1-U2**
(supervisor traceable audit) depend on. It is a bootstrap change: it makes the
already-decided model executable and safe for concurrent, multi-person work.

## What Changes

- Introduce the **initial Prisma migration** that materializes schema v3,
  including the DB-layer governance constraints listed at the end of
  `schema.prisma`: `AuditEvent` hash-chain + append-only triggers on
  `AuditEvent` / `Disposition` / `SupervisorReview`, `CHECK` constraints
  requiring `Evidence` for every non-pass `RuleResult` / `MatchResult`, and
  `EXCLUDE` / uniqueness guards. **No `prisma db push`; migration only.**
- **Fix `packages/shared`** to match the decided domain contract: replace the
  stale `ADOPT/OVERRIDE` / single four-value verdict with the current
  `Classification` (NORMAL/EXCEPTION/MISSING/HUMAN), `RecommendedAction`
  (APPROVE/REQUEST_INFO/MANUAL_REVIEW), `ReviewerAction`, `RuleOutcome`
  (PASS/FAIL/GATED/ABSTAIN/PENDING_HUMAN), and add
  `packages/shared/src/domain/disposition.ts` as the **single** legal-action
  matrix both web and api import.
- Add a **seed scaffold** (`apps/api/prisma/seed/`) plus `db:seed` / `db:reset`
  scripts so the 10 demo cases (ten-scenario coverage) can be rebuilt
  deterministically. Phase 1 uses `STRUCTURED_FIXTURE` — **no OCR**.
- Add **contributor onboarding guide** and a **GitHub governance checklist**
  (branch protection + required checks + CODEOWNERS real IDs) so permission
  control is actually enforced at the platform layer, not just described.
- **UI/UX direction of record** (design.md detail): old-prototype layout as the
  base (side menu + case-overview dashboard + checklist rows); v0.3 field
  completeness is kept in the model, but v0.3's internal AI-reasoning tags
  (DepChip dependency/independent/match, `§` clause refs, confidence level,
  five-state outcome) are **not rendered in the web UI**.

This change adds **no new runtime dependencies** and does **not** introduce
Redis / BullMQ / pgvector (those are M2/M3).

## Capabilities

### New Capabilities

- `data-model`: the persisted M1 data model and its DB-layer governance
  guarantees (append-only audit trail with hash chain, evidence-required
  constraints, replayability fields `policyVersionId` / `engineVersion` /
  `inputSnapshot`), delivered as the initial migration.
- `shared-domain`: the front/back-end shared contract — verdict/action enums,
  rule-outcome enum, and the authoritative disposition (legal-action) matrix in
  `packages/shared/src/domain/`.
- `demo-seed`: deterministic Phase-1 seed data covering the ten required review
  scenarios, including paired cross-case fixtures for R7 (duplicate) / R8
  (split) and at least one low-confidence field.

### Modified Capabilities

<!-- None. No existing spec under openspec/specs/ changes its requirements;
     this repo has no prior spec deltas. -->

## Impact

- **New**: `apps/api/prisma/migrations/` (initial migration + governance SQL),
  `apps/api/prisma/seed/`, `packages/shared/src/domain/disposition.ts`, docs
  (onboarding guide, governance checklist).
- **Modified**: `packages/shared/src/index.ts` (**BREAKING** — replaces
  `ADOPT/OVERRIDE` and the old `reviewActionSchema`; any importer must migrate
  to the new enums), root/`apps/api` `package.json` scripts (`db:seed`,
  `db:reset`).
- **Owned paths touched** (per `CODEOWNERS`, require `@schema-owner`):
  `apps/api/prisma/schema.prisma` (unchanged, referenced only),
  `apps/api/prisma/migrations/`, `packages/shared/src/domain/`.
- **Traceability / audit-log implications**: the migration is what actually
  enforces traceability — hash-chained append-only `AuditEvent`, and the
  evidence-required `CHECK` constraints. No audit _fields_ are added beyond
  schema v3; this change makes the existing ones enforceable at the DB layer.
- **Governance**: CODEOWNERS placeholder accounts must be replaced with real
  GitHub IDs and branch protection (Require review from Code Owners) + required
  CI checks must be enabled for the control to bind — owner action, documented
  in the governance checklist.
