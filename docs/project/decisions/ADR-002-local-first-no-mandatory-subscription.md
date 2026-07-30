# ADR-002: Local-first operation without mandatory subscription

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision owners:** Project owner
- **Related issues:** To be created during M1/M2
- **Affected feature IDs:** CORE-004, NET-001 through NET-003, BACKUP-001, BACKUP-002, DIAG-001 through DIAG-003
- **Affected risk IDs:** R-011, R-012, R-014, R-015

## Context

The first target restaurant stopped paying approximately €300 per year for maintenance and currently has an incomplete VirtuaPOS installation whose printing workflow is not functioning as needed. The project therefore targets restaurants that reject mandatory recurring charges for essential local operation.

The business model is based on professional installation, migration, hardware/network configuration, optional training, optional managed services and paid human support when required.

## Decision drivers

- The restaurant must retain use of its operational system after installation.
- Loss of internet or a vendor account must not stop local ordering and kitchen routing.
- Support costs must be reduced through diagnostics, documentation and recovery design.
- The product should reuse suitable existing hardware.
- The commercial offer must be transparent about what is included and what is billed separately.

## Options considered

### Mandatory SaaS subscription

Advantages:

- predictable recurring revenue;
- centralised updates and support.

Disadvantages:

- conflicts with the target customer's main objection;
- creates cloud and vendor dependency;
- increases commercial resistance in small independent bars.

### One-time licence with closed software

Advantages:

- no mandatory recurring fee;
- simpler commercial explanation.

Disadvantages:

- customer still depends on the vendor for repairability and continuity;
- weaker community and installer ecosystem.

### Open-source local-first core with paid services

Advantages:

- restaurant retains operational control;
- compatible with installation and migration revenue;
- supports independent repair and public training;
- cloud and AI services can remain optional.

Disadvantages:

- human support can become unprofitable without good diagnostics;
- revenue scales more like installation/services until partner channels mature;
- third parties can compete using the public code.

## Decision

The core restaurant workflow must run locally and remain usable without an active subscription. Internet-dependent capabilities may be optional enhancements, but their absence must not block order entry, table state, kitchen/bar routing, local backups or local troubleshooting.

The project will monetise implementation and optional services rather than disabling essential functionality when a payment stops.

## Consequences

### Positive

- Clear differentiation from mandatory-subscription competitors.
- Strong fit with the first real customer problem.
- Lower dependency on external service availability.
- Easier trust proposition around ownership and data access.

### Negative

- Reliability and recovery must be engineered carefully because support is not prepaid.
- Installation pricing must cover real deployment and warranty effort.
- Optional cloud and AI features need a separate cost model.

### Operational impact

- installation: must create a stable, documented local environment;
- offline operation: core product requirement and test gate;
- backups and recovery: local and independently restorable;
- diagnostics and support: public documentation and local deterministic checks are required;
- data migration: customer receives ownership and exportability of imported data;
- security and privacy: local storage does not remove the need for access controls and backups;
- licensing: core remains open-source subject to final project licence decisions and preserved upstream notices.

## Validation

- Complete internet-loss and LAN-continuity tests.
- Validate restart and backup recovery without cloud access.
- Measure the number and type of human interventions during the pilot.
- Confirm that ordinary staff can follow critical troubleshooting instructions.

## Rollback or replacement strategy

Optional managed services may be introduced later, but essential local functions cannot be moved behind a mandatory subscription without replacing this ADR through an explicit product decision.

## Follow-up work

- [ ] Define local-service availability targets.
- [ ] Design installation warranty and paid-intervention boundaries.
- [ ] Build the local diagnostic capability.
- [ ] Publish critical training and recovery documentation.
