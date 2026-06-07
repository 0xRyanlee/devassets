# DevAssets Architecture

## Overview

```
devassets/
├── src/           TypeScript source (CLI + MCP server + Express API)
├── ui/            React Dashboard (Vite + Tailwind)
├── dist/          Compiled CLI (node dist/index.js)
├── tests/         Unit + integration tests (vitest)
└── docs/          Design documents
```

## Runtime Stack

| Layer | Technology | Notes |
|---|---|---|
| CLI | Commander.js | `devassets <command>` |
| Language | TypeScript → ESM | Node 22.5+ |
| Database | `node:sqlite` (built-in) | `~/.devassets/devassets.db` |
| MCP Server | `@modelcontextprotocol/sdk` | stdio transport |
| Dashboard Backend | Express.js | serves UI + REST API |
| Dashboard Frontend | React 18 + Vite + Tailwind CSS | compiled to `ui/dist/` |
| Signing | HMAC-SHA256 (`node:crypto`) | key at `~/.devassets/signature.key` |
| Encryption | AES-256-GCM (`node:crypto`) | password-derived key via scrypt |

## Data Storage (all local, no cloud)

```
~/.devassets/
  devassets.db        SQLite database (projects, assets, payments, audit)
  signature.key       32-byte HMAC signing key (chmod 600)
  permissions.yml     RBAC configuration
```

## MCP Integration (AI Interface)

`devassets serve` starts a stdio MCP server. Configure once in Claude Code:

```json
// .claude/settings.json
{
  "mcpServers": {
    "devassets": {
      "command": "devassets",
      "args": ["serve"]
    }
  }
}
```

MCP Tools: `devassets_list_projects`, `devassets_check`, `devassets_scan`,
`devassets_export`, `devassets_health`, `devassets_audit`, `devassets_rotate`,
`devassets_add_project`

## Security Invariants

1. **No secret values stored** — only key names, locations, and status
2. **No secret values in logs** — audit logs contain metadata only
3. **All exports signed** — HMAC-SHA256 with local key
4. **Encryption is opt-in** — AES-256-GCM, password never stored
5. **No network by default** — Paddle API calls only when explicitly triggered
