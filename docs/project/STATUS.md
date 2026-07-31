# Development status

**Snapshot date:** 2026-07-31

**Overall phase:** Phase 0 — baseline audit

**Overall status:** `IN_PROGRESS`

## Executive summary

The pre-existing audit commit `c9110f4` has been preserved and reconciled with
the project-tracking documents introduced by PR #13. The runtime evidence was
rechecked on Windows at merge commit
`d366538fe1a5d798d5f6c6249b365e306e38efbc` with Node `v22.20.0` and npm
`10.9.3`. The documentation was reconciled again after PR #24 entered `main` at
merge commit `38abca3f0d149c6d245adc0a19705c828b1d70aa`.

After the owner repaired Visual Studio Build Tools and the Windows SDK, the
native rebuild, TypeScript build, frontend static export and database
upgrade-path test pass. The current `main` still requires Bash for the root
postinstall verifier and test aggregator. PR #21 replaces those mandatory paths
with cross-platform Node scripts and has Windows/Linux evidence, but remains
unmerged, so issue #18 and R-022 are `PARTIAL`, not `DONE`.

The historical root suite stopped at two reproducible `test:reports-insights`
failures (29/31). PR #22 demonstrates that a `Date.now()`-dependent fixture,
not the production endpoint, caused both values and makes the test deterministic;
it also remains unmerged, so issue #20 is still open and `PARTIAL`. Dependency
Graph is now enabled, dependency review is operational, PR #24 is merged and
issue #19 is closed. A synthetic order survived a controlled process termination
and restart through the recommended standalone development server, but a
graceful Electron shutdown and abrupt-power-loss cycle have not both been
demonstrated.

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
| Clean dependency installation | `PARTIAL` | Native rebuild passes after SDK repair; current `main` still needs Bash, while PR #21 demonstrates a cross-platform replacement and remains pending review/merge (#18) |
| Baseline test suite | `PARTIAL` | Historical `main` evidence stops at `test:reports-insights` (29/31); PR #22 fixes the deterministic test fixture and is green on Windows/Linux but is not merged (#20) |
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
| Dependency review governance | `DONE` | Dependency Graph enabled; pinned action executes with read-only permissions and a high-severity threshold; PR #24 merged and #19 closed. Enforcement remains manual because `main` has no branch protection/ruleset |
| PR #14 governance evidence | `PARTIAL` | Open and unmerged; this documentation establishes the review baseline but does not close M0 |
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

M0 remains `IN_PROGRESS`: the cross-platform install/test runner and deterministic
reports fixture exist only in unmerged PRs #21 and #22, the final evidence PR is
not merged, issue #16 remains open, and clean/abrupt restart behaviour still
needs a complete controlled matrix.

## Immediate next actions

1. Review and integrate the cross-platform runner in
   [PR #21](https://github.com/joputajones/tpv-abierto/pull/21), then close
   [#18](https://github.com/joputajones/tpv-abierto/issues/18) through its merge.
2. Review and integrate the deterministic reports fixture in
   [PR #22](https://github.com/joputajones/tpv-abierto/pull/22), then close
   [#20](https://github.com/joputajones/tpv-abierto/issues/20) and reproduce the
   complete suite from the updated clean installation.
3. Resolve the fail-closed decision in
   [#16](https://github.com/joputajones/tpv-abierto/issues/16), then protect
   existing databases before migration without editing released migrations. A
   new empty database may be considered only through an explicit, deterministic
   condition, never file size or a probabilistic heuristic.
4. Define and enforce the cloud data contract and feature flags before any
   real store is registered.
5. Run the M1 bench gate with representative printer hardware, two local
   clients, KDS and Internet/LAN failure scenarios.

## Blockers

- Build Tools/MSVC/SDK are complete. Current `main` still has the Bash-dependent
  postinstall/test path; PR #21 contains the technical candidate but is
  not integrated (#18).
- Historical `main` evidence has two `test:reports-insights` assertion failures;
  PR #22 contains the deterministic test correction but is not integrated (#20).
- Premigration backup failure is not fail-closed for an existing database
  (issue #16).
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
