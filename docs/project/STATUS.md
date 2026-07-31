# Development status

**Snapshot date:** 2026-07-31

**Overall phase:** Phase 0 — baseline audit

**Overall status:** `IN_PROGRESS`

## Executive summary

The pre-existing audit commit `c9110f4` has been preserved and reconciled with
the project-tracking documents introduced by PR #13. The runtime evidence was
rechecked on Windows at merge commit
`d366538fe1a5d798d5f6c6249b365e306e38efbc` with Node `v22.20.0` and npm
`10.9.3`.

After the owner repaired Visual Studio Build Tools and the Windows SDK, the
native rebuild, TypeScript build, frontend static export and database
upgrade-path test pass. The literal root `npm ci` still fails because its
postinstall verifier invokes Bash outside the normal `PATH`; with a temporary
Git Bash path the install passes. The root suite then stops at two reproducible
`test:reports-insights` failures tracked in issue #20. A synthetic order survived a controlled process termination and restart
through the recommended standalone development server, but a graceful Electron
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
| Upstream remote configured locally | `PARTIAL` | `upstream` is `FreeOpenSourcePOS/FloCafe`; evidence is in unmerged PR #14 |
| Development environment recorded | `PARTIAL` | Windows, Node `v22.20.0`, npm `10.9.3`, Electron `43.2.0`; evidence is in unmerged PR #14 |
| Clean dependency installation | `BLOCKED` | Native rebuild passes after SDK repair, but literal `npm.cmd ci` exits 1 because `postinstall` cannot find Bash; temporary `PATH` workaround passes |
| Baseline test suite | `PARTIAL` | With Git Bash temporary, the chain stops at `test:reports-insights` (29/31, exit 1); tracked in issue #20 |
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
| Architecture and production risks | `PARTIAL` | Reconciled under `docs/audit/` and this tracking set; PR #14 is not merged |
| PR #14 governance evidence | `PARTIAL` | Draft, open and unmerged; CI is red only because unsupported `dependency-review` fails (issue #19) |
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

- [ ] Local repository remotes and branches recorded; evidence collected in PR
      #14, pending review and merge.
- [ ] Node and npm versions recorded; evidence collected in PR #14, pending
      review and merge.
- [ ] Clean dependency installation completed.
- [ ] Existing tests completed and failures documented; historical evidence is
      in PR #14, pending review and merge.
- [ ] Main build completed; historical evidence is in PR #14, pending review
      and merge.
- [ ] Frontend build completed; historical evidence is in PR #14, pending
      review and merge.
- [ ] Application launched on Windows; historical evidence is in PR #14,
      pending review and merge.
- [ ] Database, logs and backup paths recorded in PR #14, pending review and
      merge.
- [ ] One disposable order survives an application process restart; historical
      evidence is in PR #14, pending review and merge.
- [ ] Baseline architecture and production risks documented in PR #14, pending
      review and merge.

M0 remains `IN_PROGRESS`: a fresh root installation is blocked, the final
evidence PR is not merged, and clean/abrupt restart behaviour still needs a
complete controlled matrix.

## Immediate next actions

1. Make the postinstall verifier and test runner cross-platform, or formally
   retain Git Bash as a prerequisite, under
   [#18](https://github.com/joputajones/tpv-abierto/issues/18).
2. Resolve the reporting regression in
   [#20](https://github.com/joputajones/tpv-abierto/issues/20), then reproduce
   the complete suite from the clean installation.
3. Resolve the fail-closed decision in
   [#16](https://github.com/joputajones/tpv-abierto/issues/16), then protect
   premigration backups without editing released migrations.
4. Define and enforce the cloud data contract and feature flags before any
   real store is registered.
5. Run the M1 bench gate with representative printer hardware, two local
   clients, KDS and Internet/LAN failure scenarios.
6. Restore a meaningful dependency-review CI signal through
   [#19](https://github.com/joputajones/tpv-abierto/issues/19), outside PR #14.

## Blockers

- Build Tools/MSVC/SDK are now complete, but the documented literal `npm ci`
  remains blocked by the Bash-dependent postinstall path (issue #18).
- `test:reports-insights` fails two assertions and prevents the root suite from
  reaching its remaining scripts (issue #20).
- CI remains red because `dependency-review` is unsupported with the current
  repository configuration; tracked separately in issue #19.
- Representative printer/cash-drawer hardware, a multi-device LAN bench and a
  router-failure setup are unavailable.
- Complete, reviewed and sanitised VirtuaPOS fixtures are unavailable.
- Fiscal suitability requires external Spanish specialist review and remains
  outside M0.

## Confidential material rule

Restaurant files, credentials, PINs, network addresses, ticket history and
personal data must not be committed to this public repository. Store test
fixtures only after sanitisation and explicit review.
