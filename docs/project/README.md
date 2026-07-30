# Project control

This directory is the source of truth for the development of the Spanish FloCafe-based distribution.

The documents here track what the product is, what has been verified, what is being built, what remains uncertain, and what is required before a real restaurant deployment.

## Documents

- [PRODUCT_SPEC.md](./PRODUCT_SPEC.md): product vision, scope, principles and acceptance criteria.
- [STATUS.md](./STATUS.md): current development snapshot. Update this after every meaningful milestone or PR.
- [ROADMAP.md](./ROADMAP.md): ordered phases and exit criteria.
- [FEATURE_MATRIX.md](./FEATURE_MATRIX.md): requirement-by-requirement implementation status.
- [TEST_MATRIX.md](./TEST_MATRIX.md): critical operational scenarios and evidence required.
- [RISK_REGISTER.md](./RISK_REGISTER.md): technical, operational, legal and commercial risks.
- [WORKFLOW.md](./WORKFLOW.md): issue, branch, PR and documentation rules.
- [decisions/](./decisions/): architecture decision records.

## Status vocabulary

Use only these values in tracking documents:

- `UNVERIFIED`: present or claimed, but not yet inspected or tested by this project.
- `NOT_STARTED`: approved work that has not begun.
- `IN_PROGRESS`: active implementation or validation.
- `BLOCKED`: cannot proceed until a named dependency is resolved.
- `PARTIAL`: some acceptance criteria pass, but the requirement is incomplete.
- `DONE`: implemented, tested and documented with evidence.
- `OUT_OF_SCOPE`: deliberately excluded from the current milestone.

`DONE` must never mean "the code exists". It means that the acceptance criteria pass and the evidence is linked from the relevant issue or pull request.

## Update rule

Every pull request that changes product behaviour must update at least one of:

- `STATUS.md`
- `FEATURE_MATRIX.md`
- `TEST_MATRIX.md`
- an ADR under `decisions/`

Do not commit restaurant databases, personal data, credentials, private network details or customer-specific diagnostics to this public repository.
