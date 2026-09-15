## ADDED Requirements

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
