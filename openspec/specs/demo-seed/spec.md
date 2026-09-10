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
