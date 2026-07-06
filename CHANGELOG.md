# Changelog

> **Version scheme (from v1.11 onwards):** `GENERATION.MINOR.YYYYMMDD[.N]`
> — Generation 1 = production; Minor increments per feature sprint; Date = release date.

---

## [1.15.260706] — 2026-07-06

### Added
- **`suggestScope(key)`** (`src/utils/constants.ts`): advisory classifier distinguishing account/platform-level credentials (safe default candidates for `_global`) from per-application secrets (database URLs, signing keys, JWT/session/webhook secrets) that should stay project-scoped. Never blocks a write — `devassets set` now prints a one-line hint in both directions when the key name matches a known pattern.
- **README**: new "Choosing project vs. global" section makes the default explicit — project scope by default, `_global` only for credentials that authenticate to a shared account/platform. Fixed an existing MCP routing example that incorrectly listed `PADDLE_API_KEY` (account-level) as a project-specific example.

### Why
A live multi-project audit found `PADDLE_API_KEY` duplicated across three separate projects instead of stored once in `_global`, while at the same time the README's own MCP tool-routing table modeled `PADDLE_API_KEY` as a *project-specific* example — the documentation was itself teaching the wrong default. This release corrects the guidance and adds a lightweight runtime nudge so the same mistake doesn't require a manual audit to catch next time.

## [1.14.20260621] — 2026-06-21

### Fixed
- **Apple provider implementation included**: `1.13.260619` was published without `apple.ts` (implementation file was uncommitted at publish time). `1.14` republishes with the full implementation present.

### Added
- **Apple provider** (`src/integrations/providers/apple.ts`): validates and resolves Apple credentials via four registered patterns — `APPLE_KEY_ID` (10-char), `APPLE_ISSUER_ID` (UUID), `APPLE_TEAM_ID` (10-char), and `APPLE_NOTARY_KEY_P8` / `APPLE_API_KEY_P8` / `APPLE_PRIVATE_KEY_P8` (`.p8` file patterns). ES256 JWT signing with `ieee-p1363` encoding; optional App Store Connect API confirmation when key ID + issuer ID are present.

---

## [1.13.20260619] — 2026-06-19

> ⚠️ **Superseded by 1.14** — `apple.ts` was not included in the published package. Upgrade to `1.14.260621`.

### Added
- Apple provider + four APPLE\_\* key patterns registered in provider index. *(Not functional in this release — see 1.14.)*

---

## [1.12.20260618] — 2026-06-18

### Fixed
- **CLI/MCP default env unified to `local`** via shared `DEFAULT_ENV` constant (`src/utils/constants.ts`).
  Previously `set`/`get` CLI defaulted to `local` while MCP `get_secret`/`get_global_secret`/`set_global_secret`
  defaulted to `production` — a silent mismatch. MCP not-found responses now include `alternateEnvs` hint
  listing envs where the key actually exists.
- **MCP `devassets_audit` project guard**: unknown project IDs now return `{error: "Project not found"}` instead of silent `[]`.
- **MCP `devassets_rotate` bad tool reference**: rotate instructions referenced non-existent `devassets_set_secret`.
  Tool now exists — see Added.
- **MCP `list_projects`/`health` onboarding hint**: empty DB now returns an actionable message instead of `[]`.
- **`deleteProject` cascade**: now explicitly deletes `secret_values`, `assets`, `payment_platforms`, `credential_identities`
  before removing the project row (FK CASCADE was not PRAGMA-enabled).
- **DB directory/file permissions**: `~/.devassets/` is now `chmod 0o700` and `devassets.db` is `chmod 0o600`
  instead of relying on umask.

### Added
- **`devassets delete-project <id> [--force]`**: removes a project and all its vault data with interactive confirmation.
- **MCP `devassets_set_secret`**: project-scoped write tool — agents can now store secrets for specific projects via MCP
  (previously only global writes were MCP-accessible).
- **Source-code hardcoded secret detection** (`src/core/scanner.ts`): `scanSourceHardcoded()` walks `.ts/.js/.py/.rb/.go`
  files with 7 provider-specific patterns (Stripe, AWS, GitHub, Slack, Anthropic, Google, Paddle) and an assignment pattern
  for secret-named variables. Values are masked (`sk_liv****`). Suppresses placeholder values and respects `.devassetsignore`.
  `ScanResult` now includes `hardcodedFindings[]`; `devassets scan` displays findings with file:line.
- **File-type secrets** (`set --file`, `get --out`): store binary or text files (`.p8`, keystores, GCP JSON, SSH keys)
  directly in the vault. Binary files detected via null-byte heuristic → stored as base64; text as UTF-8.
  `get --out <path>` materializes at `chmod 0600`; `--mode <octal>` overrides. `list` tags entries `[file]`/`[file/bin]`.
  Two new columns (`encoding`, `original_filename`) added via idempotent migrations; `getVaultSecretWithMeta()` exposes them.
- **Apple provider identity resolution** (`src/integrations/providers/apple.ts`): validates `APPLE_KEY_ID` (10-char),
  `APPLE_ISSUER_ID` (UUID), `APPLE_TEAM_ID` (10-char), and `.p8` key names (PEM/base64-PEM; readonly App Store Connect
  API confirmation when `APPLE_KEY_ID` + `APPLE_ISSUER_ID` are present). ES256 JWT signed with `ieee-p1363` encoding.
  Six `APPLE_*` patterns registered in provider registry.

### Removed
- `src/commands/ui.ts`: dead web UI code from v0.10.0 (dependencies already removed, command was never registered).

---

## [1.11.20260611] — 2026-06-11

### Added
- **Auto-update notification** (`src/utils/update-check.ts`): non-blocking npm registry check
  at startup; caches result 24h at `~/.devassets/last-update-check.json`; warns to stderr
  when a newer version is available. Only fires in interactive TTY sessions (not CI).
- **CI detection** (`src/utils/env.ts`): `isCI()` / `isInteractive()` utility checks
  `CI`, `GITHUB_ACTIONS`, `GITLAB_CI`, `CIRCLECI`, `TRAVIS` env vars.
- **Global vault** (`_global` project): account-level credentials shared across all projects.
  `devassets set _global VERCEL_TOKEN` — scope auto-set to `global`.
  `inject` / `run` merge global keys automatically; project-specific keys take precedence.
- MCP: `devassets_get_global_secret` / `devassets_set_global_secret` tools.
- `src/core/ci.ts`: `generateCiSnippet` extracted from MCP server for reuse.
- 17 new vault-db unit tests covering scope routing, fallback priority order,
  `listVaultSecrets` redirect, `findSecretAcrossProjects` filter.

### Changed
- Spinner suppresses animation in CI environments (`isCI()` check added).
- `rotate` / `unset`: fail-fast with clear error when run in CI without `--yes`.
- `set` warns to stderr when value is passed as CLI argument (shell history risk).
- `status` / `doctor` filter `_global` from project table; show global vault count separately.
- `devassets_get_global_secret` not-found hint now points to MCP tool syntax.
- `devassets_set_global_secret` value schema adds `.max(65536)` guard.
- Cloud backup warning in `init` output and README strengthened with step-by-step
  iCloud / Time Machine / `.gitignore` instructions.
- WAL mode + `busy_timeout=5000` on DB open for concurrent access safety.

### Security
- `inject --print` now uses single-quote wrapping with `'\''` escaping — safe for all
  shell meta-characters (`$`, `` ` ``, `\`, `!`, spaces).
- `getVaultSecretFallback` scope read from DB (not hardcoded strings).

### Fixed
- `listVaultSecrets(scope='global')` auto-redirects to `_global` project regardless of
  caller's `projectId` argument.
- `CLI get` falls back to `_global` vault on primary project miss.

**127 tests pass.**

---

## 0.10.0 — 2026-06-10

### `status` command + web UI removed from bundle

**New command: `devassets status`**
Compact single-line-per-project table showing vault secrets (by env), asset health
(total vars · missing count), identity status (pinned / mismatch / invalid), and
last scan age. Colour-coded with chalk. Attention section lists actionable hints per
problem project. `--json` for machine-readable output.

**Web UI removed from npm package**
`express`, `cors`, and `open` removed from production dependencies. `ui/dist/` removed
from `files` whitelist. The `ui` command is removed from the CLI. Web UI source stays
in the repo and can be built locally (`npm run build:ui`) for those who want it.
Package size reduced by ~424 kB (ui/dist/) plus removed runtime deps.

110 tests pass.

---

## 0.9.0 — 2026-06-10

### Phase 1 Vault — local-first encrypted secrets manager

**Product pivot**: DevAssets is now a local-first developer secrets / env manager for
centralising environment variables, account identities, gap detection, and quick injection
across multiple projects.

**New vault commands:**
- `set <project> <key> [value]` — encrypt and store a secret (AES-256-GCM per-value IV);
  prompts with hidden TTY input when value omitted
- `get <project> <key>` — decrypt and print a value; `--raw` omits trailing newline for
  subshell capture
- `list <project>` — show stored key names and metadata; values are **never** shown
- `unset <project> <key>` — delete a secret with confirmation prompt (`--yes` to skip)
- `inject <project>` — load secrets into current process environment; `--print` outputs
  `export KEY=value` statements instead
- `run <project> -- <cmd>` — execute a command with secrets injected as env variables

**Crypto design:**
- Vault key derived from the existing signature key via HKDF-SHA256 with salt
  `devassets-vault-v1` — no separate key file needed
- Each secret encrypted with AES-256-GCM, unique 12-byte IV per operation
- `encrypted_value`, `iv`, and `auth_tag` stored separately in `secret_values` table

**DB migration:** `secret_values` table added (schema is forwards-compatible via `CREATE TABLE IF NOT EXISTS`).

110 tests pass.

---

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
