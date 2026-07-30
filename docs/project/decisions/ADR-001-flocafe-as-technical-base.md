# ADR-001: Use FloCafe as the technical base

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision owners:** Project owner
- **Related issues:** To be created during M0
- **Affected feature IDs:** CORE-001 through CORE-004
- **Affected risk IDs:** R-001, R-007, R-008, R-017

## Context

The project evaluated the idea of building a restaurant POS from scratch and reviewed several existing open-source systems. FloCafe was selected because its interface and architecture appear closest to the intended product: local and offline-first operation, restaurant tables, KDS, ESC/POS printing, SQLite, TypeScript, Next.js and cross-platform packaging.

The project has not yet completed an independent technical audit. Selection as the base is therefore a strategic decision, not a claim that every upstream feature is production-ready.

uniCenta and Floreant may be studied for mature workflows, failure cases and operational ideas, but their code must not be copied into this repository without an explicit licence-compatibility review.

## Decision drivers

- Avoid rebuilding common POS functionality unnecessarily.
- Preserve a modern interface and TypeScript/React development environment.
- Retain local/offline operation and SQLite-based deployment.
- Use a permissive upstream licence while preserving attribution.
- Keep the first pilot achievable for a small team using ChatGPT Work and Codex.

## Options considered

### Build from scratch

Advantages:

- complete architectural control;
- no upstream coupling.

Disadvantages:

- very large time and reliability cost;
- high probability of recreating solved POS functions poorly;
- delays real restaurant validation.

### Base the product on FloCafe

Advantages:

- existing POS, KDS, printing and local-data foundations;
- modern frontend and backend stack;
- MIT-licensed upstream code;
- visible roadmap aligned with some project needs.

Disadvantages:

- maturity must be independently verified;
- upstream changes may conflict with the fork;
- Electron may be heavy for some low-end targets;
- Spanish fiscal and migration capabilities are not assumed to exist.

### Base the product on uniCenta or Floreant

Advantages:

- mature restaurant workflows and long operational history.

Disadvantages:

- older desktop architecture and interface;
- less aligned with the intended phone/PWA experience;
- different licences and greater integration risk.

## Decision

Use FloCafe as the only initial codebase. Maintain the original MIT notices and third-party licence obligations. Study other POS projects only as functional references until a separate legal and technical decision authorises code reuse.

Do not start a rewrite unless the M0/M1 evidence demonstrates that a specific FloCafe subsystem cannot satisfy the product requirements at reasonable cost.

## Consequences

### Positive

- Faster route to a working baseline and real test bench.
- Existing UI and restaurant-domain features can be validated rather than recreated.
- The fork can remain close to upstream where practical.

### Negative

- The project inherits upstream defects, design constraints and dependency choices.
- Upstream synchronisation becomes an ongoing maintenance concern.
- Documentation claims must be verified against actual code and tests.

### Operational impact

- installation: begins with current FloCafe packaging and is audited before replacement;
- offline operation: inherited behaviour must be tested, not assumed;
- backups and recovery: existing mechanisms remain until audited;
- diagnostics and support: new project capability, built around verified interfaces;
- data migration: implemented as a separate project layer;
- security and privacy: upstream defaults and telemetry require audit;
- licensing: MIT attribution is mandatory; other codebases remain reference-only.

## Validation

- Complete M0 commands and architecture audit.
- Complete M1 local-order, KDS, restart, printing and offline tests.
- Benchmark representative low-end hardware.
- Document every subsystem that must be replaced rather than extended.

## Rollback or replacement strategy

If the M0/M1 evidence shows that FloCafe is unsuitable, preserve the importer specifications, product requirements and test matrix as reusable assets. Any replacement base requires a new ADR comparing migration cost, licence and operational risk.

## Follow-up work

- [ ] Complete baseline audit.
- [ ] Record upstream commit used as the initial base.
- [ ] Define upstream synchronisation procedure.
- [ ] Audit dependencies and licences.
