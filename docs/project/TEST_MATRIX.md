# Test matrix

This document defines operational evidence required before a real restaurant
pilot. Test results should be linked from issues or pull requests and
summarised in `STATUS.md`.

## Evidence levels

- `CODE`: automated unit or integration test.
- `BUILD`: successful build or packaging output.
- `SIM`: controlled simulation without physical restaurant hardware.
- `CI_CROSS_RUNNER`: artifact transfer and validation between independent CI
  runners; stronger portability evidence than one-host simulation, but not
  physical hardware or human-operability evidence.
- `BENCH`: test using representative physical hardware and LAN.
- `PILOT`: observation in the real pilot restaurant.

A critical capability should not be considered production-ready with `CODE`
evidence alone.

## Off-device recovery integrated record

| Check | Status | Evidence and residual limit |
|---|---|---|
| Production backup API | `DONE` | PR #35/#33: synthetic v38 source is initialized through `main/db.ts` and exported through `createBackup()` |
| Exact portable package | `DONE` | `flo-backup.db`, `manifest.json`, `SHA256SUMS` and `RESTORE-INSTRUCTIONS.md`; package rejects missing/extra/non-regular files |
| Checksum before SQLite/destination | `DONE` | Local B-01/B-02/B-03 and both consumers reject mismatch before SQLite access or destination creation |
| Independent restore and continuity | `DONE` | Fresh jobs restore with production `restoreBackup()`, reopen, advance order/bill sequences, write and reopen again |
| Windows/Linux artifact transfer | `DONE` | Run 30671201413: Windows producer and independent Windows/Linux consumers share database SHA-256 `d2c4ee11…c1da95`; evidence `CI_CROSS_RUNNER` |
| Human blind drill | `PARTIAL` | #34 closed after a second operator restored on another physical computer and accessible checks passed; advanced technical checks were incomplete and the runbook was too technical. #39 tracks an assistant suitable for non-technical staff |

PR #35 closes only the automated scope in #33. It does not close M0. Portable
backup and automated independent-runner restore are `DONE` only at
`CI_CROSS_RUNNER`; R-011 remains `PARTIAL` because physical loss,
representative hardware and complete technical/human-operability evidence are
still absent.

## M0 evidence record

| Field | Value |
|---|---|
| Date | 2026-07-31 |
| Operating system | Windows 10 `10.0.19045`, PowerShell |
| Node / npm | Node `v22.20.0`; npm `10.9.3` |
| Analysed code base | Baseline `d366538fe1a5d798d5f6c6249b365e306e38efbc`; restart evidence integrated at `0b629ab6de5cf47939bc6c5305fe8faa4f43ee12` |
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
| `npm.cmd run test:restart-recovery` | `DONE` | PR #31 integrates R-01…R-12; Windows post-merge passes in 53.5 s and Linux CI logs all 12 PASS cases plus cleanup |
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

PR #31 adds the 67th root test. Its five CI gates pass, including every
R-01…R-12 case under Linux, and post-merge Windows validation repeats clean
install, matrix, upgrade, backup, both builds and all 67 scripts without Bash.

## Baseline and build

| Test ID | Scenario | Required evidence | Status | M0 note |
|---|---|---|---|---|
| T-BLD-001 | Fresh dependency installation | Command log | `DONE` | Integrated `main` passes clean PowerShell installation, Electron verification and native rebuild without Bash |
| T-BLD-002 | Main TypeScript build | `BUILD` | `DONE` | Integrated `main` TypeScript build passes locally and in Linux CI |
| T-BLD-003 | Frontend static build | `BUILD` | `DONE` | Integrated `main` exports 22 routes locally and in CI; tooling advisories remain tracked separately |
| T-BLD-004 | Windows application launch | `BUILD` + screenshot/log | `PARTIAL` | Initial Electron audit log plus repeated standalone launch; no packaged build |
| T-BLD-005 | Existing test suite | Command log | `DONE` | Integrated `main` passes all 68 scripts without Bash in the full Windows/Linux/macOS matrix; #16, #18, #20, #30 and automated recovery #33 are closed |
| T-BLD-006 | Existing database upgrade path | `CODE` | `DONE` | Integrated `main` blocks unsafe backup failures, preserves the v0 source and completes v0→v38 after verification |

## Controlled restart recovery — issue #30 / PR #31

All entries below are integrated at evidence level `SIM`, not physical
power-loss, hardware, off-device restore or restaurant evidence. PR #31 passed
Windows, Linux and Playwright, merged at `0b629ab`, and closed #30.

| Case | Shutdown / recovery scenario | Integrated result | Evidence / limitation |
|---|---|---|---|
| R-01 | Graceful shutdown without activity | `DONE` | Windows/Linux: API/KDS health 200, exit 0, integrity/version and port reuse after reopen |
| R-02 | Graceful shutdown after committed synthetic order and bill | `DONE` | Exactly one category, product, user, order and bill after reopen |
| R-03 | Abrupt termination while idle | `DONE` | Only the owned child PID is forced; services and database reopen without intervention |
| R-04 | Abrupt termination after committed WAL write | `DONE` | Non-empty WAL observed before kill; committed marker survives exactly once |
| R-05 | Abrupt termination with `BEGIN IMMEDIATE` open | `DONE` | Uncommitted marker absent; prior commit intact |
| R-06 | Commit followed by uncommitted operation | `DONE` | First operation present; second absent |
| R-07 | Sequence generation across restart | `DONE` | Two distinct monotonic production order numbers, no UNIQUE collision |
| R-08 | Five alternating graceful/abrupt cycles | `DONE` | Five commits accumulated, both uncommitted rows absent, no lock or drift |
| R-09 | Restart after sanitized v0→v38 upgrade | `DONE` | Migrations run once, one backup remains, rows/version stable across two reopens |
| R-10 | API/KDS port release and reuse | `DONE` | Isolated non-3001/3002 ports reuse after graceful and forced termination |
| R-11 | WAL/SHM auxiliary state | `DONE` | 18 states recorded; temporary presence accepted while integrity, exact rows and continued writes pass |
| R-12 | Profile/process isolation | `DONE` | Every DB path remains under one temp root; no logs or live children; sandbox removed in `finally` |

## Orders and concurrency

| Test ID | Scenario | Required evidence | Status | M0 note |
|---|---|---|---|---|
| T-ORD-001 | Create a dine-in order on one client | `SIM` | `PARTIAL` | Automated order creation passes; restart probe used synthetic takeaway order |
| T-ORD-002 | Add item and modifier after initial order | `SIM` | `PARTIAL` | Automated addon/order-item paths pass |
| T-ORD-003 | Two clients update the same table in sequence | `SIM` + logs | `NOT_STARTED` | No two-client run |
| T-ORD-004 | Restart application after accepting order | `SIM` | `DONE` | PR #31 preserves a committed synthetic order and bill through real graceful DB/service cleanup; not a full Electron window or operator test |
| T-ORD-005 | Abrupt process termination after accepted order | `SIM` | `DONE` | PR #31 preserves commits and reverts open transactions after killing only an owned child on Windows/Linux; not physical power loss |
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

### Provisional #40 branch matrix

The following results were collected locally on Windows from
`test/full-offline-operation`. They remain provisional until the technical PR
passes dedicated Windows/Linux CI and merges. The guard is process-scoped and
permits only loopback; it does not modify the host firewall. Evidence is
`SIM`, not a physical restaurant, hostile LAN, printer, phone or fiscal test.

| Case | Scenario | Local result | Evidence / residual limit |
|---|---|---|---|
| O-01 | Fresh startup | `PASS` | New disposable profile, schema 38/WAL, API/KDS/frontend 200 and zero pre-consent attempts |
| O-02 | First-run setup | `PASS` | Synthetic owner/config created locally with cloud and telemetry off, then restarted |
| O-03 | Catalogue | `PASS` | Category/product/table create, product edit and catalogue query through real API |
| O-04 | Order/KDS | `PASS` | Dine-in order, second quantity line, confirmation, KDS login/REST/WebSocket |
| O-05 | Bill/payment | `PASS` | Synthetic €36 total and cash payment persisted; no fiscal claim |
| O-06 | Orderly restart | `PASS` | Product/order/bill/payment survive; integrity/FK/version and write probe pass |
| O-07 | Abrupt restart | `PASS` | Owned child terminated, committed order recovers from WAL and database remains writable |
| O-08 | Optional services unconfigured | `PASS` | Cloud, Drive and WhatsApp produce zero external attempts; local API stays 200 |
| O-09 | Cloud unreachable | `PASS` | HTTPS/WSS attempt blocked, durable outbox retained, API/KDS stay 200; local command completed in 26–32 ms |
| O-10 | Telemetry without consent | `PASS` | Zero telemetry attempts |
| O-11 | Consented telemetry offline | `PASS` | Sanitized attempt to `telemetry.flopos.com` blocked and handled non-fatally |
| O-12 | Updater endpoint offline | `PASS` | Guarded updater-endpoint probe fails immediately and local health stays 200; unpackaged test does not exercise a real release feed |
| O-13 | Frontend resources | `PASS` | Runtime resources across exported HTML are local and present; hidden real Electron loads root/login/setup/POS/KDS/settings and CSP/webRequest deny explicit HTTPS/WSS probes |
| O-14 | Brief prolonged operation | `PASS` | Three additional synthetic orders/bills/payments complete without additional external retry growth |
| O-15 | Simulated reconnection | `PASS` | Real cloud outbox retries without POS restart against an explicitly mapped loopback HTTP simulator; not real cloud interoperability |
| O-16 | Isolation | `PASS` | Zero Internet successes, ports reusable, probable real profiles byte-identical, no orphan child, sandbox deleted |
| O-FP | False-positive rejection | `PASS` | Separate child intentionally permits `unauthorized.external.test` through loopback, exits 17 and names sanitized host/service |

Observed aggregate: 9 attempts, 7 blocked, 2 redirected to the approved O-15
loopback simulator, 0 successful Internet connections and maximum recorded
guard failure 0 ms against the explicit 250 ms threshold.

| Test ID | Scenario | Required evidence | Status | M0 note |
|---|---|---|---|---|
| T-NET-001 | Internet disconnected, LAN remains available | `BENCH` | `BLOCKED` | No isolated LAN/Internet test environment |
| T-NET-002 | Mobile client reconnects after Wi-Fi interruption | `BENCH` | `BLOCKED` | No ordinary phone or Wi-Fi interruption run |
| T-NET-003 | Router reboot during non-critical period | `BENCH` | `BLOCKED` | No router bench |
| T-NET-004 | Documented emergency-network procedure | `BENCH` | `NOT_STARTED` | Procedure not defined |
| T-NET-005 | Internet-only service queues or fails clearly | `SIM` | `PARTIAL` | O-08…O-15 pass locally with durable cloud outbox and fast guarded failures; Windows/Linux CI and merge pending |

## Backup and recovery

| Test ID | Scenario | Required evidence | Status | M0 note |
|---|---|---|---|---|
| T-BKP-001 | Manual backup creation | `SIM` | `PARTIAL` | Automated API/service path passes |
| T-BKP-002 | Automatic/local backup history | `SIM` | `PARTIAL` | Migration backups pass on happy path; no automatic local retention policy observed |
| T-BKP-003 | Restore into disposable installation | `SIM` | `PARTIAL` | Automated restore test passes |
| T-BKP-004 | Database migration creates pre-migration backup | `CODE` + `SIM` | `DONE` | Integrated path verifies version/integrity/read-only reopen, publishes atomically and proves isolated synthetic retry; not an off-device recovery claim |
| T-BKP-005 | Restore instructions followed by a second person | `BENCH` | `PARTIAL` | #34 confirms functional restore on another physical computer, but advanced checks were incomplete and the runbook was not suitable for non-technical staff; #39 open |

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
