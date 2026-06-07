# Changelog

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
