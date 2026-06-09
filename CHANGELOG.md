# Changelog

## 0.8.1 — 2026-06-10

### Robustness — fault tolerance, defensive guards, security hardening

Addresses findings from a graph-exploration + intent + user-journey audit focused on
failure paths, silent degradation, and defensive design.

**Fault tolerance:**
- `db/index.ts` — DB init failures (permissions, disk full) now emit user-friendly error
  messages with recovery instructions instead of raw Node.js stack traces.
- `core/roots.ts` — `.devassets.yml` YAML parse errors now emit `logger.warn` and fall
  back to discovery mode; previously the failure was silently swallowed.
- `utils/crypto.ts` — `signature.key` is validated to be ≥ 32 bytes on read; a truncated
  or empty key now throws a clear error with instructions to regenerate.

**Security hardening:**
- `mcp/server.ts` — MCP `output_path` now also resolves symlinks on the parent directory
  (`fs.realpathSync`) after the string-prefix check, blocking symlink traversal attacks.
- `db/queries.ts` — `upsertCredentialIdentity` truncates `account`/`workspace` to 1 024 chars
  and `projects` JSON to 8 192 chars to prevent provider response bloat from expanding the DB.

**Defensive UX:**
- `commands/export.ts` — `--encrypt --encrypt-for` now requires a password of at least
  8 characters; shorter passwords are rejected with exit 1.
- `commands/check.ts` — warns "run devassets scan first" when a project has 0 assets,
  preventing the misleading "HEALTHY" status for unscanned projects.
- `core/identity.ts` — provider API calls now have a 10-second timeout with proper timer
  cleanup; previously a hanging network call would block the command indefinitely.
- `commands/verify.ts` — YAML parse errors now include a hint to try `--decrypt` if the
  manifest appears to be encrypted.

96 tests pass.

---

## 0.8.0 — 2026-06-10

### UX polish — flow hints, `--json` consistency, portfolio ergonomics

Addresses findings from a graph-exploration + user-journey + intent audit.

**New flags:**
- `verify` now supports `--json` for machine-readable output (CI pipelines).
- `portfolio` now supports `--json` to output the full report as structured JSON.

**Error guidance:**
- `check` — project-not-found error now shows the `add-project` command to run.
- `verify` — missing `--manifest` error now shows the full `export → verify` workflow.

**Flow hints:**
- `init` — next steps now include `check` and `identity` (was: only `add-project` + `scan`).
- `export` — after writing a file, shows the matching `verify` command to run next.
- `portfolio` — shows a next-step hint pointing to the generated `current.json`.

**Portfolio ergonomics:**
- Default `--root` changed from hardcoded `/Volumes/Astoria/Projects` to `process.cwd()`.
- Default `--overview` changed to `<root>/overview` (relative to root).
- Description no longer mentions Astoria-specific paths.

**Docs:**
- README Portfolio section rewritten with generic paths and a full options table.
- `ARCHITECTURE.md` Security Invariant #5 clarified: MCP tool invocations of
  `devassets_check` are treated as explicit invocations (equivalent to CLI `check`).

96 tests pass.

---

## 0.7.0 — 2026-06-08

### Features — form-aware severity (Axis C); completes the classification model

The project `type` (set at `add-project`) now drives missing-secret severity:

- `desktop` / `mobile` / `library`: a missing secret is **relaxed to low** (not critical) —
  these forms manage secrets in CI, the OS keystore, or at runtime, not local `.env`.
  The message nudges the user to declare the real location in `.devassets.yml`.
- `saas` / `other` / web: unchanged — missing secret stays high/critical.
- `managed` assets never produce a risk, regardless of form.

This closes the desktop/mobile false-critical noise (e.g. the mindset Paddle case) without
hiding anything. Milestone #1 (3-axis classification: sensitivity + location + form) complete.
4 new validator tests; 92 total pass.

## 0.6.0 — 2026-06-08

### Features — secret location annotation (Axis B, `.devassets.yml`)

Completes the hybrid classification model: heuristics by default, `.devassets.yml` for precise overrides.

- New `secrets:` map in `.devassets.yml` declares where each key lives:
  `local-env` (default) / `cloud-platform` / `ci-secret` / `runtime-user` / `source-public` / `external-vault`.
- Keys declared as non-`local-env` show as **managed** (☁) — never falsely reported missing.
  Closes the "cloud/CI/runtime/desktop secret isn't local but that's correct" gap.
- Managed keys declared only in `.devassets.yml` (in no file) still surface for visibility.
- New `managed` asset status + count, shown in `check` output, dashboard stat cards, and badges.
- 3 new scanner tests; 88 total pass.

## 0.5.0 — 2026-06-08

### Features — monorepo support (3-layer scan-root resolution)

`scan`, `check`, and `identity` are now monorepo-aware. Scan roots resolve in priority order:

1. **`.devassets.yml` `roots:`** — explicit per-project override (hybrid model, Axis B groundwork)
2. **Workspace manifest** — `pnpm-workspace.yaml`, `package.json` workspaces, Cargo `[workspace] members` (globs expanded)
3. **Smart discovery** — sub-dirs that have both a manifest (package.json/Cargo.toml/…) AND an env file; skips `node_modules`, `archive`, `dist`, etc.

- Asset locations are now scope-prefixed (`web/.env.local:8`), and missing-key detection runs per scope.
- `readProjectEnvValue` reads token values transiently across all roots for `check`/`identity`.
- Verified live on Party (root-registered, secrets in `web/`): resolved Vercel + Supabase identities,
  surfaced an over-privileged Supabase PAT spanning 4 projects.
- 7 new root-resolution tests; 85 total pass.

## 0.4.2 — 2026-06-08

### Improved — credential classification model (Axis A: sensitivity)

Replaces the binary sensitive/not heuristic with a 4-way classifier (`classifyKey`),
grounded in the project-forms research. Fixes real misclassifications:

- `NEXT_PUBLIC_` / `PUBLIC_` / `VITE_` / `EXPO_PUBLIC_` prefix ⇒ **public** (overrides all) —
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_KEY` no longer falsely flagged as secrets.
- `*_CLIENT_ID`, `*_PRICE_ID`, `*_PRODUCT_ID`, `*_TEAM_ID`, `*_LIFF_ID` ⇒ **identifier** (not secret).
- `DATABASE_URL` / `DIRECT_URL` / `*_DSN` / `CONNECTION_STRING` ⇒ **secret** (embedded password).
- Missing-key severity: only `secret` drives high/critical; public/identifier/config stay low.

Risk messages now name the category (public config / identifier / optional config / secret).
6 new classifier tests; 78 total pass.

## 0.4.1 — 2026-06-08

### Fixed (found via cross-project dogfooding on mindset)

- **Payment check read the wrong source.** `check` (CLI + MCP) passed `process.env.PADDLE_API_KEY` /
  `process.env.STRIPE_SECRET_KEY` — the devassets process's own env, almost always empty — so it
  reported "not configured" regardless of the project's actual `.env`. Now reads the value transiently
  from the project's `.env` (via `readEnvValue`), falling back to `process.env` for CI.
- Added direct unit tests for `readEnvValue` (quote stripping, empty/missing handling, names-only boundary).

### Known follow-up (deferred for design discussion)

- Token-TYPE awareness: a Paddle client/publishable token checked against the server webhooks API
  returns 404, currently mislabeled "invalid or expired". Needs project-form / cloud-token modeling.

## 0.4.0 — 2026-06-08

### Features — Credential Identity layer

- **`devassets identity <project>`**: resolves which account / workspace / project each provider
  token belongs to. Solves "wrong account / workspace mismatch / can't find it" across:
  Vercel, Supabase, Neon, npm, Google Cloud (Paddle/Stripe via `check`).
- **`--pin`**: lock the currently-resolved account/workspace as expected; future runs warn on drift (⚠ MISMATCH).
- **Validity detection**: flags expired / revoked / wrong-scope tokens.
- **`devassets_identity` MCP tool**: agents can resolve identities and detect mismatches.
- **Dashboard**: per-project "Credential Identities" panel (cached, no live calls on page load).

### Security

- Token values are read **transiently** (`readEnvValue`) only to call a provider API, used in
  memory, never persisted. New `credential_identities` table stores resolved metadata only — no tokens.
- Offline resolution where possible: Supabase project ref parsed from `SUPABASE_URL`, GCloud
  identity parsed from the service account JSON — no network, no token transmission.

## 0.3.0 — 2026-06-08

### Fixed (core behavior — found via dogfooding)

- **Missing-key detection now works.** `.env.example` / `.env.sample` / `.env.template` are
  treated as the *declaration of required keys*, not as a config source. Keys declared there
  but absent from the actual `.env*` files are flagged as missing. Previously example files
  were scanned as real sources, so every declared key counted as "configured" and projects
  with unset required keys falsely reported healthy.
- **Two-tier missing severity**: secret-like keys (KEY/SECRET/TOKEN/PASSWORD/DSN/CREDENTIAL/
  API_KEY/…) missing → high (critical in production); non-sensitive config (APP_NAME, timeouts,
  feature flags) missing → low, does not break health status. Avoids false alarms on optional config.

### Notes

- This changes scan results: projects with `.env.example` files declaring unset keys will now
  surface real risks. Run `devassets doctor --fix` to re-scan after upgrading.

## 0.2.0 — 2026-06-08

### Features

- **Stripe integration**: webhook health check with secret key format validation
- **`doctor` command**: global health report across all registered projects
- **`doctor --fix`**: re-scan all projects to refresh stale asset records (listr2 task list)
- **`install-skills` command**: install Claude Code slash commands (`/devassets-check`, `/devassets-ci`)
- **MCP tools added**: `devassets_doctor`, `devassets_ci_snippet`, `devassets_skills` (11 tools total)
- **CLI spinners**: `ora` progress indicators on `scan`, `check`, `export` (TTY-aware, silent in `--json`)

### Security (adversarial audit)

- Atomic signature-key write (O_CREAT|O_EXCL, mode 0o600) — eliminates race window
- Web dashboard bound to `127.0.0.1` with localhost-only CORS
- `output_path` traversal guard on MCP export; `add-project` path validation rejects sensitive roots
- scrypt hardened to N=65536 (OWASP 2023); plaintext preview removed from MCP export response
- Audit log details capped; CI snippet inputs validated against injection

## 0.1.0 — 2026-06-07

Initial release.

### Features

- **CLI**: `init`, `add-project`, `scan`, `check`, `export`, `verify`, `rotate`, `audit`, `ui`, `serve`
- **MCP Server**: 8 tools for AI integration (`devassets serve` → stdio)
- **React Dashboard**: 5-page web UI (`devassets ui --port=9090`)
- **Signed exports**: HMAC-SHA256 manifest signing, AES-256-GCM optional encryption
- **Audit log**: Every operation recorded in local SQLite database
- **Paddle integration**: Webhook status verification, API key age tracking
- **RBAC**: `~/.devassets/permissions.yml` for operation permissions

### Technical

- Storage: `node:sqlite` built-in — no native compilation required (Node.js 22.5+)
- Zero cloud dependencies — all data stored locally in `~/.devassets/`
- 37 unit and integration tests
