# Development workflow

This workflow keeps ChatGPT Work, Codex, GitHub and the project documents aligned.

## Sources of truth

- Product scope and acceptance: `PRODUCT_SPEC.md`
- Current state: `STATUS.md`
- Ordered milestones: `ROADMAP.md`
- Requirement status: `FEATURE_MATRIX.md`
- Validation evidence: `TEST_MATRIX.md`
- Long-term technical decisions: `decisions/`
- Work items and discussion: GitHub issues
- Reviewable implementation: pull requests

Chat messages are not the permanent source of truth. Decisions made in chat must be transferred into the appropriate repository document or issue.

## Roles

### ChatGPT Work

- maintain product scope and roadmap;
- turn findings into requirements and acceptance criteria;
- review risks, architecture and milestone readiness;
- prepare bounded tasks for Codex;
- verify that documentation and implementation remain aligned.

### Codex

- inspect the local repository and terminal output;
- work on one bounded issue at a time;
- run required tests and builds;
- update tracking documents when behaviour changes;
- produce reviewable commits and pull requests.

### Human project owner

- approve scope and architectural decisions;
- provide access to real hardware and sanitised source data;
- validate restaurant workflows;
- accept or reject milestone exits.

## Issue types

Use one clear type at the start of every issue title:

- `[AUDIT]` inspection or baseline verification
- `[FEATURE]` new user-facing capability
- `[FIX]` defect correction
- `[TEST]` missing validation or fixture
- `[DOCS]` documentation work
- `[ADR]` architectural decision
- `[RISK]` mitigation work
- `[IMPORT]` migration/importer work
- `[OPS]` installation, network, recovery or support tooling

## Required issue fields

Every implementation issue must include:

1. Problem statement.
2. User or operational impact.
3. Scope.
4. Explicit non-scope.
5. Acceptance criteria.
6. Validation commands or physical test procedure.
7. Relevant feature and test IDs.
8. Risks affected.
9. Documentation that must be updated.

## Branches

Use short-lived branches from the agreed integration branch:

- `audit/<name>`
- `feature/<name>`
- `fix/<name>`
- `test/<name>`
- `docs/<name>`
- `import/<name>`
- `ops/<name>`

Do not combine unrelated work in one branch.

## Pull requests

A pull request must contain:

- summary of the problem and solution;
- linked issue;
- changed behaviour;
- test/build commands and exact outcomes;
- manual or hardware test evidence where applicable;
- database migration impact;
- offline-operation impact;
- privacy/security impact;
- rollback plan;
- tracking documents updated.

A documentation-only PR may state that runtime tests are not applicable, but must still check links and internal consistency.

## Dependency review policy (R-025)

The repository's **Dependency Graph** setting must remain enabled. The owner
enabled it on 2026-07-31 after `dependency-review` had failed before evaluating
any change with: `Dependency review is not supported on this repository`.
Re-running the unchanged workflow then succeeded, so no workflow fallback or
permission expansion was required.

`.github/workflows/ci.yml` runs `dependency-review` for every
`pull_request` targeting `main`. The job uses read-only `contents` and
`pull-requests` permissions and pins
`actions/dependency-review-action` v4.5.0 by commit SHA. Its policy is:

- fail when a PR introduces a vulnerability with severity `high` or
  `critical` (`fail-on-severity: high`);
- do not use `continue-on-error` or the action's `warn-only` override;
- execute for documentation-only PRs and return an explicit pass when no
  dependency change is present;
- evaluate root and `frontend/` manifests and lockfiles when they change;
- skip intentionally on `push` events because the job condition requires
  `github.event_name == 'pull_request'`.

An absent job is not evidence of success. Record whether the result is
`PASS`, an intentional `SKIP`, or `FAIL`, and inspect the action log for real
dependency changes. The current repository has no branch protection or
ruleset requiring this status, so maintainers must treat a red
`dependency-review` as a manual merge blocker until an enforced ruleset is
approved.

### Validation evidence

- Documentation-only PR #14, workflow run `30628431839` attempt 2: the action
  executed and passed; `changes` and the tax invariant passed, while Linux and
  Playwright were visibly skipped by path filtering.
- PR #22, workflow run `30635762331` attempt 2: re-running only the previously
  failed job after enabling Dependency Graph changed it from configuration
  failure to pass without a code or workflow change.
- Disposable PR #23, workflow run `30637713341`: the action reported
  `package-lock.json`, removed `@types/node@26.1.1`, added
  `@types/node@26.1.2`, evaluated the `high` threshold and found no matching
  vulnerability or denied package. The PR was closed without merge and its
  branch deleted.
- The Dependency Graph manifest inventory listed `package.json`,
  `package-lock.json`, `frontend/package.json` and
  `frontend/package-lock.json` as parseable manifests.

The pinned action metadata states that `fail-on-severity` fails a pull request
check when the introduced vulnerability meets or exceeds the configured
threshold. This is configuration evidence; no deliberately vulnerable package
was published for the negative test.

Rollback does not require an application, database or dependency change. If
the repository setting is disabled or the action again reports itself as
unsupported, re-enable Dependency Graph and re-run the failed job. Reverting
this documentation alone does not restore the security signal. The Node 20 to
Node 24 action-runtime warning remains separate from R-025 and did not affect
these results.

## Definition of done

A work item is `DONE` only when:

- acceptance criteria pass;
- required automated tests pass;
- relevant builds pass;
- manual or hardware tests are complete where required;
- no undocumented destructive migration exists;
- no credential or customer data is committed;
- documentation is updated;
- the PR is reviewed and merged;
- `FEATURE_MATRIX.md`, `TEST_MATRIX.md` or `STATUS.md` reflects the result.

## Decision records

Create an ADR when a decision:

- changes architecture or data ownership;
- adds a persistent external dependency;
- changes licensing or distribution;
- changes update, backup or recovery strategy;
- changes local/offline guarantees;
- changes fiscal boundaries;
- is expensive to reverse.

Use `decisions/ADR-000-template.md`.

## Milestone review

At each milestone exit:

1. Update `STATUS.md`.
2. Review all feature rows assigned to the milestone.
3. Review required tests and evidence.
4. Review open risks with priority 15 or greater.
5. Record unresolved gaps rather than silently carrying them forward.
6. Approve the exit explicitly in a milestone issue or ADR.

## Public repository safety

Never commit:

- raw `C:\BLATTA` contents;
- production MDB or SQLite databases;
- customer names, tickets or sales history;
- staff PINs or credentials;
- real network passwords or private IP plans tied to a customer;
- diagnostic bundles that have not been reviewed and sanitised.

Use synthetic or explicitly sanitised fixtures only.
