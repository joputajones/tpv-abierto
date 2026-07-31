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
native rebuild, Electron verification, builds and all then-current 67 test
scripts passed in PowerShell without Bash. Issue #18 is closed and R-022 is `DONE` for that
development-portability scope.

The historical root suite stopped at two reproducible `test:reports-insights`
failures (29/31). PR #22 proved that a `Date.now()`-dependent fixture, not the
production endpoint, caused both values; the correction is merged and #20 is
closed. Dependency Graph is enabled, dependency review is operational, PR #24
is merged and #19 is closed. PR #31 now integrates a controlled graceful and
forced-process restart matrix for SQLite, API and KDS with synthetic data.

PR #28 reproduces the historical fail-open migration path and integrates a
verified fail-closed barrier for every pre-existing database file, including
`user_version = 0` and zero-byte files. Its 66-script Windows suite and all CI
jobs pass; #16 is closed and R-005 is `DONE` for premigration safety.

Issue [#30](https://github.com/joputajones/tpv-abierto/issues/30) is closed by
PR #31, merged as `0b629ab`. The integrated matrix exercises the real SQLite,
API and KDS lifecycle in child processes under disposable `userData`; R-01
through R-12 pass on Windows and Linux, its negative assertion fails cleanly,
and post-merge `main` repeats the complete suite. This is `SIM`
evidence, not physical power-loss or disaster-recovery evidence.

PR #35, merged as `4877d72`, adds the 68th script and closes technical issue
[#33](https://github.com/joputajones/tpv-abierto/issues/33). A Windows producer
created a synthetic four-file backup package through the production API; fresh
Windows and Linux jobs downloaded the artifact, verified SHA-256
`d2c4ee11c10544bcca43283266ab5e4d85dc0df467f91a21e296638845c1da95`
before SQLite access, restored through the production API, reopened, wrote new
orders/bills and reopened again. This is `DONE` at `CI_CROSS_RUNNER`, not a
physical or human drill. PR #36 (`5a8aa94`) also repaired a pre-existing macOS
no-Bash test defect without changing production behavior; the full four-target
Windows/Linux/macOS matrix then passed.

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
| Baseline test suite | `DONE` | Integrated `main` passes all 68 scripts without Bash; fail-fast propagation was proved with reverted synthetic failures and the full Windows/Linux/macOS matrix passed |
| Upgrade-path test | `DONE` | Integrated `main` blocks checkpoint/copy/open/integrity/version/finalization failures before v1 and passes v0→v38, preservation, parity, idempotency and isolated retry; PR #28 merged and #16 closed |
| Main TypeScript build | `DONE` | `npm.cmd run build` passes; baseline evidence is merged through PR #14 |
| Frontend build | `PARTIAL` | Next 16.2.12 exports 22 routes; current frontend install reports 0 vulnerabilities, while the historical 9-high result remains recorded; no packaged Windows build was tested |
| Windows application launch | `PARTIAL` | Electron launch was observed in the initial audit; standalone backend restart was repeated, but no packaged Windows build was tested |
| SQLite persistence | `DONE` | PR #31 passes graceful/forced-process commit persistence, open-transaction rollback, WAL recovery, repeated reopen and port reuse on Windows/Linux at `SIM`; physical power loss and off-device recovery remain separate gaps |
| KDS local-network flow | `PARTIAL` | REST/WebSocket automation and local KDS page pass; no second physical device was used |
| Secondary cashier/mobile flow | `UNVERIFIED` | No ordinary phone or concurrent client bench test |
| Physical printer integration | `BLOCKED` | Code/byte-path tests pass, but representative printer, spooler, paper and drawer hardware are unavailable |
| Backup and restore validation | `PARTIAL` | Automated portability is `DONE` at `CI_CROSS_RUNNER`: PR #35 closed [#33](https://github.com/joputajones/tpv-abierto/issues/33) after a Windows producer and independent Windows/Linux consumers passed checksum-first restore, continuity and B-01…B-07. Overall recovery remains `PARTIAL` because the physical blind second-person drill is still open as [#34](https://github.com/joputajones/tpv-abierto/issues/34) |
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
- [x] Existing tests completed; all 68 scripts pass without Bash in the full platform matrix.
- [x] Main build completed; evidence merged in PR #14.
- [x] Frontend build completed; evidence merged in PR #14.
- [x] Application launched on Windows; limited baseline evidence merged in PR #14.
- [x] Database, logs and backup paths recorded in PR #14.
- [x] One disposable order survives an application process restart; limited evidence merged in PR #14.
- [x] Controlled graceful/abrupt restart matrix reviewed and integrated in PR #31; #30 is closed.
- [x] Baseline architecture and production risks documented in PR #14.

M0 remains `IN_PROGRESS` by explicit maintainer decision. The enumerated
technical/documentary baseline criteria are now evidenced, but closing the
milestone requires a later human decision and does not imply restaurant
readiness. The restart matrix remains a process-level simulation and does not
validate physical power loss or real operation. Off-device restore is now
validated only at `CI_CROSS_RUNNER`; human and physical recovery remain absent.

### M0 reevaluation after PR #31

| Canonical criterion | Classification | Evidence / residual limit |
|---|---|---|
| Repository remotes and branches recorded | Fulfilled | PR #14 |
| Node and npm versions recorded | Fulfilled | Windows baseline and repeated post-merge evidence |
| Clean dependency installation without Bash | Fulfilled | PR #21 and post-PR #31 `npm.cmd ci` |
| Existing suite completed | Fulfilled | 68 scripts pass locally without Bash and in the full platform matrix |
| Main TypeScript build | Fulfilled | Local and CI build evidence |
| Frontend static build | Fulfilled | 22 routes; packaged Windows installer remains a separate gap |
| Application launched on Windows | Fulfilled | Development launch evidence; not packaged/hardware evidence |
| Database, log and backup paths recorded | Fulfilled | Architecture/audit documentation plus PR #35 cross-runner restore; not a physical or human drill |
| Disposable committed order survives restart | Fulfilled | R-02 plus repeated post-merge matrix |
| Controlled graceful/forced restart matrix | Fulfilled | PR #31, Windows and Linux R-01…R-12 at `SIM` |
| Architecture and production risks documented | Fulfilled | Audit and project tracking set |

No canonical criterion is currently classified as blocked or not applicable.
This does not authorize closing M0 automatically: governance remains pending,
and adjacent production-readiness evidence is still partial or blocked.

## Immediate next actions

1. Give an ephemeral off-device package and the versioned runbook to an
   independent operator, then complete the physical blind drill in #34.
2. Define and enforce the cloud data contract and feature flags before any
   real store is registered.
3. Run the M1 bench gate with representative printer hardware, two local
   clients, KDS and Internet/LAN failure scenarios.

## Blockers

- Dependency review is operational, but no branch protection or ruleset enforces
  it; a red check remains a manual governance blocker.
- Automated off-device restore is integrated at `CI_CROSS_RUNNER`, but the
  physical second-person drill remains pending in #34.
- Representative printer/cash-drawer hardware, a multi-device LAN bench and a
  router-failure setup are unavailable.
- Complete, reviewed and sanitised VirtuaPOS fixtures are unavailable.
- Fiscal suitability requires external Spanish specialist review and remains
  outside M0.

## Confidential material rule

Restaurant files, credentials, PINs, network addresses, ticket history and
personal data must not be committed to this public repository. Store test
fixtures only after sanitisation and explicit review.
