# AGENTS.md — FloCafe

**Role:** You are a senior full-stack engineer specializing in Electron desktop apps with embedded Express backends and Next.js frontends.

## Mandatory Working Rules

1. Read `CONTRIBUTING.md` before changing code.
2. Run the relevant tests before and after every change. After modifying code,
   run the complete lint, build, and test protocol below.
3. Do not introduce or upgrade dependencies without documenting the need,
   alternatives, runtime impact, license, security, and maintenance cost.
4. Preserve offline operation. The core POS, orders, billing, KDS, printing,
   backups, and restore paths must not require Internet access.
5. Do not introduce mandatory cloud services. Every integration must be
   optional, fail safely, and leave local operation usable.
6. Protect migrations and backups. Never edit a released migration, never
   continue a risky migration without a verified recovery path, and test
   upgrades against existing data.
7. Keep the repository's MIT license and attribution intact in source and
   distributed artifacts.
8. Do not copy code, assets, schemas, or proprietary behavior from another POS
   without explicit maintainer approval and a documented license review.
9. Preserve unrelated user changes. Before handoff, leave the Git working tree
   clean and summarize every file and behavior changed.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 43 (Chromium) |
| Backend | Express.js + TypeScript (main/ → dist/) |
| Frontend | Next.js 16 + React 19 (static export) |
| Database | SQLite via better-sqlite3 (WAL mode) |
| State | Zustand |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Realtime | WebSocket (KDS on port 3002) |
| Printing | ESC/POS (node-thermal-printer) |

## Architecture

```
┌─────────────────────────────────────────┐
│ Electron Main Process                    │
│  main/index.ts → orchestrator            │
│  main/server.ts → Express :3001 (API)    │
│  main/kds-server.ts → Express :3002 (KDS)│
│  main/db.ts → SQLite (WAL, PRAGMA)       │
└──────────────┬──────────────────────────┘
               │ HTTP + WebSocket
┌──────────────▼──────────────────────────┐
│ Renderer (Next.js static export)         │
│  frontend/src/app/ → pages               │
│  frontend/src/store/ → Zustand           │
└─────────────────────────────────────────┘
```

Two independent Express servers: **:3001** (main API + frontend), **:3002** (KDS standalone).

## Commands

```bash
npm run dev              # Full app (Electron + backend + frontend)
node dev-server.js       # Backend-only (mocks Electron, faster iteration)
npm run build            # Compile main/ → dist/
npm run build:frontend   # Static export via Next.js

# Platform builds
npm run build:mac        # macOS DMG
npm run build:win        # Windows NSIS
npm run build:linux      # Linux AppImage + deb

# Tests
npm test                 # All tests (backup-restore, printer, db-audit)
npm run test:backup      # Single test file
npm run test:printer
npm run audit:db
npm run test:upgrade-path

# Frontend
cd frontend && npm run lint
cd frontend && npm run dev  # Frontend dev server only
```

**Requirements:** Node >= 22.0.0 (enforced via .npmrc engine-strict).

## Database

SQLite via better-sqlite3, WAL mode. Schema version via `PRAGMA user_version` (not settings table).

**ID convention:** Master/config tables use `id TEXT PRIMARY KEY`. Transaction tables (`orders`, `order_items`, `bills`, `loyalty_ledger`) use `INTEGER PRIMARY KEY AUTOINCREMENT`.

### Migrations — NEVER Destructive

- `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN` only
- Never `DROP TABLE` or `DROP COLUMN`
- Each change gets its own version increment
- Released migrations are immutable. Fix forward with a new migration.
- A migration must not proceed when its required safety backup cannot be
  created and verified.

```typescript
// Good
if (!columnExists('printers')) {
  db.exec(`CREATE TABLE IF NOT EXISTS printers (...)`);
}

// Bad — destroys data
dropAllTables();
```

## Key Tables

`settings`, `products`, `categories`, `orders`, `order_items`, `bills`, `customers`, `printers`, `users`, `addon_groups`, `addons`, `kitchen_stations`, `tables`, `loyalty_ledger`

## Git Conventions

- Branch: `feature/<name>`, `fix/<name>`
- Commit: imperative mood, scope optional (`fix(printer): handle USB disconnect`)
- Bump version in package.json before release
- Tags: `git tag -a v1.x.x -m "message"`

## Non-Negotiable Boundaries

### Do NOT Touch
- Private `specs` repo is external documentation only and must not be wired into this public repo as a submodule, build dependency, CI dependency, or runtime dependency
- Database migrations — never destructive, always test with existing data
- Credentials, API keys, internal URLs — never commit
- Repository MIT license, attribution, product identity, or branding unless the
  maintainer explicitly requests that exact change

### Always Verify
- Test import/export before major releases
- Run `npm test` before committing
- Build all platforms before tagging a release

## Release Checklist

- [ ] Migration tested on existing data
- [ ] Import/export verified
- [ ] All platforms built
- [ ] Version bumped in package.json
- [ ] Git tag pushed
- [ ] GitHub Release published

## Frontend

`frontend/` is part of this repository. It is not a git submodule.

## Post-Implementation Protocol

- **MANDATORY**: After modifying ANY code, run all linting
  (`npm run lint`), the main build (`npm run build`), the frontend build
  (`npm run build:frontend`), and the complete test suite (`npm test`) before
  reporting back.
- For database work, also run `npm run test:upgrade-path`, relevant backup/
  restore tests, and verify a copy of existing data.
- Report every command, warning, failure, skipped check, generated artifact,
  and cleanup action. Never imply a command passed if it was not executed.
