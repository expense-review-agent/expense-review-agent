# Agent / Contributor Guide

This file applies to every contributor in this repo — human or AI agent.

## What this is

CheckMate — an AI Expense Review & Control Agent that sits on top of an existing
corporate expense system. Product direction lives in `docs/product/`, UI/interaction
rules in `docs/design/`, and converged feature behavior in `specs/`. Read
`docs/product/product-brief.md` and `docs/product/product-scope.md` before your first change.

The repo is being rebuilt on the `refactor` branch to match the CheckMate PRD.
See [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md) for the phase plan, and
[CLAUDE.md](./CLAUDE.md) for the rules that must not be broken.

New here? Start with [docs/ONBOARDING.md](./docs/ONBOARDING.md). Repo owners:
see [docs/GOVERNANCE.md](./docs/GOVERNANCE.md) for the branch-protection /
CODEOWNERS steps that make permission control binding.

## Workflow: spec before code, test before implementation

This repo does **not** use OpenSpec. Old OpenSpec records are archived under
`docs/archive/openspec-m1/` for reference only.

For converged, non-trivial product behavior:

1. **Slice** it into an independently verifiable User Story / Product Slice.
2. **Spec** it in `specs/<slice-name>.md` (User Story, Context, Behavior,
   Acceptance Criteria, Edge Cases), checked against
   `docs/product/prd-review-criteria.md`.
3. **Test first** for domain logic: turn Acceptance Criteria into failing tests.
4. **Implement**, then **verify** against the Acceptance Criteria.

UI, interaction and copy that are still being explored can be validated with
mock data first, without a formal spec. Bug fixes, refactors and chores don't
need a User Story, but still need a clear scope and a way to verify them.

If a spec conflicts with the product docs, stop and raise it — don't pick an answer.

## Repo layout

- `apps/web` — React + TypeScript frontend (Vite, TanStack Query)
- `apps/api` — NestJS + TypeScript backend, Prisma ORM
- `packages/shared` — Zod schemas, types and domain logic shared by web and api
- `docs/product/`, `docs/design/` — CheckMate product and design docs
- `specs/` — converged feature specs
- `docs/archive/` — superseded docs (old M1 Review Copilot / OpenSpec)
- `docker-compose.yml` — local Postgres (Redis and MinIO are also defined but not used by the code)

## Conventions

- TypeScript strict mode everywhere. Don't weaken `tsconfig.base.json`.
- ESLint + Prettier are configured at the repo root only — do not add
  per-app `.eslintrc`/`.prettierrc` files.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, `refactor:`, ...); enforced by commitlint on commit.
- Domain logic (review engine, recommendation derivation, automation gate,
  workflow action rules) lives in `packages/shared`, not duplicated in
  `apps/web` or `apps/api`.
- Every case decision (agent finding, recommendation, workflow action, human
  override) must be traceable — if your change touches review outcomes, make
  sure it writes an audit event with actor, action, result and reason.

## Before opening a PR

```
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

All five run in CI (`.github/workflows/ci.yml`) and are required to merge.

## Local dev environment

```
docker compose up -d      # Postgres (Redis / MinIO start too, but are unused)
cp .env.example .env       # then fill in real secrets for anything beyond local dev
cp .env apps/api/.env      # Prisma runs from apps/api
pnpm install
pnpm --filter api prisma:migrate
pnpm --filter api db:seed
pnpm dev:api
pnpm dev:web
```
