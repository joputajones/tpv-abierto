# Development workflow

This workflow keeps ChatGPT Work, Codex, GitHub and the project documents aligned.

## Sources of truth

- Product scope and acceptance: `PRODUCT_SPEC.md`
- Current state: `STATUS.md`
- Ordered milestones: `ROADMAP.md`
- Requirement status: `FEATURE_MATRIX.md`
- Validation evidence: `TEST_MATRIX.md`
- Long-term technical decisions: `decisions/`
- Work items and discussion: GitHub issues
- Reviewable implementation: pull requests

Chat messages are not the permanent source of truth. Decisions made in chat must be transferred into the appropriate repository document or issue.

## Roles

### ChatGPT Work

- maintain product scope and roadmap;
- turn findings into requirements and acceptance criteria;
- review risks, architecture and milestone readiness;
- prepare bounded tasks for Codex;
- verify that documentation and implementation remain aligned.

### Codex

- inspect the local repository and terminal output;
- work on one bounded issue at a time;
- run required tests and builds;
- update tracking documents when behaviour changes;
- produce reviewable commits and pull requests.

### Human project owner

- approve scope and architectural decisions;
- provide access to real hardware and sanitised source data;
- validate restaurant workflows;
- accept or reject milestone exits.

## Issue types

Use one clear type at the start of every issue title:

- `[AUDIT]` inspection or baseline verification
- `[FEATURE]` new user-facing capability
- `[FIX]` defect correction
- `[TEST]` missing validation or fixture
- `[DOCS]` documentation work
- `[ADR]` architectural decision
- `[RISK]` mitigation work
- `[IMPORT]` migration/importer work
- `[OPS]` installation, network, recovery or support tooling

## Required issue fields

Every implementation issue must include:

1. Problem statement.
2. User or operational impact.
3. Scope.
4. Explicit non-scope.
5. Acceptance criteria.
6. Validation commands or physical test procedure.
7. Relevant feature and test IDs.
8. Risks affected.
9. Documentation that must be updated.

## Branches

Use short-lived branches from the agreed integration branch:

- `audit/<name>`
- `feature/<name>`
- `fix/<name>`
- `test/<name>`
- `docs/<name>`
- `import/<name>`
- `ops/<name>`

Do not combine unrelated work in one branch.

## Pull requests

A pull request must contain:

- summary of the problem and solution;
- linked issue;
- changed behaviour;
- test/build commands and exact outcomes;
- manual or hardware test evidence where applicable;
- database migration impact;
- offline-operation impact;
- privacy/security impact;
- rollback plan;
- tracking documents updated.

A documentation-only PR may state that runtime tests are not applicable, but must still check links and internal consistency.

## Definition of done

A work item is `DONE` only when:

- acceptance criteria pass;
- required automated tests pass;
- relevant builds pass;
- manual or hardware tests are complete where required;
- no undocumented destructive migration exists;
- no credential or customer data is committed;
- documentation is updated;
- the PR is reviewed and merged;
- `FEATURE_MATRIX.md`, `TEST_MATRIX.md` or `STATUS.md` reflects the result.

## Decision records

Create an ADR when a decision:

- changes architecture or data ownership;
- adds a persistent external dependency;
- changes licensing or distribution;
- changes update, backup or recovery strategy;
- changes local/offline guarantees;
- changes fiscal boundaries;
- is expensive to reverse.

Use `decisions/ADR-000-template.md`.

## Milestone review

At each milestone exit:

1. Update `STATUS.md`.
2. Review all feature rows assigned to the milestone.
3. Review required tests and evidence.
4. Review open risks with priority 15 or greater.
5. Record unresolved gaps rather than silently carrying them forward.
6. Approve the exit explicitly in a milestone issue or ADR.

## Public repository safety

Never commit:

- raw `C:\BLATTA` contents;
- production MDB or SQLite databases;
- customer names, tickets or sales history;
- staff PINs or credentials;
- real network passwords or private IP plans tied to a customer;
- diagnostic bundles that have not been reviewed and sanitised.

Use synthetic or explicitly sanitised fixtures only.
