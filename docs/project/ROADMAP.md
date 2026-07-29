# Roadmap

The roadmap is milestone-based. Dates are secondary to exit criteria. A phase is not complete until its evidence is linked from `STATUS.md` and the relevant issues or pull requests.

## M0 — Reproducible baseline

**Status:** `IN_PROGRESS`

Goal: understand and reproduce the current FloCafe codebase without functional changes.

Exit criteria:

- clean dependency installation;
- existing tests and builds executed;
- Windows launch verified;
- database, migrations, backups, logs, ports and external services documented;
- known discrepancies between documentation and code recorded;
- baseline risk assessment completed.

## M1 — Local operational proof

**Status:** `NOT_STARTED`

Goal: prove the essential restaurant flow on a test bench.

Scope:

- disposable catalogue and users;
- tables and dine-in orders;
- KDS and kitchen routing;
- at least two simultaneous local clients;
- application restart and data persistence;
- backup and restore;
- loss-of-internet test;
- printer simulation first, physical printer test when available.

Exit criteria:

- all critical M1 scenarios in `TEST_MATRIX.md` pass;
- failures produce actionable logs;
- no silent order loss or uncontrolled duplicate printing;
- gaps are converted into issues with acceptance criteria.

## M2 — Spanish non-fiscal distribution

**Status:** `NOT_STARTED`

Goal: adapt the product for a Spanish pilot without claiming fiscal production readiness.

Scope:

- reviewed Spanish localisation;
- euro and IVA-oriented configuration;
- installation profile for Windows and later Linux/ARM64;
- controlled update policy with rollback;
- local diagnostics;
- local help and troubleshooting;
- network-health checks and emergency-network design;
- privacy and telemetry decisions;
- initial installer documentation.

Exit criteria:

- installation can be repeated from written instructions;
- the pilot can work locally without cloud services;
- recovery procedures are tested by someone other than the implementer;
- no production default credentials remain.

## M3 — VirtuaPOS migration tooling

**Status:** `BLOCKED`

Blocker: full `C:\BLATTA` acquisition and sanitised test fixtures.

Goal: industrialise catalogue and configuration migration from VirtuaPOS.

Planned components:

- installation scanner;
- JSON/Base64 decoder;
- MDB reader;
- schema detector;
- normaliser;
- validation report;
- idempotent import;
- rollback or clean re-import strategy.

Initial scope:

- categories;
- products;
- prices;
- VAT configuration;
- modifiers and groups;
- users and payment-method metadata where safe.

Later scope depends on evidence found in the complete installation:

- tables and rooms;
- printers and routing;
- historical tickets and sales.

Exit criteria:

- deterministic import report;
- sanitised fixtures and automated tests;
- repeated import does not create uncontrolled duplicates;
- manual review items are clearly listed.

## M4 — Real restaurant non-fiscal pilot

**Status:** `NOT_STARTED`

Goal: use the new system for order taking and kitchen/bar routing while the existing fiscal system remains responsible for fiscal checkout.

Scope:

- real catalogue import;
- mobile waiters;
- kitchen/bar routing;
- incident logging;
- training material;
- local diagnostics;
- recovery drill;
- explicit rollback plan to the previous workflow.

Exit criteria:

- agreed pilot period completed;
- every incident classified by cause;
- recurring incidents converted into tests, documentation or deterministic repairs;
- owner and staff feedback recorded;
- no unresolved critical data-loss or service-continuity issue.

## M5 — Spanish fiscal product

**Status:** `OUT_OF_SCOPE`

Goal: add fiscal production capability only after specialist legal/fiscal validation.

Potential scope:

- invoice series and numbering;
- simplified and complete invoices;
- corrections and refunds;
- auditability and integrity controls;
- VeriFactu;
- TicketBAI as a separate regional capability;
- declaration, documentation and conformance evidence required by law.

Exit criteria cannot be finalised until the applicable legal and technical requirements are independently reviewed.

## Future milestones

Not committed until pilot evidence justifies them:

- installer certification and partner network;
- optional managed backups;
- optional online AI support;
- advanced inventory;
- multi-site operation;
- additional legacy importers.
