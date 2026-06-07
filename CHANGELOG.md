# Changelog

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
