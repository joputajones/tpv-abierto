# Test matrix

This document defines operational evidence required before a real restaurant
pilot. Test results should be linked from issues or pull requests and
summarised in `STATUS.md`.

## Evidence levels

- `CODE`: automated unit or integration test.
- `BUILD`: successful build or packaging output.
- `SIM`: controlled simulation without physical restaurant hardware.
- `BENCH`: test using representative physical hardware and LAN.
- `PILOT`: observation in the real pilot restaurant.

A critical capability should not be considered production-ready with `CODE`
evidence alone.

## M0 evidence record

| Field | Value |
|---|---|
| Date | 2026-07-31 |
| Operating system | Windows 10 `10.0.19045`, PowerShell |
| Node / npm | Node `v22.20.0`; npm `10.9.3` |
| Analysed code base | `d366538fe1a5d798d5f6c6249b365e306e38efbc`; post-repair evidence recorded in PR #14 |
| Detailed log | [docs/audit/test-results.md](../audit/test-results.md) |

| Exact command | Result | Evidence and limitation |
|---|---|---|
| `node --version`; `npm.cmd --version` | `DONE` | Returned `v22.20.0` and `10.9.3`; baseline evidence merged in PR #14 |
| `npm.cmd ci` on historical audited `main` | `PARTIAL` | Historical exit 1 occurred because `verify:electron` could not find Bash; retained as failure history |
| Git Bash added only to process + `npm.cmd ci` | `PARTIAL` | Exit 0; 648 packages, native rebuild and Electron verification pass; environment workaround required |
| `npm.cmd ci --ignore-scripts` | `PARTIAL` | 648 packages; diagnostic only, not a valid production install; 1 moderate advisory |
| `npx.cmd install-electron` | `DONE` | Electron runtime `v43.2.0` available; integrated `main` completes native rebuild and Node verification without Bash |
| `npm.cmd test` on historical audited `main` | `PARTIAL` | Historical literal command exited 1 without Bash; retained as failure history |
| `$env:Path='C:\Program Files\Git\bin;'+$env:Path; npm.cmd test` | `PARTIAL` | Historical workaround reached the reports regression; PR #22 is now merged, #20 closed and the deterministic test passes 31/31 |
| `npm.cmd run test:reports-insights` on integrated `main` | `DONE` | PR #22 freezes the request clock, covers the inclusive 90-day boundary and passes 31/31 on Windows/Linux; #20 is closed |
| `npm.cmd ci` on integrated `main` | `DONE` | Exit 0 in 32.1 s without Bash after PR #28; 648 packages, native rebuild and Electron verification pass |
| `npm.cmd test` on integrated `main` | `DONE` | Exit 0 in 154.8 s without Bash after PR #28; all 66 scripts run, including those after migration backup |
| `npm.cmd run test:migration-backup-fail-closed` | `DONE` | Integrated production initialization blocks checkpoint, destination/copy/open, integrity, version and finalization failures before v1; existing v0/zero-byte files require backup |
| `npm.cmd run test:upgrade-path` | `DONE` | Integrated v0→v38 path creates a verified backup and passes integrity, FK, preservation, schema parity and idempotency |
| `npm.cmd run test:restart-recovery` | `PARTIAL` | #30 branch passes R-01…R-12 on Windows in 33.0 s with owned child processes, disposable `userData`, WAL recovery and cleanup; pending Linux CI and merge |
| `npm.cmd run build` | `PARTIAL` | TypeScript and runtime-asset copy pass |
| `npm.cmd run build:frontend` | `PARTIAL` | Next 16.2.12 exports 22 routes; the current clean install reports 0 frontend vulnerabilities, while the historical 9-high result remains recorded |
| `node dev-server.js` | `PARTIAL` | API/POS `:3001`, KDS `:3002`, health and HTML 200; synthetic order survived termination/restart |
| `npm.cmd audit --json` | `PARTIAL` | 1 moderate transitive development advisory (`tar`) |
| `cd frontend; npm.cmd audit --json` | `PARTIAL` | Historical direct audit found 9 high lint/tooling advisories; the current clean-install output reports 0, but the direct audit was not repeated in the post-PR #28 gate |

PR #21 and #18 are complete for the Bash-free development path. Hardware,
off-device recovery, network-failure and pilot evidence was not manufactured
from code tests, and historical failures remain recorded above.

PR #28 adds the 66th root test. Integrated Windows validation passes all 66
scripts without Bash; Linux baseline and Playwright also pass. #16 is closed
and R-005 is `DONE` for the premigration scope only.

## Baseline and build

| Test ID | Scenario | Required evidence | Status | M0 note |
|---|---|---|---|---|
| T-BLD-001 | Fresh dependency installation | Command log | `DONE` | Integrated `main` passes clean PowerShell installation, Electron verification and native rebuild without Bash |
| T-BLD-002 | Main TypeScript build | `BUILD` | `DONE` | Integrated `main` TypeScript build passes locally and in Linux CI |
| T-BLD-003 | Frontend static build | `BUILD` | `DONE` | Integrated `main` exports 22 routes locally and in CI; tooling advisories remain tracked separately |
| T-BLD-004 | Windows application launch | `BUILD` + screenshot/log | `PARTIAL` | Initial Electron audit log plus repeated standalone launch; no packaged build |
| T-BLD-005 | Existing test suite | Command log | `DONE` | Integrated `main` passes all 66 scripts without Bash on Windows and passes the Linux core suite; #16, #18 and #20 are closed |
| T-BLD-006 | Existing database upgrade path | `CODE` | `DONE` | Integrated `main` blocks unsafe backup failures, preserves the v0 source and completes v0→v38 after verification |

## Controlled restart recovery — issue #30

All entries below are evidence level `SIM`, not physical power-loss, hardware,
off-device restore or restaurant evidence. Status remains `PARTIAL` until the
branch is reviewed, passes Linux CI and is merged.

| Case | Shutdown / recovery scenario | Branch result | Evidence / limitation |
|---|---|---|---|
| R-01 | Graceful shutdown without activity | `PARTIAL` | PASS locally: API/KDS health 200, exit 0, integrity/version and port reuse after reopen |
| R-02 | Graceful shutdown after committed synthetic order and bill | `PARTIAL` | PASS locally: exactly one category, product, user, order and bill after reopen |
| R-03 | Abrupt termination while idle | `PARTIAL` | PASS locally: only the owned child PID is forced; services and database reopen without intervention |
| R-04 | Abrupt termination after committed WAL write | `PARTIAL` | PASS locally: non-empty WAL observed before kill; committed marker survives exactly once |
| R-05 | Abrupt termination with `BEGIN IMMEDIATE` open | `PARTIAL` | PASS locally: uncommitted marker absent; prior commit intact |
| R-06 | Commit followed by uncommitted operation | `PARTIAL` | PASS locally: first operation present, second absent |
| R-07 | Sequence generation across restart | `PARTIAL` | PASS locally: two distinct monotonic production order numbers, no UNIQUE collision |
| R-08 | Five alternating graceful/abrupt cycles | `PARTIAL` | PASS locally: five commits accumulated, both uncommitted rows absent, no lock or drift |
| R-09 | Restart after sanitized v0→v38 upgrade | `PARTIAL` | PASS locally: migrations run once, one backup remains, rows/version stable across two reopens |
| R-10 | API/KDS port release and reuse | `PARTIAL` | PASS locally on isolated non-3001/3002 ports after graceful and forced termination |
| R-11 | WAL/SHM auxiliary state | `PARTIAL` | 18 states recorded; temporary presence accepted while integrity, exact rows and continued writes pass |
| R-12 | Profile/process isolation | `PARTIAL` | Every DB path remains under one temp root; no logs or live children; sandbox removed in `finally` |

## Orders and concurrency

| Test ID | Scenario | Required evidence | Status | M0 note |
|---|---|---|---|---|
| T-ORD-001 | Create a dine-in order on one client | `SIM` | `PARTIAL` | Automated order creation passes; restart probe used synthetic takeaway order |
| T-ORD-002 | Add item and modifier after initial order | `SIM` | `PARTIAL` | Automated addon/order-item paths pass |
| T-ORD-003 | Two clients update the same table in sequence | `SIM` + logs | `NOT_STARTED` | No two-client run |
| T-ORD-004 | Restart application after accepting order | `SIM` | `PARTIAL` | #30 branch preserves a committed synthetic order and bill through the real graceful DB/service cleanup; pending merge and not a full Electron window test |
| T-ORD-005 | Abrupt process termination after accepted order | `SIM` | `PARTIAL` | #30 branch preserves commits and reverts open transactions after killing only an owned child; pending Linux CI and merge |
| T-ORD-006 | Cancel/void flow preserves audit trail | `SIM` | `PARTIAL` | Automated cancel/override tests pass; no operator workflow evidence |

## Kitchen and printing

| Test ID | Scenario | Required evidence | Status | M0 note |
|---|---|---|---|---|
| T-KIT-001 | Order appears once in KDS | `SIM` | `PARTIAL` | REST/WebSocket automation passes; no secondary display |
| T-KIT-002 | Items route to correct kitchen station | `SIM` | `PARTIAL` | Automated station-routing paths pass |
| T-PRN-001 | Test print through supported ESC/POS path | `BENCH` | `BLOCKED` | Byte/profile tests only; no hardware |
| T-PRN-002 | Printer offline when order is accepted | `BENCH` | `BLOCKED` | Hardware unavailable |
| T-PRN-003 | Pending job survives application restart | `BENCH` | `BLOCKED` | No persistent print queue is implemented or evidenced |
| T-PRN-004 | Printer reconnects and controlled retry succeeds | `BENCH` | `BLOCKED` | Hardware unavailable |
| T-PRN-005 | Retry cannot silently create duplicate ticket | `BENCH` | `BLOCKED` | No physical/idempotency evidence |
| T-PRN-006 | Wrong-destination configuration is diagnosable | `BENCH` | `BLOCKED` | Hardware and operator workflow unavailable |

## Network and offline operation

| Test ID | Scenario | Required evidence | Status | M0 note |
|---|---|---|---|---|
| T-NET-001 | Internet disconnected, LAN remains available | `BENCH` | `BLOCKED` | No isolated LAN/Internet test environment |
| T-NET-002 | Mobile client reconnects after Wi-Fi interruption | `BENCH` | `BLOCKED` | No ordinary phone or Wi-Fi interruption run |
| T-NET-003 | Router reboot during non-critical period | `BENCH` | `BLOCKED` | No router bench |
| T-NET-004 | Documented emergency-network procedure | `BENCH` | `NOT_STARTED` | Procedure not defined |
| T-NET-005 | Internet-only service queues or fails clearly | `SIM` | `PARTIAL` | Negative service tests pass; full Electron offline campaign not run |

## Backup and recovery

| Test ID | Scenario | Required evidence | Status | M0 note |
|---|---|---|---|---|
| T-BKP-001 | Manual backup creation | `SIM` | `PARTIAL` | Automated API/service path passes |
| T-BKP-002 | Automatic/local backup history | `SIM` | `PARTIAL` | Migration backups pass on happy path; no automatic local retention policy observed |
| T-BKP-003 | Restore into disposable installation | `SIM` | `PARTIAL` | Automated restore test passes |
| T-BKP-004 | Database migration creates pre-migration backup | `CODE` + `SIM` | `DONE` | Integrated path verifies version/integrity/read-only reopen, publishes atomically and proves isolated synthetic retry; not an off-device recovery claim |
| T-BKP-005 | Restore instructions followed by a second person | `BENCH` | `BLOCKED` | Second operator and off-device copy unavailable |

## Diagnostics and privacy

| Test ID | Scenario | Required evidence | Status |
|---|---|---|---|
| T-DIA-001 | Detect unavailable printer | `BENCH` | `BLOCKED` |
| T-DIA-002 | Detect low disk space | `SIM` | `NOT_STARTED` |
| T-DIA-003 | Detect stale or failed backup | `SIM` | `NOT_STARTED` |
| T-DIA-004 | Generate diagnostic bundle | `SIM` | `NOT_STARTED` |
| T-DIA-005 | Bundle contains no credentials or unnecessary personal data | Review checklist | `NOT_STARTED` |
| T-DIA-006 | Repair action requires correct permission level | `SIM` | `NOT_STARTED` |

## VirtuaPOS migration

| Test ID | Scenario | Required evidence | Status |
|---|---|---|---|
| T-IMP-001 | Parse sanitised JSON export | `CODE` | `BLOCKED` |
| T-IMP-002 | Decode Base64 labels deterministically | `CODE` | `BLOCKED` |
| T-IMP-003 | Validate counts and rejected records | `CODE` | `BLOCKED` |
| T-IMP-004 | Repeat import without uncontrolled duplicates | `CODE` + `SIM` | `NOT_STARTED` |
| T-IMP-005 | Generate migration report before write | `SIM` | `NOT_STARTED` |
| T-IMP-006 | Roll back or reset a failed test import | `SIM` | `NOT_STARTED` |

The first three importer tests are blocked until a fixture is explicitly
sanitised and approved. Raw restaurant files and `C:\BLATTA` content must not
be committed.

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
