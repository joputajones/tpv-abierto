# ADR-003: Fail closed when a required pre-migration backup is unsafe

- **Status:** Accepted
- **Date:** 2026-07-31
- **Decision owners:** Project owner
- **Related issues:** [#16](https://github.com/joputajones/tpv-abierto/issues/16)
- **Affected feature IDs:** CORE-003, BACKUP-001, BACKUP-002
- **Affected risk IDs:** R-005

## Context

The migration runner historically attempted a local copy before a pending
migration batch, but caught every backup error and continued. Existing released
migrations include destructive operations, so a warning without a verified
recovery copy is not an acceptable safety boundary.

`PRAGMA user_version = 0` cannot distinguish a new installation from an old
database. The maintained synthetic v1.5.0 fixture is an existing database with
that value. File size, table count, row count, dates and names are equally
unsafe classification heuristics.

## Decision drivers

- No pending migration may modify an existing database without a verified local copy.
- Classification must happen before SQLite can create the file.
- The source database, data and version must remain unchanged on backup failure.
- The core safety path must work offline and without cloud services.
- Operator and telemetry errors must not expose database paths or contents.
- Released migrations remain immutable.

## Options considered

### Continue after logging a warning

Rejected because it leaves the most consequential migration path unprotected.

### Treat `user_version = 0`, a small file or an empty-looking database as new

Rejected because all are valid states for an existing installation. They can
silently misclassify data that needs protection.

### Accept a copied file without opening and checking it

Rejected because existence alone does not prove that the copy is complete,
self-contained, readable or at the expected version.

### Require a cloud backup

Rejected because core migration safety must remain local and offline. Optional
off-device backup is separate defence in depth.

### Edit released migrations

Rejected because historical migrations are immutable. The safety boundary
belongs around the pending batch.

## Decision

Capture `databaseExistedBeforeOpen` immediately before `new Database(...)`.
Only prior absence of the database file defines a truly new installation.

When the file existed and migrations are pending, complete this sequence before
the first migration:

1. validate the managed backup destination;
2. run `PRAGMA wal_checkpoint(TRUNCATE)` and reject a busy or incomplete result;
3. copy exclusively to a non-valid `.partial` path;
4. open the candidate and switch it to DELETE journal mode;
5. stamp `_flo_meta` with the source schema version, creation time and app version;
6. require matching `PRAGMA user_version` and metadata;
7. require `PRAGMA integrity_check` to return only `ok`;
8. close and reopen the candidate read-only, then repeat version and integrity checks;
9. atomically rename the verified candidate to its managed backup name.

Any preparation, checkpoint, copy, open, stamp, integrity, version, finalisation
or cleanup failure blocks the entire migration batch. Partial files and their
WAL/SHM sidecars are removed without deleting the source or older valid backups.

An existing database already at the current version needs no new migration
backup. A truly new installation may initialise without creating a meaningless
copy of the file SQLite just created.

## Consequences

### Positive

- Existing databases fail closed before the first pending migration.
- The backup has explicit version and integrity evidence and is independently readable.
- Fresh installation is deterministic and does not depend on backup-directory creation.
- The policy is local-first and adds no dependency or service.

### Negative

- A full disk, locked file, incomplete checkpoint or invalid destination now blocks startup.
- Support must help the operator correct local storage or competing-process problems.
- A local verified copy does not protect against total device loss.

### Operational impact

- installation: only prior file absence receives the new-install exception;
- offline operation: unchanged; the safety path is entirely local;
- backups and recovery: a verified pre-migration copy can retry the synthetic upgrade independently;
- diagnostics and support: the operator sees actionable, sanitised guidance;
- data migration: no migration begins until the copy is fully verified;
- security and privacy: telemetry contains only error type, stage and schema versions;
- licensing: no dependency or licence change.

## Validation

- Reproduce the former fail-open behaviour against the real initialization path.
- Inject deterministic checkpoint, copy, integrity, version and finalisation failures.
- Assert source version, rows, tables and columns remain unchanged on every failure.
- Validate a real v0→v38 upgrade, schema parity and idempotent reopen.
- Open the pre-migration copy read-only and retry the real upgrade in a second temporary directory.
- Validate new-file, existing-v0 and current-version classifications.
- Compare a deterministic hash of the complete `MIGRATIONS` block with `origin/main`.
- Run the complete Windows and Linux CI suites.

## Rollback or replacement strategy

Do not restore the former fail-open behaviour. If this implementation must be
replaced, stop distribution of the affected build and introduce an equivalent
verified fail-closed barrier before removing this one. Existing backups are
ordinary SQLite files and remain usable; `.partial` files are never advertised
as valid backups.

## Limitations and follow-up work

- This decision does not prove off-device restore, destroyed-device recovery,
  different hardware, live restaurant recovery or fiscal compliance.
- Add an operational restore drill and external-backup policy under R-011.
- Preserve the historical migrations and extend fixtures when supported legacy
  versions need explicit upgrade evidence.
