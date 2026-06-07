# DevAssets

**Unified developer asset management for independent builders.**

Track environment variables, API keys, and payment platform health across all your projects — with signed exports, audit logs, and native AI integration via MCP.

[![npm](https://img.shields.io/npm/v/@hyphen-network/devassets)](https://www.npmjs.com/package/@hyphen-network/devassets)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.5.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## The Problem

You have 10+ projects. Each has `.env` files, API keys, Paddle webhooks, Stripe secrets. Before every deploy you're mentally running through a checklist: *Is the webhook registered? When did I last rotate that key? Is the staging database URL correct?*

DevAssets solves this with a single CLI that scans, checks, exports, and audits — without ever storing your secret values.

---

## Features

- **Zero secret storage** — scans key *names* only, never values
- **Project health dashboard** — status across all projects at a glance
- **Signed manifests** — HMAC-SHA256 signed exports you can verify later
- **Optional encryption** — AES-256-GCM for sharing sensitive checklists
- **Paddle integration** — webhook status, API key age tracking
- **Full audit trail** — every scan, export, and rotation logged
- **MCP server** — AI agents (Claude Code, Cursor) can query and manage assets natively
- **Web dashboard** — local React UI via `devassets ui`
- **No background processes** — event-driven, runs only when called
- **100% local** — SQLite database, no cloud sync

---

## Requirements

- Node.js **22.5+** (uses built-in `node:sqlite`)

---

## Installation

```bash
npm install -g @hyphen-network/devassets
```

---

## Quick Start

```bash
# 1. Initialize (creates ~/.devassets/ database and signing key)
devassets init

# 2. Register your projects
devassets add-project legita --path=~/projects/legita --type=saas
devassets add-project sparkie --path=~/projects/sparkie --type=desktop

# 3. Scan environment files
devassets scan legita

# 4. Check health
devassets check legita
```

```
Project: legita
Status: ⚠ WARNING

Assets (18 configured, 1 missing, 0 errors):
  ✅ SUPABASE_URL                           .env:1
  ✅ SUPABASE_KEY                           .env:2
  ✅ PADDLE_API_KEY                         .env.production:1
  ❌ PADDLE_WEBHOOK_SECRET                  .env.production (MISSING)

Payment Platforms:
  🟡 Paddle — Webhook not verified

Risks:
  [CRITICAL] PADDLE_WEBHOOK_SECRET missing in production
  [MEDIUM]   Paddle webhook registered but not verified active

Suggestions:
  1. Add PADDLE_WEBHOOK_SECRET to .env.production
  2. Verify webhook endpoint in Paddle dashboard
```

---

## Commands

| Command | Description |
|---|---|
| `devassets init` | Initialize database and signing key |
| `devassets add-project <name>` | Register a project |
| `devassets scan <project>` | Scan `.env` files and update asset records |
| `devassets check <project>` | Check asset health and risks |
| `devassets export <project>` | Export a signed manifest |
| `devassets verify <project>` | Verify a manifest's signature |
| `devassets rotate <project> <key>` | Record rotation intent + instructions |
| `devassets audit <project>` | View audit log |
| `devassets ui` | Start web dashboard at localhost:9090 |
| `devassets serve` | Start MCP server (stdio) |

### Export formats

```bash
# Signed YAML manifest (default)
devassets export legita --env=production

# Markdown checklist
devassets export legita --env=production --format=checklist

# Variable names only (reference)
devassets export legita --env=production --format=reference-only

# Encrypted (AES-256-GCM)
devassets export legita --env=production --encrypt --encrypt-for=mypassword
```

### CI/CD integration

```yaml
# GitHub Actions — gate deploys on asset health
- name: Check assets
  run: devassets check ${{ env.PROJECT }} --env=production --fail-on-risk
```

---

## Web Dashboard

```bash
devassets ui --port=9090
# Opens http://localhost:9090
```

View all projects, asset tables, payment platform status, and full audit timeline in a browser UI.

---

## MCP Integration (Claude Code / Cursor)

Add to your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "devassets": {
      "command": "devassets",
      "args": ["serve"]
    }
  }
}
```

Available MCP tools:

| Tool | Description |
|---|---|
| `devassets_list_projects` | List all projects and health status |
| `devassets_check` | Check a project's assets and risks |
| `devassets_scan` | Scan and update asset records |
| `devassets_export` | Export a signed manifest |
| `devassets_health` | Quick health summary across projects |
| `devassets_audit` | Query audit log |
| `devassets_rotate` | Initiate key rotation |
| `devassets_add_project` | Register a new project |

Once configured, you can ask your AI agent:
> *"Check the production assets for legita"*
> *"Export a signed manifest for sparkie staging"*
> *"When was the last time I rotated the Paddle API key?"*

---

## Security Model

- **No secret values stored** — DevAssets reads key names from `.env` files, never values
- **No secret values in logs** — audit trail contains metadata only
- **Signed exports** — every manifest is HMAC-SHA256 signed with a local key at `~/.devassets/signature.key`
- **Encryption is opt-in** — AES-256-GCM, password never persisted
- **No network calls by default** — Paddle API calls only when explicitly triggered by `check`
- **Local-only storage** — `~/.devassets/devassets.db` (SQLite), never synced to cloud

---

## Local Storage

```
~/.devassets/
  devassets.db        Projects, assets, payment platforms, audit logs
  signature.key       32-byte HMAC signing key (chmod 600, auto-generated)
  permissions.yml     RBAC config (default: owner can do everything)
```

---

## License

MIT
