# Test matrix

This document defines operational evidence required before a real restaurant pilot. Test results should be linked from issues or pull requests and summarised in `STATUS.md`.

## Evidence levels

- `CODE`: automated unit or integration test.
- `BUILD`: successful build or packaging output.
- `SIM`: controlled simulation without physical restaurant hardware.
- `BENCH`: test using representative physical hardware and LAN.
- `PILOT`: observation in the real pilot restaurant.

A critical capability should not be considered production-ready with `CODE` evidence alone.

## Baseline and build

| Test ID | Scenario | Required evidence | Status |
|---|---|---|---|
| T-BLD-001 | Fresh dependency installation | Command log | `NOT_STARTED` |
| T-BLD-002 | Main TypeScript build | `BUILD` | `NOT_STARTED` |
| T-BLD-003 | Frontend static build | `BUILD` | `NOT_STARTED` |
| T-BLD-004 | Windows application launch | `BUILD` + screenshot/log | `NOT_STARTED` |
| T-BLD-005 | Existing test suite | Command log | `NOT_STARTED` |
| T-BLD-006 | Existing database upgrade path | `CODE` | `NOT_STARTED` |

## Orders and concurrency

| Test ID | Scenario | Required evidence | Status |
|---|---|---|---|
| T-ORD-001 | Create a dine-in order on one client | `SIM` | `NOT_STARTED` |
| T-ORD-002 | Add item and modifier after initial order | `SIM` | `NOT_STARTED` |
| T-ORD-003 | Two clients update the same table in sequence | `SIM` + logs | `NOT_STARTED` |
| T-ORD-004 | Restart application after accepting order | `SIM` | `NOT_STARTED` |
| T-ORD-005 | Abrupt process termination after accepted order | `SIM` | `NOT_STARTED` |
| T-ORD-006 | Cancel/void flow preserves audit trail | `SIM` | `NOT_STARTED` |

## Kitchen and printing

| Test ID | Scenario | Required evidence | Status |
|---|---|---|---|
| T-KIT-001 | Order appears once in KDS | `SIM` | `NOT_STARTED` |
| T-KIT-002 | Items route to correct kitchen station | `SIM` | `NOT_STARTED` |
| T-PRN-001 | Test print through supported ESC/POS path | `BENCH` | `NOT_STARTED` |
| T-PRN-002 | Printer offline when order is accepted | `BENCH` | `NOT_STARTED` |
| T-PRN-003 | Pending job survives application restart | `BENCH` | `NOT_STARTED` |
| T-PRN-004 | Printer reconnects and controlled retry succeeds | `BENCH` | `NOT_STARTED` |
| T-PRN-005 | Retry cannot silently create duplicate ticket | `BENCH` | `NOT_STARTED` |
| T-PRN-006 | Wrong-destination configuration is diagnosable | `BENCH` | `NOT_STARTED` |

## Network and offline operation

| Test ID | Scenario | Required evidence | Status |
|---|---|---|---|
| T-NET-001 | Internet disconnected, LAN remains available | `BENCH` | `NOT_STARTED` |
| T-NET-002 | Mobile client reconnects after Wi-Fi interruption | `BENCH` | `NOT_STARTED` |
| T-NET-003 | Router reboot during non-critical period | `BENCH` | `NOT_STARTED` |
| T-NET-004 | Documented emergency-network procedure | `BENCH` | `NOT_STARTED` |
| T-NET-005 | Internet-only service queues or fails clearly | `SIM` | `NOT_STARTED` |

## Backup and recovery

| Test ID | Scenario | Required evidence | Status |
|---|---|---|---|
| T-BKP-001 | Manual backup creation | `SIM` | `NOT_STARTED` |
| T-BKP-002 | Automatic/local backup history | `SIM` | `NOT_STARTED` |
| T-BKP-003 | Restore into disposable installation | `SIM` | `NOT_STARTED` |
| T-BKP-004 | Database migration creates pre-migration backup | `CODE` + `SIM` | `NOT_STARTED` |
| T-BKP-005 | Restore instructions followed by a second person | `BENCH` | `NOT_STARTED` |

## Diagnostics and privacy

| Test ID | Scenario | Required evidence | Status |
|---|---|---|---|
| T-DIA-001 | Detect unavailable printer | `BENCH` | `NOT_STARTED` |
| T-DIA-002 | Detect low disk space | `SIM` | `NOT_STARTED` |
| T-DIA-003 | Detect stale or failed backup | `SIM` | `NOT_STARTED` |
| T-DIA-004 | Generate diagnostic bundle | `SIM` | `NOT_STARTED` |
| T-DIA-005 | Bundle contains no credentials or unnecessary personal data | Review checklist | `NOT_STARTED` |
| T-DIA-006 | Repair action requires correct permission level | `SIM` | `NOT_STARTED` |

## VirtuaPOS migration

| Test ID | Scenario | Required evidence | Status |
|---|---|---|---|
| T-IMP-001 | Parse sanitised JSON export | `CODE` | `NOT_STARTED` |
| T-IMP-002 | Decode Base64 labels deterministically | `CODE` | `NOT_STARTED` |
| T-IMP-003 | Validate counts and rejected records | `CODE` | `NOT_STARTED` |
| T-IMP-004 | Repeat import without uncontrolled duplicates | `CODE` + `SIM` | `NOT_STARTED` |
| T-IMP-005 | Generate migration report before write | `SIM` | `NOT_STARTED` |
| T-IMP-006 | Roll back or reset a failed test import | `SIM` | `NOT_STARTED` |

## Pilot gate

The real restaurant pilot cannot begin until all of these are at least `DONE`:

- T-ORD-001, T-ORD-004 and T-ORD-005
- T-KIT-001 and T-KIT-002
- T-PRN-002 through T-PRN-005 where printing is used
- T-NET-001 and T-NET-002
- T-BKP-001, T-BKP-003 and T-BKP-005
- T-DIA-001 and T-DIA-004
- T-IMP-001 through T-IMP-005 for migrated data

Fiscal checkout remains outside the non-fiscal pilot gate.
