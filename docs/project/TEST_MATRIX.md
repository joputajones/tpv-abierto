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
| `npm.cmd ci` on audited `main` | `PARTIAL` | Historical exit 1 occurred because `verify:electron` could not find Bash; after integrating current `main`, PR #21 exits 0, installs 648 packages, rebuilds `better-sqlite3` and verifies Electron without Bash. CI and merge remain ([#18](https://github.com/joputajones/tpv-abierto/issues/18)) |
| Git Bash added only to process + `npm.cmd ci` | `PARTIAL` | Exit 0; 648 packages, native rebuild and Electron verification pass; environment workaround required |
| `npm.cmd ci --ignore-scripts` | `PARTIAL` | 648 packages; diagnostic only, not a valid production install; 1 moderate advisory |
| `npx.cmd install-electron` | `PARTIAL` | Electron runtime `v43.2.0` available; native rebuild and Node verifier pass without Bash on PR #21; merge remains pending |
| `npm.cmd test` on audited `main` | `PARTIAL` | Historical literal command exits 1 without Bash; after integrating current `main`, PR #21 runs all 65 scripts and exits 0 without Bash, but awaits CI and merge |
| `$env:Path='C:\Program Files\Git\bin;'+$env:Path; npm.cmd test` | `PARTIAL` | Historical workaround reached the reports regression; PR #22 is now merged, #20 closed and the deterministic test passes 31/31 |
| `npm.cmd run test:reports-insights` on audited `main` | `DONE` | PR #22 freezes the request clock, covers the inclusive 90-day boundary and passes 31/31 on Windows/Linux; #20 is closed |
| `npm.cmd run test:upgrade-path` | `PARTIAL` | v0→v38, backup, integrity, FK, preservation, schema parity and idempotency pass; backup-failure behaviour remains unsafe |
| `npm.cmd run build` | `PARTIAL` | TypeScript and runtime-asset copy pass |
| `npm.cmd run build:frontend` | `PARTIAL` | Next 16.2.12 exports 22 routes; 9 high frontend tooling advisories remain |
| `node dev-server.js` | `PARTIAL` | API/POS `:3001`, KDS `:3002`, health and HTML 200; synthetic order survived termination/restart |
| `npm.cmd audit --json` | `PARTIAL` | 1 moderate transitive development advisory (`tar`) |
| `cd frontend; npm.cmd audit --json` | `PARTIAL` | 9 high advisories in frontend lint/tooling dependency paths |

Portability statuses remain `PARTIAL` until PR #21 passes CI and is merged.
Hardware, network-failure and pilot evidence was not manufactured from code
tests, and historical failures remain recorded above.

## Baseline and build

| Test ID | Scenario | Required evidence | Status | M0 note |
|---|---|---|---|---|
| T-BLD-001 | Fresh dependency installation | Command log | `PARTIAL` | PR #21 passes clean PowerShell installation and native rebuild without Bash; CI and merge remain |
| T-BLD-002 | Main TypeScript build | `BUILD` | `PARTIAL` | PR #21 build passes after integrating current `main`; CI and merge remain |
| T-BLD-003 | Frontend static build | `BUILD` | `PARTIAL` | PR #21 exports 22 routes; CI, merge and tooling advisories remain |
| T-BLD-004 | Windows application launch | `BUILD` + screenshot/log | `PARTIAL` | Initial Electron audit log plus repeated standalone launch; no packaged build |
| T-BLD-005 | Existing test suite | Command log | `PARTIAL` | PR #22 is merged and #20 closed; PR #21 passes all 65 scripts without Bash, while CI and merge remain required |
| T-BLD-006 | Existing database upgrade path | `CODE` | `PARTIAL` | Happy path passes; premigration backup failure is not fail-closed |

## Orders and concurrency

| Test ID | Scenario | Required evidence | Status | M0 note |
|---|---|---|---|---|
| T-ORD-001 | Create a dine-in order on one client | `SIM` | `PARTIAL` | Automated order creation passes; restart probe used synthetic takeaway order |
| T-ORD-002 | Add item and modifier after initial order | `SIM` | `PARTIAL` | Automated addon/order-item paths pass |
| T-ORD-003 | Two clients update the same table in sequence | `SIM` + logs | `NOT_STARTED` | No two-client run |
| T-ORD-004 | Restart application after accepting order | `SIM` | `PARTIAL` | Synthetic pending order survived process restart; graceful shutdown not evidenced |
| T-ORD-005 | Abrupt process termination after accepted order | `SIM` | `PARTIAL` | Controlled process termination preserved the synthetic order; full Electron not used |
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
| T-BKP-004 | Database migration creates pre-migration backup | `CODE` + `SIM` | `PARTIAL` | Happy path passes; simulated failure logs and continues |
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
