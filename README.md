# expense-review-agent

AI Review Layer for corporate expense reimbursement review — sits on top of an
existing expense system, reads cases/receipts/policy/authorization data, and
helps finance teams move from checking every case by hand to reviewing by
risk and exception.

Milestones: **M1 Review Copilot** → **M2 Risk Intelligence** → **M3 Autonomous Review**.
See `openspec/config.yaml` for the full product context.

## Stack

- Frontend: React + TypeScript + Vite, TanStack Query, Zod (`apps/web`)
- Backend: NestJS + TypeScript, Prisma ORM (`apps/api`)
- Shared types/schemas: `packages/shared`
- Database: PostgreSQL (+ pgvector for M2 semantic retrieval)
- Object storage: S3 (MinIO locally)
- Queue: Redis + BullMQ
- Monorepo: pnpm workspaces

## Getting started

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm --filter @expense-review-agent/api prisma:migrate
pnpm dev:api
pnpm dev:web
```

## Contributing

This repo uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) for
spec-driven development — every non-trivial change starts as a proposal
under `openspec/changes/` before any code is written. See [AGENTS.md](./AGENTS.md)
for the full workflow and conventions (this applies to human contributors
and AI coding agents alike).

Before opening a PR: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Docs

- [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md) — current status, what's built vs. not, test explainer, and the 3-person division of labor.
- [docs/ONBOARDING.md](./docs/ONBOARDING.md) — get a new contributor from clone to a running app.
- [docs/GOVERNANCE.md](./docs/GOVERNANCE.md) — GitHub settings that make CODEOWNERS / branch protection actually enforce.
