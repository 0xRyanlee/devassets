# Changelog

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
