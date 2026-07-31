# Development status

**Snapshot date:** 2026-07-31
**Overall phase:** Phase 0 — baseline audit

**Overall status:** `IN_PROGRESS`

## Executive summary

The pre-existing audit commit `c9110f4` has been preserved and reconciled with
the project-tracking documents introduced by PR #13. The runtime evidence was
rechecked on Windows at merge commit
`d366538fe1a5d798d5f6c6249b365e306e38efbc` with Node `v22.20.0` and npm
`10.9.3`. PR #24 restored dependency review, PR #14 merged the reconciled M0
baseline and PR #22 merged the deterministic reports fixture. Issues #15, #19
and #20 are closed.

After the owner repaired Visual Studio Build Tools and the Windows SDK, the
native rebuild, TypeScript build, frontend static export and database
upgrade-path test pass. PR #21 merged at `a51fa54` and replaced the mandatory
Bash verifier/test paths with cross-platform Node scripts. GitHub CI passed and
the acceptance path was repeated from the integrated `main`: clean install,
native rebuild, Electron verification, builds and all 66 test scripts pass in
PowerShell without Bash. Issue #18 is closed and R-022 is `DONE` for that
development-portability scope.

The historical root suite stopped at two reproducible `test:reports-insights`
failures (29/31). PR #22 proved that a `Date.now()`-dependent fixture, not the
production endpoint, caused both values; the correction is merged and #20 is
closed. Dependency Graph is enabled, dependency review is operational, PR #24
is merged and #19 is closed. A synthetic order survived a controlled process termination
and restart through the recommended standalone development server, but a
graceful Electron shutdown and abrupt-power-loss cycle have not both been
demonstrated.

PR #28 reproduces the historical fail-open migration path and integrates a
verified fail-closed barrier for every pre-existing database file, including
`user_version = 0` and zero-byte files. Its 66-script Windows suite and all CI
jobs pass; #16 is closed and R-005 is `DONE` for premigration safety.

Issue [#30](https://github.com/joputajones/tpv-abierto/issues/30) tracks the
controlled graceful/abrupt restart matrix. The PR branch exercises the real
SQLite, API and KDS lifecycle in child processes under disposable `userData`,
passes R-01 through R-12 locally on Windows and proves its negative assertion
fails cleanly. This evidence remains `PARTIAL` until review, Linux CI and merge.

These results improve confidence in the code baseline; they do not establish
production readiness, Spanish fiscal compliance or suitability for a real
restaurant.

Detailed evidence: [audit baseline](../audit/baseline.md),
[test results](../audit/test-results.md),
[architecture map](../audit/architecture-map.md) and
[production risks](../audit/production-risks.md).

## Current facts

| Area | Status | Evidence / note |
|---|---|---|
| Public GitHub repository exists | `DONE` | `joputajones/tpv-abierto`; PR #13 is merged into `main` |
| FloCafe source imported | `DONE` | Repository contains upstream code and history |
| Upstream remote configured locally | `DONE` | `upstream` is `FreeOpenSourcePOS/FloCafe`; evidence merged through PR #14 |
| Development environment recorded | `DONE` | Windows, Node `v22.20.0`, npm `10.9.3`, Electron `43.2.0`; evidence merged through PR #14 |
| Clean dependency installation | `DONE` | Integrated `main` runs `npm.cmd ci`, native rebuild and Electron verification without Bash; PR #21 merged and #18 closed |
| Baseline test suite | `DONE` | Integrated `main` passes all 66 scripts without Bash; fail-fast propagation was proved with a reverted synthetic failure and Linux CI passed |
| Upgrade-path test | `DONE` | Integrated `main` blocks checkpoint/copy/open/integrity/version/finalization failures before v1 and passes v0→v38, preservation, parity, idempotency and isolated retry; PR #28 merged and #16 closed |
| Main TypeScript build | `DONE` | `npm.cmd run build` passes; baseline evidence is merged through PR #14 |
| Frontend build | `PARTIAL` | Next 16.2.12 exports 22 routes; current frontend install reports 0 vulnerabilities, while the historical 9-high result remains recorded; no packaged Windows build was tested |
| Windows application launch | `PARTIAL` | Electron launch was observed in the initial audit; standalone backend restart was repeated, but no packaged Windows build was tested |
| SQLite persistence | `PARTIAL` | #30 branch passes graceful/abrupt commit persistence, open-transaction rollback, WAL recovery, repeated reopen and port reuse with synthetic child processes; pending review, Linux CI and merge |
| KDS local-network flow | `PARTIAL` | REST/WebSocket automation and local KDS page pass; no second physical device was used |
| Secondary cashier/mobile flow | `UNVERIFIED` | No ordinary phone or concurrent client bench test |
| Physical printer integration | `BLOCKED` | Code/byte-path tests pass, but representative printer, spooler, paper and drawer hardware are unavailable |
| Backup and restore validation | `PARTIAL` | Integrated `main` creates and reopens a verified local premigration copy and retries the synthetic upgrade independently; no off-device restore drill or second-person procedure |
| Internet-loss test | `NOT_STARTED` | Standalone local server needs no cloud service, but the full Electron process was not isolated from the Internet |
| Architecture and production risks | `DONE` | Reconciled under `docs/audit/` and this tracking set; PR #14 is merged |
| Dependency review governance | `DONE` | Dependency Graph enabled; pinned action executes with read-only permissions and a high-severity threshold; PR #24 merged and #19 closed. Enforcement remains manual because `main` has no branch protection/ruleset |
| PR #14 governance evidence | `DONE` | PR #14 merged at `90756e7`; #15 closed with the explicit decision to keep M0 `IN_PROGRESS` |
| VirtuaPOS catalogue analysis | `PARTIAL` | Initial analysis exists outside the public repository; no reviewed sanitised fixture is committed |
| Full `C:\BLATTA` acquisition | `BLOCKED` | Requires another restaurant visit; raw contents must remain outside the public repository |
| VirtuaPOS importer | `NOT_STARTED` | Cannot be considered implemented |
| Diagnostic assistant | `NOT_STARTED` | Product concept only |
| Public training site | `NOT_STARTED` | Product concept only |
| Spanish fiscal adaptation | `OUT_OF_SCOPE` | Deferred until after the non-fiscal pilot and specialist review |
| Rebranding | `OUT_OF_SCOPE` | No product identity or attribution was changed |

## Active milestone

### M0 — Reproducible baseline

**Goal:** prove that the unmodified FloCafe baseline can be installed, tested,
built, launched and understood before product changes begin.

Exit criteria:

- [x] Local repository remotes and branches recorded; evidence merged in PR #14.
- [x] Node and npm versions recorded; evidence merged in PR #14.
- [x] Clean dependency installation completed without Bash on integrated `main`.
- [x] Existing tests completed; all 66 scripts pass on Windows and Linux.
- [x] Main build completed; evidence merged in PR #14.
- [x] Frontend build completed; evidence merged in PR #14.
- [x] Application launched on Windows; limited baseline evidence merged in PR #14.
- [x] Database, logs and backup paths recorded in PR #14.
- [x] One disposable order survives an application process restart; limited evidence merged in PR #14.
- [ ] Controlled graceful/abrupt restart matrix reviewed and integrated; #30 branch evidence is local and pending merge.
- [x] Baseline architecture and production risks documented in PR #14.

M0 remains `IN_PROGRESS`: Windows development portability and the fail-closed
premigration barrier are complete. The controlled restart matrix passes locally
on the #30 branch but is not yet integrated or validated by Linux CI. Even after
merge, this simulation will not validate physical restaurant operation.

## Immediate next actions

1. Review and integrate the controlled graceful/abrupt restart matrix tracked
   in #30, then reevaluate M0 without closing it automatically.
2. Define and enforce the cloud data contract and feature flags before any
   real store is registered.
3. Run the M1 bench gate with representative printer hardware, two local
   clients, KDS and Internet/LAN failure scenarios.

## Blockers

- Dependency review is operational, but no branch protection or ruleset enforces
  it; a red check remains a manual governance blocker.
- Representative printer/cash-drawer hardware, a multi-device LAN bench and a
  router-failure setup are unavailable.
- Complete, reviewed and sanitised VirtuaPOS fixtures are unavailable.
- Fiscal suitability requires external Spanish specialist review and remains
  outside M0.

## Confidential material rule

Restaurant files, credentials, PINs, network addresses, ticket history and
personal data must not be committed to this public repository. Store test
fixtures only after sanitisation and explicit review.
