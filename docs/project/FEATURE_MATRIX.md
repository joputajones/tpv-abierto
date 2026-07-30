# Feature matrix

This matrix tracks product requirements, not marketing claims. A feature can be marked `DONE` only after its acceptance criteria have passed and evidence is linked.

| ID | Capability | Current status | Target milestone | Acceptance summary |
|---|---|---|---|---|
| CORE-001 | Reproducible Windows development setup | `NOT_STARTED` | M0 | Fresh clone installs, builds and launches using documented commands |
| CORE-002 | SQLite data persistence | `UNVERIFIED` | M0 | Confirmed order survives clean restart and abrupt app restart test |
| CORE-003 | Safe database migration path | `UNVERIFIED` | M0 | Existing-data fixture upgrades with backup and no destructive loss |
| CORE-004 | Local-only operation | `UNVERIFIED` | M1 | Core order flow works with internet disconnected |
| ORDER-001 | Products and categories | `UNVERIFIED` | M1 | Create, edit, search and order disposable catalogue items |
| ORDER-002 | Modifiers and addon groups | `UNVERIFIED` | M1 | Modifier choices persist and route correctly |
| ORDER-003 | Table management | `UNVERIFIED` | M1 | Open, update and close test tables without data loss |
| ORDER-004 | Multiple simultaneous local clients | `UNVERIFIED` | M1 | Two clients see consistent order state on the same LAN |
| MOBILE-001 | Waiter-friendly phone interface | `NOT_STARTED` | M2 | Ordinary phone completes table order flow without desktop controls |
| KITCHEN-001 | KDS real-time updates | `UNVERIFIED` | M1 | Accepted items appear once at the correct station |
| PRINT-001 | ESC/POS test printing | `UNVERIFIED` | M1 | Test receipt succeeds on simulator or supported printer |
| PRINT-002 | Kitchen/bar routing | `UNVERIFIED` | M1 | Items route to configured destinations |
| PRINT-003 | Persistent print queue | `UNVERIFIED` | M1 | Pending job survives restart and cannot silently disappear |
| PRINT-004 | Duplicate-print protection | `UNVERIFIED` | M1 | Retry behaviour is explicit and logged |
| BACKUP-001 | Local backup creation | `UNVERIFIED` | M1 | Backup created, listed and integrity-checked |
| BACKUP-002 | Restore procedure | `UNVERIFIED` | M1 | Disposable install restores to expected state |
| DIAG-001 | System health overview | `NOT_STARTED` | M2 | Reports server, database, disk, network, backup and printer state |
| DIAG-002 | Guided printer troubleshooting | `NOT_STARTED` | M2 | Detects common printer failures and proposes deterministic steps |
| DIAG-003 | Redacted diagnostic bundle | `NOT_STARTED` | M2 | Bundle excludes secrets and unnecessary customer data |
| NET-001 | Internet-loss continuity | `NOT_STARTED` | M1 | Local service continues while internet-only features pause |
| NET-002 | Stable local discovery/address | `NOT_STARTED` | M2 | Clients reconnect using documented local address or discovery method |
| NET-003 | Emergency network procedure | `NOT_STARTED` | M2 | Recovery path documented and tested on supported hardware |
| IMPORT-001 | VirtuaPOS JSON catalogue parser | `PARTIAL` | M3 | Sanitised fixture parses categories, products and prices deterministically |
| IMPORT-002 | VirtuaPOS MDB scanner | `BLOCKED` | M3 | Requires complete installation and sanitised fixtures |
| IMPORT-003 | Idempotent VirtuaPOS import | `NOT_STARTED` | M3 | Re-import does not create uncontrolled duplicates |
| DOCS-001 | Public operator training | `NOT_STARTED` | M2 | Critical workflows have concise versioned instructions |
| DOCS-002 | Offline/local help | `NOT_STARTED` | M2 | Critical help remains available without internet |
| SUPPORT-001 | Deterministic local support engine | `NOT_STARTED` | M2 | Support actions call allow-listed procedures and are audited |
| SUPPORT-002 | Optional natural-language interface | `OUT_OF_SCOPE` | Future | Must not be required for diagnosis or core operation |
| FISCAL-001 | Spanish fiscal architecture | `OUT_OF_SCOPE` | M5 | Requires specialist review and formal acceptance criteria |
| FISCAL-002 | VeriFactu capability | `OUT_OF_SCOPE` | M5 | No compliance claim before external validation |
| BRAND-001 | Product rebranding | `OUT_OF_SCOPE` | After M0 | Preserve required attribution and third-party notices |

## Maintenance rule

When an issue or pull request changes a capability:

1. update its status here;
2. link evidence in the issue or PR;
3. update `TEST_MATRIX.md` when validation changes;
4. update `STATUS.md` when the milestone picture changes.
