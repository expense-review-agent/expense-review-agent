## ADDED Requirements

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
