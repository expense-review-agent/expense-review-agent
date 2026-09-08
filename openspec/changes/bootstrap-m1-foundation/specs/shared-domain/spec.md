## Purpose

Defines the single front/back-end shared contract for review verdicts,
recommended actions, rule outcomes, and the legal reviewer-action matrix, so web
and api never diverge on what a decision means or which actions are permitted.

## ADDED Requirements

### Requirement: Shared verdict and action vocabulary

The `packages/shared` package SHALL export the canonical review vocabulary used
by both web and api: the four-way classification
(`NORMAL / EXCEPTION / MISSING / HUMAN`), the three-bucket recommended action
(`APPROVE / REQUEST_INFO / MANUAL_REVIEW`), the reviewer action set, and the
five-value rule outcome (`PASS / FAIL / GATED / ABSTAIN / PENDING_HUMAN`). These
enums SHALL match the persisted enums in the Prisma schema. The stale
`ADOPT / OVERRIDE` action vocabulary SHALL be removed.

#### Scenario: Classification maps to recommended action

- **WHEN** a case is classified `EXCEPTION` or `HUMAN`
- **THEN** the recommended action resolves to `MANUAL_REVIEW`

#### Scenario: Shared enums match persisted enums

- **WHEN** the shared vocabulary is compared against the Prisma schema enums
- **THEN** every classification, recommended-action, reviewer-action, and
  rule-outcome value has a one-to-one counterpart

#### Scenario: Removed vocabulary is no longer importable

- **WHEN** any module imports the former `ADOPT` / `OVERRIDE` action values
- **THEN** the import fails to type-check

### Requirement: Authoritative disposition matrix

`packages/shared/src/domain/disposition.ts` SHALL be the single source of the
legal reviewer-action matrix that maps an agent recommendation to the set of
permitted reviewer actions and their resulting case status. Web and api SHALL
both import this module; neither SHALL re-implement the matrix.

#### Scenario: Illegal action for a recommendation is rejected

- **WHEN** a reviewer action is validated against the matrix for a given agent
  recommendation
- **THEN** actions outside the permitted set for that recommendation are
  rejected

#### Scenario: MANUAL_REVIEW acceptance escalates rather than concludes

- **WHEN** a reviewer accepts a `MANUAL_REVIEW` recommendation
- **THEN** the case is escalated to a supervisor and the reviewer does not
  record a final approve/deny conclusion

#### Scenario: Consistency flag is derived once and frozen

- **WHEN** a final action is recorded against the agent action at decision time
- **THEN** the consistency flag is computed and stored on the record, not
  recomputed for display later
