## ADDED Requirements

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
