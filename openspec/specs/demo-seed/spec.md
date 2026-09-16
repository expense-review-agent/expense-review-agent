# demo-seed Specification

## Purpose

Defines deterministic Phase-1 seed data covering the ten required review
scenarios, so demos and tests always exercise the full four-way classification
and cross-case rules without depending on OCR or real financial data.

## Requirements

### Requirement: Ten-scenario demo coverage

The seed SHALL create demo cases covering, at minimum: a normal pass, a
duplicate submission (R7), a lodging over-limit (R1), a large-amount case
missing contract and approval (R3+R4), an amount mismatch (R5) with dual-basis
evaluation, a suspected split (R8), a multi-receipt sum difference (R10), a
foreign invoice where the agent abstains, a buyer-tax-id mismatch (R9), and an
unmatched receipt routed to human. Seed data SHALL use only simulated values and
SHALL NOT contain real invoice numbers or personal data.

#### Scenario: All four classifications are represented

- **WHEN** the seed completes
- **THEN** at least one case each of `NORMAL`, `EXCEPTION`, `MISSING`, and
  `HUMAN` exists

#### Scenario: Seed uses only simulated data

- **WHEN** seeded receipts and attachments are inspected
- **THEN** they are marked as sample data and contain no real invoice numbers or
  personal information

### Requirement: Cross-case rules have paired fixtures

The seed SHALL provide paired cases for cross-case rules: the R7 duplicate case
SHALL reference a prior closed case sharing document number, amount, and date;
the R8 split case SHALL include multiple same-applicant, same-vendor,
within-window entries each below threshold but exceeding it in aggregate.
Reference cases SHALL be `REVIEW_CLOSED` and SHALL NOT appear in the default
pending queue.

#### Scenario: Duplicate rule triggers against a closed counterpart

- **WHEN** the duplicate demo case is evaluated
- **THEN** R7 triggers and its evidence points to the paired `REVIEW_CLOSED`
  reference case

#### Scenario: Single case never triggers a cross-case rule

- **WHEN** a case has no paired counterpart in the seed
- **THEN** R7 and R8 do not trigger for it

### Requirement: Deterministic, repeatable reset

The seed SHALL be rebuildable via a reset command that drops and recreates the
schema, re-runs migrations, and re-seeds. Case numbers within a seed batch SHALL
be stable across runs. The reset SHALL NOT use `TRUNCATE` or per-table `DELETE`
on append-only tables.

#### Scenario: Reset produces identical case numbers

- **WHEN** the reset command is run twice
- **THEN** the same demo case numbers exist after each run

#### Scenario: At least one low-confidence field exists

- **WHEN** the seed completes
- **THEN** at least one key extracted field has confidence level `LOW` or `NONE`
  (or is marked unrecognized), so the low-confidence guardrail is exercisable

#### Scenario: Low-confidence case is not classified normal

- **WHEN** a case with a low-confidence key field is evaluated
- **THEN** it is not classified `NORMAL`

### Requirement: Reference cases carry a complete closed review history

The paired `REVIEW_CLOSED` reference case for the duplicate rule (R7) SHALL be
seeded with a complete, internally consistent closed review history, so that
opening it from the counterpart case's evidence shows what the prior review
actually concluded. The history SHALL include expense line details (category,
vendor, document number, expense date) matching the fields the duplicate
evidence cites, a receipt, a completed agent run with its rule results, the
reviewer disposition, the supervisor review, and a hash-chained audit trail in
chronological order. All values SHALL remain simulated.

#### Scenario: Reference case matches the duplicate evidence

- **WHEN** the duplicate demo case's evidence cites a document number, amount,
  and date for its reference case
- **THEN** the reference case's expense line and receipt carry that same
  document number, amount, and date

#### Scenario: Reference case shows a concluded review

- **WHEN** the reference case is opened
- **THEN** it has a completed agent run with rule results, a reviewer
  disposition whose consistency flag follows the shared derivation for its agent
  action and final action, and a supervisor review closing the case

#### Scenario: Reference case audit chain verifies

- **WHEN** the reference case's audit trail is retrieved
- **THEN** events are in chronological sequence and the hash chain verifies as
  valid

### Requirement: Every disposed demo case has a real disposition record

A seeded case whose process status is `DISPOSED`, `AWAITING_INFO` or
`REVIEW_CLOSED` SHALL carry the disposition record that produced that status —
the acting reviewer, the reviewer action, the agent suggestion snapshot taken at
decision time, the persisted consistency flag, and a hash-chained audit event.
The seed SHALL NOT assign a post-`QUEUED` process status to a case without the
disposition that explains it: such a state cannot arise from the real review
flow, where only a reviewer disposition advances a case out of `QUEUED`.

Consistency flags SHALL be seeded as the value derived from the reviewer's final
action and the agent suggestion recorded at decision time — the same derivation
the API applies — so that demo badges match what the product would have written.

#### Scenario: Disposed case exposes its acting reviewer

- **WHEN** a seeded case with process status `DISPOSED` is read together with its
  dispositions
- **THEN** exactly one disposition explains the status, naming the acting
  reviewer, the reviewer action, and the persisted consistency flag

#### Scenario: No status without a disposition

- **WHEN** the seed completes and every case whose process status is not `DRAFT`
  or `QUEUED` is inspected
- **THEN** each one has at least one disposition record, and none relies on a
  directly assigned status

#### Scenario: Disposition is accompanied by an audit event

- **WHEN** the audit trail of a seeded disposed case is verified
- **THEN** it contains the reviewer disposition event in sequence and the hash
  chain verifies

### Requirement: Demo cases carry department data

Seeded cases SHALL record a department so the workbench can exercise
department-scoped case history. The seed SHALL cover both the recorded and the
not-recorded case: at least two cases SHALL share one department, and at least
one case SHALL have no department recorded. Departments SHALL be simulated
values, consistent with the existing prohibition on real personal data.

#### Scenario: Cases share a department

- **WHEN** the seed completes
- **THEN** at least two cases record the same department, so a department history
  query returns more than one case

#### Scenario: A case without a department exists

- **WHEN** the seed completes
- **THEN** at least one case records no department, exercising the
  not-recorded path

#### Scenario: Departments are simulated

- **WHEN** seeded departments are inspected
- **THEN** they are sample values containing no real organizational or personal
  data
