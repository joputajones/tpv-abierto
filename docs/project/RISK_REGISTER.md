# Risk register

Scores use a simple 1–5 scale for probability and impact. Priority is
probability × impact. Review this document at every milestone exit.

This register was reconciled on 2026-07-31 against commit
`d366538fe1a5d798d5f6c6249b365e306e38efbc` on Windows with Node `v22.20.0`
and npm `10.9.3`. Technical evidence is in
[production risks](../audit/production-risks.md) and
[test results](../audit/test-results.md).

| ID | Risk | Probability | Impact | Priority | Current mitigation / evidence | Owner / target | Mitigation status |
|---|---|---:|---:|---:|---|---|---|
| R-001 | FloCafe baseline is less mature than its interface and README suggest | 4 | 5 | 20 | Windows portability, fail-closed premigration safety, restart recovery, automated cross-runner restore, graphical recovery checks and `SIM/CI` offline operation are integrated; all 71 scripts and the post-merge four-platform matrix pass at `28a3f8d`. M0 remains `IN_PROGRESS` pending a separate human exit decision and without restaurant-readiness evidence | [joputajones / #15](https://github.com/joputajones/tpv-abierto/issues/15) / [#30](https://github.com/joputajones/tpv-abierto/issues/30) / M0 | `IN_PROGRESS` |
| R-002 | Existing mobile/secondary-device flow is unsuitable for waiters | 4 | 4 | 16 | Validate on ordinary phones during M1; do not infer usability from responsive routes | Product owner / M1 | `UNVERIFIED` |
| R-003 | Print jobs can be lost or duplicated during failures | 4 | 5 | 20 | Code has print history but no evidenced persistent job queue or atomic physical-print/audit transaction | Technical owner / M1 | `NOT_STARTED` |
| R-004 | Electron resource use is too high for intended low-end hardware | 3 | 4 | 12 | Benchmark representative target hardware before publishing requirements | Technical owner / M1 | `UNVERIFIED` |
| R-005 | Updates or migrations damage an existing restaurant database | 3 | 5 | 15 | `DONE` 2026-07-31 for premigration safety: PR #28 merged at `6d6f1d3`; existing files require a verified fail-closed copy before pending migrations, source invariants and isolated synthetic retry pass, and historical migrations remain immutable. External/disaster recovery remains R-011 | [joputajones / #16](https://github.com/joputajones/tpv-abierto/issues/16) / M0 | `DONE` |
| R-006 | Public repository accidentally receives customer data or credentials | 3 | 5 | 15 | Public-data policy and synthetic audit data used; secret scanning/fixture approval still need an owned gate | [joputajones / #17](https://github.com/joputajones/tpv-abierto/issues/17) / M0 | `PARTIAL` |
| R-007 | FloCafe upstream changes conflict with the fork | 4 | 3 | 12 | `upstream` remote is configured and baseline commit recorded; sync policy still needs an operational issue | Technical owner / M1 | `PARTIAL` |
| R-008 | Rebranding or packaging violates licences or trademarks | 2 | 5 | 10 | MIT attribution preserved; no rebranding; third-party notices and packaged-binary review remain | Project owner / release | `PARTIAL` |
| R-009 | Product is presented as Spanish fiscal-compliant before validation | 3 | 5 | 15 | Fiscal scope remains `OUT_OF_SCOPE` and documents prohibit a compliance claim | Product owner / M5 | `IN_PROGRESS` |
| R-010 | VirtuaPOS data model cannot be fully reconstructed from available files | 3 | 4 | 12 | Acquire full source data outside Git; create only reviewed sanitised fixtures | Project owner / M3 | `BLOCKED` |
| R-011 | Restaurant network or hardware failures are blamed on the software | 5 | 4 | 20 | PR #46 makes the accessible graphical checker `DONE` at `CODE/SIM/BUILD/CI`, including isolated restore, A-01…A-16 and four-platform packaging. A real non-technical run, representative hardware, hostile LAN, physical Internet/power loss and long-duration service remain unverified | [#34](https://github.com/joputajones/tpv-abierto/issues/34) / [#39](https://github.com/joputajones/tpv-abierto/issues/39) / [#40](https://github.com/joputajones/tpv-abierto/issues/40) / M1 | `PARTIAL` |
| R-012 | No recurring fee leaves human support economically unsustainable | 4 | 4 | 16 | Define installation/support boundaries and validate self-service diagnostics | Business owner / M2 | `NOT_STARTED` |
| R-013 | AI support gives unsafe or invented repair instructions | 3 | 5 | 15 | Keep AI optional and restrict actions to audited deterministic procedures | Product owner / M2 | `NOT_STARTED` |
| R-014 | Internet fallback design becomes more complex than the core product | 3 | 3 | 9 | Prioritise independent LAN; treat cellular/emergency AP as optional tested layers | Product owner / M2 | `NOT_STARTED` |
| R-015 | Scope expands into a full Restaurant OS before the pilot works | 5 | 4 | 20 | Milestone gates and explicit out-of-scope list exist | Product owner / all | `IN_PROGRESS` |
| R-016 | Documentation drifts away from actual implementation | 4 | 3 | 12 | Project tracking is canonical; audit found and corrected Electron/dev-port drift | Technical owner / M0 | `PARTIAL` |
| R-017 | Contributor guidance contains stale versions or commands | 2 | 3 | 6 | `AGENTS.md` now matches Electron 43; contributor dev-port text is corrected in this audit | Technical owner / M0 | `PARTIAL` |
| R-018 | Optional cloud sync can expose more order/customer/payment data than its feature flags and documentation imply | 4 | 5 | 20 | `PARTIAL`: cloud remains off by default and the offline matrix proves external failure does not block local operation. Fresh-install telemetry now defaults to no consent, but order/report cloud flags still do not gate every executable path and no real cloud account was tested | Security owner / before cloud use / [#40](https://github.com/joputajones/tpv-abierto/issues/40) | `PARTIAL` |
| R-019 | LAN API/KDS traffic is plaintext and Electron sandboxing is reduced | 4 | 5 | 20 | JWT, roles, CSP, context isolation and URL allowlist exist; no TLS and both servers bind all interfaces | Security owner / M1 | `PARTIAL` |
| R-020 | First-run telemetry may start before affirmative consent | 3 | 4 | 12 | `PARTIAL`: PR #41 changed fresh-install consent/telemetry defaults to `false`; O-01/O-10 prove zero attempts before or without consent and O-11 covers the consented failure path on integrated `main` and CI. An unambiguous frontend opt-in and broader privacy review remain pending | Privacy owner / M1 / [#40](https://github.com/joputajones/tpv-abierto/issues/40) | `PARTIAL` |
| R-021 | Main-server port fallback can advertise/open a different port than the active listener | 3 | 4 | 12 | KDS reports its active port; main window/mDNS still use configured `PORT` | Technical owner / M1 | `NOT_STARTED` |
| R-022 | Windows installation and recovery are not reproducible | 4 | 5 | 20 | `DONE` 2026-07-31 for development portability: PR #21 merged at `a51fa54`; current `main` passes clean install, native rebuild, Electron verification, builds, upgrade fixture and all 71 tests without Bash. Physical hardware and disaster recovery remain covered by R-011, not this closure | [joputajones / #18](https://github.com/joputajones/tpv-abierto/issues/18) / M0 | `DONE` |
| R-023 | A fork build can update from upstream or ship unsigned on Windows | 4 | 4 | 16 | Updates prompt before download, but direct builds point to `FreeOpenSourcePOS/FloCafe`; Windows signing/package path not tested | Release owner / before distribution | `UNVERIFIED` |
| R-024 | Dependency advisories or copyleft/notice obligations are missed in distributed binaries | 3 | 4 | 12 | npm audits and lockfile licence inventory recorded; no SBOM or `THIRD_PARTY_NOTICES` | Release owner / before distribution | `PARTIAL` |
| R-025 | CI reports a permanent dependency-review failure instead of a meaningful dependency signal | 4 | 3 | 12 | `DONE` 2026-07-31: Dependency Graph enabled; the SHA-pinned v4.5.0 action passed a docs PR and evaluated a controlled lockfile change; PR #24 merged and #19 closed. No ruleset enforces the check, so a red result remains a manual blocker | [joputajones / #19](https://github.com/joputajones/tpv-abierto/issues/19) / M0 | `DONE` |

## Escalation rule

Any risk with priority 15 or greater must have:

- a named mitigation issue;
- an owner;
- a target milestone;
- evidence before the affected milestone can exit.

Named issues now govern R-005, R-006, R-011 and R-022. The M0 exit review is tracked
in issue #15; R-025 was technically mitigated through PR #24 and closed issue
#19, while merge enforcement remains manual. Other priority-15+
risks still require a named and assigned issue before their affected milestone
can exit.

## Closed-risk rule

Do not delete closed risks. Mark their mitigation status `DONE`, record the
date and link the evidence that reduced or eliminated them.
