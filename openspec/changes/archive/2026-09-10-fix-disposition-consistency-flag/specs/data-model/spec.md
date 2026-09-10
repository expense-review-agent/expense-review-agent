## ADDED Requirements

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
