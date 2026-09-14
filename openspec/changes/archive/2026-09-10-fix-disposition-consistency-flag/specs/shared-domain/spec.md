## MODIFIED Requirements

### Requirement: Shared verdict and action vocabulary

The `packages/shared` package SHALL export the canonical review vocabulary used
by both web and api: the four-way classification
(`NORMAL / EXCEPTION / MISSING / HUMAN`), the three-bucket recommended action
(`APPROVE / REQUEST_INFO / MANUAL_REVIEW`), the reviewer action set, the
five-value rule outcome (`PASS / FAIL / GATED / ABSTAIN / PENDING_HUMAN`), and
the consistency-flag vocabulary used to label how a human decision related to
the agent suggestion. These enums SHALL match the persisted enums in the Prisma
schema. The stale `ADOPT / OVERRIDE` action vocabulary SHALL be removed.

The consistency-flag vocabulary SHALL cover every outcome the disposition matrix
permits, including a reviewer deferring a decision without concluding.

#### Scenario: Classification maps to recommended action

- **WHEN** a case is classified `EXCEPTION` or `HUMAN`
- **THEN** the recommended action resolves to `MANUAL_REVIEW`

#### Scenario: Shared enums match persisted enums

- **WHEN** the shared vocabulary is compared against the Prisma schema enums
- **THEN** every classification, recommended-action, reviewer-action,
  rule-outcome, and consistency-flag value has a one-to-one counterpart

#### Scenario: Removed vocabulary is no longer importable

- **WHEN** any module imports the former `ADOPT` / `OVERRIDE` action values
- **THEN** the import fails to type-check

#### Scenario: Every permitted reviewer action yields a consistency flag

- **WHEN** the consistency flag is derived for any reviewer action the matrix
  permits, including deferral
- **THEN** a defined flag value is produced and no case is left without one

### Requirement: Authoritative disposition matrix

`packages/shared/src/domain/disposition.ts` SHALL be the single source of the
legal reviewer-action matrix that maps an agent recommendation to the set of
permitted reviewer actions and their resulting case status. Web and api SHALL
both import this module; neither SHALL re-implement the matrix.

The same module SHALL be the single source of the consistency-flag derivation.
The flag SHALL be a pure function of the agent action recorded at decision time
and the human final action; no other input SHALL affect it. Web and api SHALL
both import this derivation; neither SHALL re-implement it.

A reviewer action that records a human final action SHALL NOT be treated as an
escalation, because the human has taken responsibility for the conclusion.
Escalation SHALL apply only when neither the agent nor the human reaches a
conclusion.

#### Scenario: Illegal action for a recommendation is rejected

- **WHEN** a reviewer action is validated against the matrix for a given agent
  recommendation
- **THEN** actions outside the permitted set for that recommendation are
  rejected

#### Scenario: MANUAL_REVIEW acceptance escalates rather than concludes

- **WHEN** a reviewer accepts a `MANUAL_REVIEW` recommendation
- **THEN** the case is escalated to a supervisor and the reviewer does not
  record a final approve/deny conclusion

#### Scenario: Human judgement on a MANUAL_REVIEW case does not escalate

- **WHEN** a reviewer applies human judgement to a `MANUAL_REVIEW` case and
  states a final action
- **THEN** the disposition is not marked as an escalation, and the flag records
  that the human assumed the judgement

#### Scenario: Consistency flag is derived once and frozen

- **WHEN** a final action is recorded against the agent action at decision time
- **THEN** the consistency flag is computed and stored on the record, not
  recomputed for display later

#### Scenario: Flag derivation ignores the reviewer action label

- **WHEN** two dispositions have the same agent action at decision time and the
  same human final action but were reached through different reviewer actions
- **THEN** both receive the same consistency flag

#### Scenario: Overriding a concluded agent suggestion requires a reason

- **WHEN** the agent reached a conclusion and the human final action differs
  from it
- **THEN** the derivation reports the pairing as requiring a reason, and a
  disposition recorded without one is rejected
