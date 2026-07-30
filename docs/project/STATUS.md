# Development status

**Snapshot date:** 2026-07-30

**Overall phase:** Phase 0 — baseline audit

**Overall status:** `IN_PROGRESS`

## Executive summary

The pre-existing audit commit `c9110f4` has been preserved and reconciled with
the project-tracking documents introduced by PR #13. The runtime evidence was
rechecked on Windows at merge commit
`d366538fe1a5d798d5f6c6249b365e306e38efbc` with Node `v22.20.0` and npm
`10.9.3`.

The TypeScript build, frontend static export, database upgrade-path test and
complete automated suite pass in the audited checkout. The suite only starts
after Git Bash is added to `PATH`, and a clean root `npm ci` remains blocked
because the installed Visual Studio Build Tools have no Windows SDK. A
synthetic order survived a controlled process termination and restart through
the recommended standalone development server, but a graceful Electron
shutdown and abrupt-power-loss cycle have not both been demonstrated.

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
| Upstream remote configured locally | `DONE` | `upstream` is `FreeOpenSourcePOS/FloCafe`; verified with `git remote -v` |
| Development environment recorded | `DONE` | Windows, Node `v22.20.0`, npm `10.9.3`, Electron `43.2.0` |
| Clean dependency installation | `BLOCKED` | `npm.cmd ci` exits 1: VS Build Tools 2019/v142 found, Windows SDK missing |
| Baseline test suite | `PARTIAL` | Literal `npm.cmd test` cannot find `bash`; the full chain passes after adding Git Bash to process `PATH` |
| Upgrade-path test | `PARTIAL` | v0→v38 happy path, backup, integrity, preservation, parity and idempotency pass; backup-failure path is not fail-closed |
| Main TypeScript build | `PARTIAL` | `npm.cmd run build` passes; evidence is in the unmerged audit PR |
| Frontend build | `PARTIAL` | Next 16.2.12 exports 22 routes; npm reports 9 high tooling vulnerabilities |
| Windows application launch | `PARTIAL` | Electron launch was observed in the initial audit; standalone backend restart was repeated, but no packaged Windows build was tested |
| SQLite persistence | `PARTIAL` | One synthetic pending order survived process termination and restart; graceful plus abrupt restart matrix remains incomplete |
| KDS local-network flow | `PARTIAL` | REST/WebSocket automation and local KDS page pass; no second physical device was used |
| Secondary cashier/mobile flow | `UNVERIFIED` | No ordinary phone or concurrent client bench test |
| Physical printer integration | `BLOCKED` | Code/byte-path tests pass, but representative printer, spooler, paper and drawer hardware are unavailable |
| Backup and restore validation | `PARTIAL` | Automated disposable backup/restore and migration backup paths pass; no off-device restore drill or second-person procedure |
| Internet-loss test | `NOT_STARTED` | Standalone local server needs no cloud service, but the full Electron process was not isolated from the Internet |
| Architecture and production risks | `DONE` | Reconciled under `docs/audit/` and this tracking set |
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

- [x] Local repository remotes and branches recorded.
- [x] Node and npm versions recorded.
- [ ] Clean dependency installation completed.
- [x] Existing tests completed and failures documented.
- [x] Main build completed.
- [x] Frontend build completed.
- [x] Application launched on Windows.
- [x] Database, logs and backup paths recorded.
- [x] One disposable order survives an application process restart.
- [x] Baseline architecture and production risks documented.

M0 remains `IN_PROGRESS`: a fresh root installation is blocked, the final
evidence PR is not merged, and clean/abrupt restart behaviour still needs a
complete controlled matrix.

## Immediate next actions

1. Make `npm ci` reproducible on a clean Windows machine and document the exact
   C++/Windows SDK prerequisites.
2. Make the test runner cross-platform or formally document Git Bash, then
   reproduce the complete suite from the clean installation.
3. Make premigration backup failure stop migrations and add a regression test
   without editing released migrations.
4. Define and enforce the cloud data contract and feature flags before any
   real store is registered.
5. Run the M1 bench gate with representative printer hardware, two local
   clients, KDS and Internet/LAN failure scenarios.

## Blockers

- The audited Windows environment has no usable Windows SDK for the native
  dependency rebuild.
- Representative printer/cash-drawer hardware, a multi-device LAN bench and a
  router-failure setup are unavailable.
- Complete, reviewed and sanitised VirtuaPOS fixtures are unavailable.
- Fiscal suitability requires external Spanish specialist review and remains
  outside M0.

## Confidential material rule

Restaurant files, credentials, PINs, network addresses, ticket history and
personal data must not be committed to this public repository. Store test
fixtures only after sanitisation and explicit review.
