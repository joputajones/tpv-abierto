# Risk register

Scores use a simple 1-5 scale for probability and impact. Priority is probability × impact. Review this document at every milestone exit.

| ID | Risk | Probability | Impact | Priority | Current mitigation | Owner/status |
|---|---|---:|---:|---:|---|---|
| R-001 | FloCafe baseline is less mature than its interface and README suggest | 3 | 5 | 15 | Complete M0 audit before product changes | `OPEN` |
| R-002 | Existing mobile/secondary-device flow is unsuitable for waiters | 4 | 4 | 16 | Validate on ordinary phones during M1; avoid assuming roadmap features exist | `OPEN` |
| R-003 | Print jobs can be lost or duplicated during failures | 3 | 5 | 15 | Inspect queue model; add persistent IDs, state and failure tests if missing | `OPEN` |
| R-004 | Electron resource use is too high for intended low-end hardware | 3 | 4 | 12 | Benchmark representative hardware before promising minimum requirements | `OPEN` |
| R-005 | Updates or migrations damage an existing restaurant database | 2 | 5 | 10 | Preserve non-destructive migrations, pre-migration backups and upgrade fixtures | `OPEN` |
| R-006 | Public repository accidentally receives customer data or credentials | 3 | 5 | 15 | Public-data policy, sanitised fixtures, secret scanning and PR review | `OPEN` |
| R-007 | FloCafe upstream changes conflict with the fork | 4 | 3 | 12 | Keep custom changes modular; record upstream base and sync procedure | `OPEN` |
| R-008 | Rebranding or packaging violates licences or trademarks | 2 | 5 | 10 | Preserve MIT notices; audit dependencies and brand use before release | `OPEN` |
| R-009 | Product is presented as Spanish fiscal-compliant before validation | 3 | 5 | 15 | Keep fiscal scope deferred and require specialist sign-off | `OPEN` |
| R-010 | VirtuaPOS data model cannot be fully reconstructed from available files | 3 | 4 | 12 | Acquire full `C:\BLATTA`; build graceful partial-import reports | `BLOCKED` |
| R-011 | Restaurant network or hardware failures are blamed on the software | 5 | 4 | 20 | Health check, controlled appliance option, diagnostics and clear support boundaries | `OPEN` |
| R-012 | No recurring fee leaves human support economically unsustainable | 4 | 4 | 16 | Design self-service diagnostics; price installation and interventions realistically | `OPEN` |
| R-013 | AI support gives unsafe or invented repair instructions | 3 | 5 | 15 | AI may select only allow-listed deterministic procedures; no arbitrary commands | `OPEN` |
| R-014 | Internet fallback design becomes more complex than the core product | 3 | 3 | 9 | Prioritise independent LAN; treat cellular and emergency AP as tested optional layers | `OPEN` |
| R-015 | Scope expands into a full Restaurant OS before the pilot works | 5 | 4 | 20 | Enforce milestone gates and out-of-scope list in `PRODUCT_SPEC.md` | `OPEN` |
| R-016 | Documentation drifts away from actual implementation | 4 | 3 | 12 | Require tracking-document updates in behaviour-changing PRs | `OPEN` |
| R-017 | Upstream `AGENTS.md` contains stale versions or commands | 3 | 3 | 9 | Verify against `package.json`, scripts and actual command results during M0 | `OPEN` |

## Escalation rule

Any risk with priority 15 or greater must have:

- a named mitigation issue;
- an owner;
- a target milestone;
- evidence before the affected milestone can exit.

## Closed-risk rule

Do not delete closed risks. Mark them `CLOSED`, record the date and link the evidence that reduced or eliminated them.
