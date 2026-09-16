# data-model Specification

## Purpose

Defines the persisted M1 data model and the database-layer guarantees that make
every expense-review decision traceable and tamper-evident, so that agent
suggestions and human decisions can be replayed and audited after the fact.

## Requirements

### Requirement: Persisted M1 review data model

The system SHALL persist the M1 review domain — expense cases, expense lines,
receipts, extracted fields, review runs, match results, rule results, evidence,
dispositions, supervisor reviews, and audit events — in PostgreSQL, provisioned
through a versioned migration. The system SHALL NOT provision the database with
`prisma db push`; schema changes SHALL be applied only through committed
migrations.

#### Scenario: Fresh database is provisioned from migration

- **WHEN** a contributor runs the migrate command against an empty database
- **THEN** all M1 tables, enums, indexes, and governance constraints are
  created, and the resulting schema matches `apps/api/prisma/schema.prisma` v3

#### Scenario: Applying migrations is idempotent

- **WHEN** the migrate command is run again against an already-migrated database
- **THEN** no changes are applied and the command reports the schema is up to
  date

### Requirement: Append-only audit trail with hash chain

The system SHALL treat `AuditEvent`, `Disposition`, and `SupervisorReview` as
append-only. The database SHALL reject any `UPDATE` or `DELETE` on these tables.
Each `AuditEvent` SHALL carry a hash linked to the previous event so that
tampering with historical records is detectable.

#### Scenario: Update on an append-only record is rejected

- **WHEN** any actor attempts to `UPDATE` or `DELETE` a row in `AuditEvent`,
  `Disposition`, or `SupervisorReview`
- **THEN** the database raises an error and the row is left unchanged

#### Scenario: Correcting a past record creates a new event

- **WHEN** a correction to a previously recorded decision is required
- **THEN** the system appends a new event rather than modifying the existing one

#### Scenario: Broken hash chain is detectable

- **WHEN** an `AuditEvent` row's stored hash does not match the recomputed hash
  of its contents plus the prior event's hash
- **THEN** the chain verification reports the audit trail as compromised

### Requirement: Every non-pass conclusion carries evidence

The system SHALL require that any `RuleResult` or `MatchResult` whose outcome is
not a plain pass references at least one `Evidence` row. The database SHALL
enforce this with a constraint rather than relying on application logic.

#### Scenario: Non-pass result without evidence is rejected

- **WHEN** a `RuleResult` with outcome `FAIL`, `GATED`, `ABSTAIN`, or
  `PENDING_HUMAN` (or a non-matched `MatchResult`) is written with no linked
  `Evidence`
- **THEN** the database rejects the write

#### Scenario: Cross-case rule links the related case

- **WHEN** a duplicate (R7) or split (R8) rule result is written
- **THEN** its evidence includes the related case reference so the UI can
  navigate to the counterpart case

### Requirement: Judgments are replayable

The system SHALL record, on each review run, the policy version, engine version,
and an input snapshot in effect at run time. Re-evaluating a historical case
SHALL NOT use a newer policy version than the one recorded on the run.

#### Scenario: Run captures replay context

- **WHEN** a review run completes
- **THEN** its `policyVersionId`, `engineVersion`, and `inputSnapshot` are
  persisted with the run

#### Scenario: Historical case is not re-judged with a newer policy

- **WHEN** a past case is re-opened for inspection
- **THEN** the recorded run's policy version is used, not the current active
  policy version

### Requirement: Disposition records the human conclusion

The system SHALL persist, on every reviewer disposition, both the agent
suggestion captured at decision time and the human final conclusion, as
independent values. The human final conclusion SHALL NOT be derived by copying
the agent suggestion. A disposition that records no conclusion — a reviewer
deferring the case — SHALL persist an absent final conclusion rather than a
substituted one.

Each disposition SHALL carry a consistency flag derived from those two values
and frozen at write time, so that a later policy or rule change cannot alter how
a historical decision is labelled.

#### Scenario: Human conclusion differs from agent suggestion

- **WHEN** a reviewer records a conclusion that differs from the agent
  suggestion captured at decision time
- **THEN** both values are persisted on the disposition and remain
  distinguishable when the record is read back

#### Scenario: Deferred decision records no conclusion

- **WHEN** a reviewer defers the case instead of concluding it
- **THEN** the disposition's final conclusion is absent and the consistency flag
  records that no decision has been reached

#### Scenario: Frozen flag survives a policy change

- **WHEN** the policy version or rule catalogue changes after a disposition was
  written
- **THEN** the stored consistency flag on that disposition is unchanged

### Requirement: Consistency flag value domain covers every disposition

The persisted consistency-flag value domain SHALL include a value for every
outcome the disposition matrix permits, including a reviewer deferring without
concluding. The database SHALL NOT permit a disposition without a flag.

The database constraint requiring a reason SHALL apply exactly to the flag
values that denote a human conclusion diverging from, or substituting for, the
agent suggestion, and SHALL NOT require a reason for a deferred decision.

#### Scenario: Deferred disposition is accepted without a reason

- **WHEN** a disposition flagged as no-decision-reached is written with no
  reason
- **THEN** the database accepts the write

#### Scenario: Diverging conclusion without a reason is rejected

- **WHEN** a disposition flagged as an override or as human-assumed judgement is
  written with a missing or blank reason
- **THEN** the database rejects the write

#### Scenario: Value domain extension is applied by migration

- **WHEN** a new consistency-flag value is introduced
- **THEN** it is added through a new committed migration, existing migrations
  are left unmodified, and the shared vocabulary is updated to match

### Requirement: Case records the applicant's department

An expense case SHALL persist the applicant's department as recorded on the case
at submission time. The field SHALL be optional: cases whose source system did
not supply a department SHALL persist no value rather than a placeholder, and
consumers SHALL treat the absence as "not recorded" rather than as an empty
department.

The department SHALL be stored on the case as a point-in-time value, so a later
organizational change SHALL NOT alter the department shown for an already
submitted case. The field SHALL be added through a new committed migration; an
already committed migration SHALL NOT be edited.

#### Scenario: Case persists a recorded department

- **WHEN** a case is created with a department
- **THEN** the department is persisted on the case and returned with it

#### Scenario: Case without a department

- **WHEN** a case is created with no department supplied
- **THEN** the case persists no department value, and reads report it as not
  recorded rather than as an empty string

#### Scenario: Department is added by migration

- **WHEN** a contributor runs the migrate command against an already-migrated
  database
- **THEN** a new migration adds the department field, every previously committed
  migration file is unchanged, and existing cases remain readable with no
  department recorded

#### Scenario: Department is a point-in-time value

- **WHEN** the department recorded on a submitted case is compared after the
  applicant moves to another department
- **THEN** the case still reports the department captured at submission time
