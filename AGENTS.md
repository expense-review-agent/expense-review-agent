# Agent / Contributor Guide

This file applies to every contributor in this repo — human or AI agent.

## What this is

An AI Review Layer sitting on top of an existing corporate expense system.
See `openspec/config.yaml` (`context:` block) for the product summary, milestone
sequence (M1 Review Copilot → M2 Risk Intelligence → M3 Autonomous Review),
and the tech stack. Read that before your first change.

## Workflow: propose before you code

This repo uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) for spec-driven
development. Multiple people and multiple agents work here at once — the
proposal step is what keeps concurrent work from colliding.

1. **Explore** (optional): `/opsx:explore` to think through an idea before committing to a plan.
2. **Propose**: `/opsx:propose "<what you want to build>"` — generates a proposal,
   spec delta, and `tasks.md` under `openspec/changes/<change-id>/`. Do this
   _before_ writing implementation code.
3. **Apply**: `/opsx:apply` to implement the tasks in an existing proposal.
4. **Sync / Archive**: `/opsx:sync` to merge delta specs into the main specs
   without archiving, or `/opsx:archive` once the change has merged to `main`.

Do not start writing feature code without a proposal under `openspec/changes/`.
If you're fixing a small, obvious bug with no design decisions, a proposal is
overkill — just fix it and explain why in the PR.

## Repo layout

- `apps/web` — React + TypeScript frontend (Vite)
- `apps/api` — NestJS + TypeScript backend, Prisma ORM
- `packages/shared` — Zod schemas / TypeScript types shared by web and api
- `openspec/` — specs and change proposals
- `docker-compose.yml` — local Postgres (+pgvector), Redis, MinIO

## Conventions

- TypeScript strict mode everywhere. Don't weaken `tsconfig.base.json`.
- ESLint + Prettier are configured at the repo root only — do not add
  per-app `.eslintrc`/`.prettierrc` files.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, `refactor:`, ...); enforced by commitlint on commit.
- Shared types/enums (e.g. case verdicts, review actions) live in
  `packages/shared`, not duplicated in `apps/web` or `apps/api`.
- Every case decision (agent suggestion, human override, automated action)
  must be traceable — if your change touches review outcomes, make sure it
  writes to `AuditLog` with actor, action, and reasoning.

## Before opening a PR

```
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

All four run in CI (`.github/workflows/ci.yml`) and are required to merge.

## Local dev environment

```
docker compose up -d      # Postgres+pgvector, Redis, MinIO
cp .env.example .env       # then fill in real secrets for anything beyond local dev
pnpm install
pnpm --filter @expense-review-agent/api prisma:migrate
pnpm dev:api
pnpm dev:web
```
