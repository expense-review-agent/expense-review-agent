## 1. Local infra & env (prerequisite)

- [x] 1.1 Copy `.env.example` to `.env` and verify `apps/api` reads `DATABASE_URL` (run `pnpm --filter api prisma:generate` — it resolves the datasource without error)
- [x] 1.2 Start local infra with `docker compose up -d` and verify Postgres accepts a connection on `localhost:5432` (e.g. `pg_isready` or a `psql` connect succeeds)

## 2. Initial migration + governance SQL (owner: @schema-owner)

- [x] 2.1 Generate the initial migration from schema v3 with `pnpm --filter api prisma:migrate` named `init_m1_schema_v3`, and verify the migration folder appears under `apps/api/prisma/migrations/` with table/enum/index DDL matching `schema.prisma`
- [x] 2.2 Append append-only triggers on `AuditEvent` / `Disposition` / `SupervisorReview` into the migration SQL and verify an `UPDATE`/`DELETE` attempt on each table raises an error
- [ ] 2.3 Append the `AuditEvent` hash-chain function/trigger and verify a tampered row fails chain re-verification (unit or SQL-level check)
- [x] 2.4 Append the evidence-required `CHECK`/constraint and verify inserting a non-pass `RuleResult`/`MatchResult` with no `Evidence` is rejected
- [x] 2.5 Append EXCLUDE/uniqueness guards (e.g. `@@unique([runId, checkKey])`, related-case links) and verify a duplicate/orphan insert is rejected
- [x] 2.6 Verify a fresh migrate against an empty DB creates the full schema, and a second migrate reports "up to date" (idempotent) — covers data-model spec scenarios

## 3. Shared domain contract (owner: @schema-owner)

- [x] 3.1 Replace stale `ADOPT/OVERRIDE` vocabulary in `packages/shared/src/index.ts` with `Classification`, `RecommendedAction`, `ReviewerAction`, `RuleOutcome` Zod enums, and verify `pnpm --filter shared typecheck` passes
- [x] 3.2 Add `packages/shared/src/domain/disposition.ts` as the single legal-action matrix (recommendation → permitted actions → resulting status), exported from the package index
- [x] 3.3 Add a parity test asserting each shared enum matches the Prisma schema enum one-to-one, and verify it fails if an enum value is added/removed on one side only
- [x] 3.4 Add a matrix test verifying illegal reviewer actions are rejected and that accepting `MANUAL_REVIEW` escalates (reviewer records no final approve/deny) — covers shared-domain spec scenarios

## 4. Demo seed + scripts (owner: @backend-owner)

- [x] 4.1 Add `db:seed` and `db:reset` scripts (root + `apps/api`); verify `db:reset` runs drop-schema → migrate → seed with no `TRUNCATE`/`DELETE` on append-only tables
- [ ] 4.2 Implement the seed module under `apps/api/prisma/seed/` producing the ten scenarios (normal, R7 duplicate, R1 over-limit, R3+R4 missing, R5 mismatch+dual-basis, R8 split, R10 sum-diff, foreign-invoice abstain, R9 tax-id, unmatched-receipt) using `STRUCTURED_FIXTURE` (no OCR)
- [x] 4.3 Seed paired `REVIEW_CLOSED` reference cases for R7/R8 and verify the cross-case rules trigger only with a counterpart present (and not for a lone case)
- [ ] 4.4 Include at least one key field with `confidenceLevel = LOW`/`NONE` or `isRecognized = false`, and verify that case is not classified `NORMAL`
- [ ] 4.5 Run `db:reset` twice and verify identical demo case numbers and that all four classifications (NORMAL/EXCEPTION/MISSING/HUMAN) appear — covers demo-seed spec scenarios

## 5. Onboarding & governance docs (owner: @schema-owner for /docs governance)

- [x] 5.1 Write a contributor onboarding guide (env → `docker compose up` → migrate → seed → dev servers → OpenSpec flow → which files are owned/off-limits) and verify a teammate can reach a running app by following it top to bottom
- [x] 5.2 Write a GitHub governance checklist (replace CODEOWNERS placeholder IDs with real accounts; enable Branch protection → Require review from Code Owners; set `lint`/`typecheck`/`test`/`build` as required checks) and verify each item is actionable by the repo owner
- [x] 5.3 Cross-link both docs from `README.md`/`AGENTS.md` and verify the links resolve

## 6. Integration verification

- [x] 6.1 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the repo root and verify all four pass (CI parity)
- [ ] 6.2 With a freshly `db:reset` database, verify the app boots and the seeded cases are retrievable, confirming migration + shared enums + seed agree end to end
