# Development status

**Snapshot date:** 2026-07-31
**Overall phase:** Phase 0 — baseline audit  
**Overall status:** `IN_PROGRESS`

## Executive summary

The project has selected FloCafe as the technical base and copied the upstream repository into `joputajones/tpv-abierto`. The current codebase must still be treated as an unverified baseline: the project has not yet completed a reproducible local build, a complete test run, hardware validation or a formal gap analysis against the product specification.

No production-readiness, Spanish fiscal compliance or restaurant deployment claim should be made at this stage.

## Current facts

| Area | Status | Evidence / note |
|---|---|---|
| Public GitHub repository exists | `DONE` | `joputajones/tpv-abierto` |
| FloCafe source imported | `DONE` | Repository contains upstream code and history |
| Upstream remote configured locally | `UNVERIFIED` | Must be checked with `git remote -v` |
| Development environment installed | `PARTIAL` | Windows toolchain recorded in #18; cross-platform CI evidence pending |
| Dependency installation | `PARTIAL` | `npm.cmd ci` passes in PowerShell without Bash; Linux CI pending |
| Baseline test suite | `PARTIAL` | Runs without Bash and reaches the independent `test:reports-insights` failure in #20 |
| Upgrade-path tests | `PARTIAL` | Local Windows v0→v38 validation passes; CI review pending |
| Main TypeScript build | `PARTIAL` | Local Windows build passes; CI review pending |
| Frontend build | `PARTIAL` | Local Windows static build passes; CI review pending |
| Windows application launch | `NOT_STARTED` | Must be demonstrated locally |
| KDS local-network flow | `UNVERIFIED` | Code exists upstream; project validation pending |
| Secondary cashier/mobile flow | `UNVERIFIED` | Project validation pending |
| Physical printer integration | `NOT_STARTED` | Restaurant printers not yet connected to this system |
| Backup and restore validation | `NOT_STARTED` | Must be tested with disposable data |
| Internet-loss test | `NOT_STARTED` | Must prove local continuity |
| VirtuaPOS catalogue analysis | `PARTIAL` | Initial JSON/MDB analysis exists outside the repository |
| Full `C:\BLATTA` acquisition | `BLOCKED` | Requires another restaurant visit |
| VirtuaPOS importer | `NOT_STARTED` | Cannot be considered implemented |
| Diagnostic assistant | `NOT_STARTED` | Product concept only |
| Public training site | `NOT_STARTED` | Product concept only |
| Spanish fiscal adaptation | `OUT_OF_SCOPE` | Deferred until after non-fiscal pilot |
| Rebranding | `OUT_OF_SCOPE` | Deferred until baseline audit completes |

## Active milestone

### M0 — Reproducible baseline

**Goal:** prove that the unmodified FloCafe baseline can be installed, tested, built, launched and understood before product changes begin.

Exit criteria:

- [ ] Local repository remotes and branches recorded.
- [ ] Node and npm versions recorded.
- [ ] Clean dependency installation completed.
- [ ] Existing tests completed and failures documented.
- [ ] Main build completed.
- [ ] Frontend build completed.
- [ ] Application launched on Windows.
- [ ] Database, logs and backup paths recorded.
- [ ] One disposable order survives application restart.
- [ ] Baseline architecture and production risks documented.

## Immediate next actions

1. Complete the baseline audit with Codex on a dedicated branch.
2. Record every command and result rather than relying on README claims.
3. Confirm whether existing `AGENTS.md` matches the actual dependency versions and scripts.
4. Produce the first gap analysis against `PRODUCT_SPEC.md`.
5. Do not start rebranding, fiscal work or the VirtuaPOS importer until M0 exits.

## Blockers

- #20: the reports insights regression keeps the complete suite from passing.
- #16: pre-migration backup fail-closed behaviour still needs a decision and validation.
- #18 remains in review until the Windows portability PR has Linux CI evidence and is merged.
- Full VirtuaPOS installation data is not yet available.
- Physical restaurant printer and network testing must wait for the next visit or an equivalent test bench.

## Confidential material rule

Restaurant files, credentials, PINs, network addresses, ticket history and personal data must not be committed to this public repository. Store test fixtures only after sanitisation and explicit review.
