# Feature matrix

This matrix tracks product requirements, not marketing claims. A feature can
be marked `DONE` only after its acceptance criteria have passed, documentation
and evidence are linked, and the corresponding PR has been reviewed and
merged.

M0 evidence was collected on 2026-07-30 at
`d366538fe1a5d798d5f6c6249b365e306e38efbc` on Windows with Node `v22.20.0`
and npm `10.9.3`. See [test results](../audit/test-results.md).

| ID | Capability | Current status | Target milestone | Acceptance summary | M0 evidence / gap |
|---|---|---|---|---|---|
| CORE-001 | Reproducible Windows development setup | `DONE` | M0 | Fresh clone installs, builds and launches using documented commands | Integrated `main` passes clean install, native rebuild, Electron verification, builds and all 67 test scripts in PowerShell without Bash. Packaged release, off-device recovery and physical operation are separate gaps |
| CORE-002 | SQLite data persistence | `DONE` | M0 | Confirmed order survives clean restart and abrupt app restart test | PR #31 merged at `0b629ab`; R-01…R-12 pass on Windows/Linux with committed rows preserved, open transactions reverted, WAL recovered, five alternating cycles and reusable API/KDS ports. Evidence is `SIM`, not physical power loss or disaster recovery |
| CORE-003 | Safe database migration path | `DONE` | M0 | Existing-data fixture upgrades with backup and no destructive loss | PR #28 merged at `6d6f1d3`; integrated `main` requires a verified fail-closed backup before v0→v38, preserves source invariants, supports isolated synthetic retry and leaves released migrations unchanged. This does not prove off-device or real-restaurant recovery |
| CORE-004 | Local-only operation | `UNVERIFIED` | M1 | Core order flow works with internet disconnected | Standalone server is local, but no full Electron Internet-isolation test was run |
| ORDER-001 | Products and categories | `PARTIAL` | M1 | Create, edit, search and order disposable catalogue items | Automated product/category/order paths pass; full acceptance workflow was not manually executed |
| ORDER-002 | Modifiers and addon groups | `PARTIAL` | M1 | Modifier choices persist and route correctly | Addon and kitchen parsing tests pass; no physical routing evidence |
| ORDER-003 | Table management | `PARTIAL` | M1 | Open, update and close test tables without data loss | Automated string-ID and table-move paths pass; full multi-client workflow is unverified |
| ORDER-004 | Multiple simultaneous local clients | `UNVERIFIED` | M1 | Two clients see consistent order state on the same LAN | No two-client LAN simulation or bench test |
| MOBILE-001 | Waiter-friendly phone interface | `UNVERIFIED` | M2 | Ordinary phone completes table order flow without desktop controls | Web routes exist; no ordinary phone evidence |
| KITCHEN-001 | KDS real-time updates | `PARTIAL` | M1 | Accepted items appear once at the correct station | REST/WebSocket and station-routing automation pass; no secondary display bench |
| PRINT-001 | ESC/POS test printing | `PARTIAL` | M1 | Test receipt succeeds on simulator or supported printer | Encoding/profile/API simulation passes; no supported physical printer or spooler validation |
| PRINT-002 | Kitchen/bar routing | `PARTIAL` | M1 | Items route to configured destinations | Automated station routing passes; no physical destination test |
| PRINT-003 | Persistent print queue | `NOT_STARTED` | M1 | Pending job survives restart and cannot silently disappear | `print_logs` is an audit history, not a persistent queued-job state machine |
| PRINT-004 | Duplicate-print protection | `PARTIAL` | M1 | Retry behaviour is explicit and logged | Reprint logging exists; physical print and audit calls are separate and no idempotent job ID was evidenced |
| BACKUP-001 | Local and portable backup creation | `PARTIAL` | M1 | Production backup is integrity-checked, checksummed and exported off-device | #33 review branch produces an exact synthetic four-file package through `createBackup()` and rejects unexpected content; Windows producer plus artifact transfer still require CI review/merge |
| BACKUP-002 | Restore procedure | `PARTIAL` | M1 | Clean install restores to expected state and a second operator can repeat it | Local independent-process restore, reopen, write-after-restore and B-01…B-07 pass on the review branch; cross-runner CI is pending and the physical second-person drill remains #34 |
| DIAG-001 | System health overview | `NOT_STARTED` | M2 | Reports server, database, disk, network, backup and printer state | Basic API health exists but does not meet the acceptance summary |
| DIAG-002 | Guided printer troubleshooting | `NOT_STARTED` | M2 | Detects common printer failures and proposes deterministic steps | No evidence |
| DIAG-003 | Redacted diagnostic bundle | `NOT_STARTED` | M2 | Bundle excludes secrets and unnecessary customer data | No evidence |
| NET-001 | Internet-loss continuity | `NOT_STARTED` | M1 | Local service continues while internet-only features pause | No controlled Internet-loss run |
| NET-002 | Stable local discovery/address | `UNVERIFIED` | M2 | Clients reconnect using documented local address or discovery method | mDNS and port code observed; no multi-device reconnection test |
| NET-003 | Emergency network procedure | `NOT_STARTED` | M2 | Recovery path documented and tested on supported hardware | Hardware/environment unavailable |
| IMPORT-001 | VirtuaPOS JSON catalogue parser | `PARTIAL` | M3 | Sanitised fixture parses categories, products and prices deterministically | Initial analysis is external; no reviewed fixture or repository test evidence |
| IMPORT-002 | VirtuaPOS MDB scanner | `BLOCKED` | M3 | Requires complete installation and sanitised fixtures | Source data unavailable; raw restaurant data must not enter this repository |
| IMPORT-003 | Idempotent VirtuaPOS import | `NOT_STARTED` | M3 | Re-import does not create uncontrolled duplicates | No importer or test fixture |
| DOCS-001 | Public operator training | `NOT_STARTED` | M2 | Critical workflows have concise versioned instructions | No evidence |
| DOCS-002 | Offline/local help | `NOT_STARTED` | M2 | Critical help remains available without internet | No evidence |
| SUPPORT-001 | Deterministic local support engine | `NOT_STARTED` | M2 | Support actions call allow-listed procedures and are audited | No evidence |
| SUPPORT-002 | Optional natural-language interface | `OUT_OF_SCOPE` | Future | Must not be required for diagnosis or core operation | Unchanged |
| FISCAL-001 | Spanish fiscal architecture | `OUT_OF_SCOPE` | M5 | Requires specialist review and formal acceptance criteria | No compliance claim |
| FISCAL-002 | VeriFactu capability | `OUT_OF_SCOPE` | M5 | No compliance claim before external validation | No compliance claim |
| BRAND-001 | Product rebranding | `OUT_OF_SCOPE` | After M0 | Preserve required attribution and third-party notices | MIT attribution and FloCafe identity are unchanged |

## Maintenance rule

When an issue or pull request changes a capability:

1. update its status here;
2. link evidence in the issue or PR;
3. update `TEST_MATRIX.md` when validation changes;
4. update `STATUS.md` when the milestone picture changes.
