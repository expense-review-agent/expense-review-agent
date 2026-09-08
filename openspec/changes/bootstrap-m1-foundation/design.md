## Context

See `proposal.md` — Why. The model (`schema.prisma` v3) is decided and aligned
to prototype ReviewCopilot v0.3, but nothing is executable: no migration, no
seed, stale `packages/shared`, no onboarding/governance docs. `CODEOWNERS`
assigns `schema.prisma`, `migrations/`, and `packages/shared/src/domain/` to
`@schema-owner`, and `CLAUDE.md` forbids `prisma db push` and mandates
`prisma migrate dev`. This is a first-time bootstrap on an empty database.

## Goals / Non-Goals

**Goals:**

- Produce the initial migration that materializes schema v3 plus its DB-layer
  governance SQL (append-only triggers, hash chain, evidence-required CHECKs,
  EXCLUDE/uniqueness) so traceability is enforced by the database.
- Make `packages/shared` the true front/back-end contract, with the disposition
  matrix in `packages/shared/src/domain/disposition.ts`.
- Deliver a deterministic Phase-1 seed and `db:seed` / `db:reset` scripts.
- Give inexperienced teammates a runnable onboarding path and give the owner a
  checklist to make governance binding.

**Non-Goals:**

- No OCR (Phase 1 uses `STRUCTURED_FIXTURE` / `MANUAL_FORM`).
- No Redis / BullMQ / pgvector (M2/M3).
- No change to `schema.prisma` itself — the migration must reproduce it, not
  redesign it.
- No web feature implementation; UI direction is recorded here only as a
  binding constraint for later feature changes.

## Decisions

- **Initial migration via `prisma migrate dev`, hand-augmented with governance
  SQL.** Prisma generates table/enum/index DDL from schema v3; the append-only
  triggers, hash-chain function, `CHECK` (evidence-required), and `EXCLUDE`
  constraints listed at the end of `schema.prisma` are appended into the same
  migration's SQL. Alternative considered: a separate follow-up migration for
  constraints — rejected because a window where the DB exists without its
  governance guarantees is exactly the risk this product cannot take.
- **`packages/shared` enums are the mirror of Prisma enums, validated by a
  test.** Rather than generating one from the other, we hand-write the Zod
  enums and add a test asserting one-to-one parity with the Prisma enums, so a
  future schema drift fails CI. Alternative: codegen from Prisma — deferred as
  heavier than needed for M1.
- **Disposition matrix is data, not scattered conditionals.** A single table in
  `disposition.ts` maps recommendation → permitted actions → resulting status;
  web and api import it. This is the CLAUDE.md "one source, both sides import"
  rule made concrete.
- **UI/UX direction of record (constraint for later changes):** old-prototype
  layout as the base (side main menu + case-overview dashboard + checklist
  rows). v0.3 field completeness is retained in the model and persisted, but the
  web UI SHALL NOT render v0.3's internal AI-reasoning tags — dependency/
  independent/match chips, `§` clause references, confidence level, and the
  five-state outcome. Rationale: reviewers need conclusions, not the agent's
  internal reasoning tags; more data is not better UX. These fields remain in
  the DB for audit replay; hiding them is a rendering decision, not a model
  change.
- **Seed reset uses drop-schema + migrate + seed, never TRUNCATE/DELETE.**
  Append-only triggers block DELETE and the audit hash chain must rebuild from
  the head, so only a full drop-and-recreate yields a clean, consistent state.

## Risks / Trade-offs

- **Governance SQL lives in raw migration SQL, invisible to the Prisma schema
  language.** → Keep the authoritative constraint list in the `schema.prisma`
  trailer comment and mirror it in the migration; the onboarding guide points
  teammates there so they don't "fix" a failing insert by removing a constraint.
- **CODEOWNERS has no force without GitHub settings.** → The governance
  checklist explicitly lists the branch-protection + required-checks + real-ID
  steps as owner-only actions; the agent cannot perform them and says so.
- **`packages/shared` change is BREAKING.** → It only breaks the stale
  placeholder (`ADOPT/OVERRIDE`) with no real importers yet; the parity test
  and typecheck catch any straggler at CI.
- **Manual sync between Prisma enums and shared enums can drift.** → The parity
  test is the mitigation; if it proves fragile, revisit codegen in a later
  change (Open Question).

## Migration Plan

1. Ensure local infra is up (`docker compose up -d`) and `.env` exists from
   `.env.example`.
2. `pnpm --filter api prisma:migrate` with a name like
   `init_m1_schema_v3` to generate the initial migration; append the governance
   SQL into that migration file before it is committed.
3. Add `db:seed` / `db:reset` scripts and the seed module; run `db:reset` to
   verify deterministic rebuild and that all four classifications appear.
4. Land `packages/shared` enums + `disposition.ts` + parity test.
5. Commit docs (onboarding guide, governance checklist).
6. Rollback: the change is additive on an empty DB; rollback = drop schema and
   discard the (uncommitted) migration. Since no environment depends on it yet,
   there is no production rollback concern.

## Open Questions

- Whether to later replace the hand-written shared enums with codegen from
  Prisma. Deferrable: it changes neither the specs nor the task breakdown, only
  the maintenance mechanism, and can be its own change if the parity test proves
  annoying.
