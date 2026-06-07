# DevAssets

**The credential command center for independent builders.**

Know exactly which API keys, env vars, and access tokens each of your projects uses — which account and workspace every token belongs to, what's missing before you deploy, and never again lose track or push with the wrong credentials. CLI + web dashboard + native AI integration via MCP. Your secret values never leave your machine.

[![npm](https://img.shields.io/npm/v/@hyphen-network/devassets)](https://www.npmjs.com/package/@hyphen-network/devassets)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.5.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## The Problem

You run 10+ projects. Each has its own `.env`, its own Vercel project, Supabase instance, Neon database, Google Cloud service account, LLM provider keys, and payment secrets. The pain isn't one big failure — it's the constant low-grade friction:

- *"Which `.env.example` key did I forget to actually set before this deploy?"*
- *"Is this `VERCEL_TOKEN` for my personal account or the company team?"*
- *"This `SUPABASE_URL` — is it pointing at the right project, or did I paste staging into prod?"*
- *"Which npm account is this token? Which Google Cloud project does this service account belong to?"*

These cause real incidents: a missing secret 500s production, a token from the wrong workspace silently writes to the wrong database, an expired key fails a deploy at 2am.

DevAssets gives you one place to see all of it — **without ever storing your secret values.**

---

## What DevAssets does — and what it does NOT do

### ✅ It does

| Capability | How |
|---|---|
| **Inventory** every env var / token across all projects | Scans `.env*` files for key *names* |
| **Detect missing required keys** before deploy | Compares actual `.env` against `.env.example` declarations |
| **Resolve token → account / workspace / project** | Calls each provider's identity API at check time (Vercel, Supabase, Neon, npm, Google Cloud) |
| **Catch wrong-account / workspace-mismatch** | Pin the expected identity once; warns on any future drift |
| **Verify validity** | Flags expired / revoked / wrong-scope tokens |
| **Visualize** per-project state | Local web dashboard + CLI reports |
| **Gate deploys** | `--fail-on-risk` exit code for CI |
| **Signed, optionally encrypted exports** | HMAC-SHA256 + AES-256-GCM |
| **AI-native** | MCP server — agents query/manage assets directly |

### ❌ It does NOT do (boundaries)

- **Does not store secret values.** It records key *names* and resolved *metadata* (account/workspace/validity). Token values are read transiently to call a provider API, used in-memory, and discarded — never written to disk.
- **Is not a secrets manager / vault.** It doesn't inject secrets into your runtime or replace Vault / Doppler / 1Password. It's the *map and health-check layer* on top of wherever your secrets actually live.
- **Is not a cloud service.** Everything is local SQLite at `~/.devassets/`. No sync, no account, no telemetry.
- **Does not rotate keys for you.** `rotate` records intent + gives instructions; you perform the rotation in the provider dashboard.
- **Does not run in the background.** It's event-driven — runs only when you (or an agent) call it.

---

## Before / After

| Scenario | Without DevAssets | With DevAssets |
|---|---|---|
| Deploy with a required key unset | 500 in production, debug from logs | `check --fail-on-risk` blocks the deploy, names the missing secret |
| Token from the wrong account | Silent — discovered when data lands in the wrong place | `identity` shows `account: personal@…` vs expected `team: company`; flags ⚠ MISMATCH |
| "Where is the Supabase project for this app?" | Dig through dashboards, guess the ref | Dashboard shows `workspace: abcd1234`, the exact project ref |
| Onboarding a 6-month-old project | Open `.env`, cross-check every service by hand | `scan` + `identity` produces the full map in seconds |
| "Did I rotate that key?" | Search Slack / memory | `audit` shows every rotation with timestamp |
| Sharing a deploy checklist | Paste secrets in chat (unsafe) | `export --encrypt` — signed, AES-encrypted, names-only |

---

## Scenarios

**Friday deploy, paperclip.** You run `devassets check paperclip --env=production`. It reports 4 critical missing secrets (`AUTH_TOKEN_KEY`, `AI_API_KEY`, `ERROR_TRACKING_DSN`, `AUTH_REFRESH_TOKEN_KEY`) declared in `.env.example` but never set — plus 32 optional config keys flagged as low (ignored). You set the 4, deploy clean.

**Multi-account confusion.** You manage personal and company Vercel/Supabase. `devassets identity company-app` shows `VERCEL_TOKEN → account: company-team` and `SUPABASE_URL → workspace: prod-ref`. You `--pin` both. Three weeks later you accidentally paste a personal token; the next `identity` run shows ⚠ MISMATCH before it ever reaches a deploy.

**Agent-driven.** In Claude Code: *"Check all my projects and tell me which ones have credential problems."* The agent calls `devassets_doctor` and `devassets_identity`, comes back with a ranked list.

---

## Requirements

- Node.js **22.5+** (uses built-in `node:sqlite`)

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
devassets add-project paperclip --path=~/projects/paperclip --type=saas

# 3. Scan environment files (records key names + detects missing vs .env.example)
devassets scan paperclip

# 4. Check deploy-readiness
devassets check paperclip --env=production

# 5. Resolve which account/workspace each token belongs to
devassets identity paperclip

# 6. Once verified correct, pin expected identities — future drift will warn
devassets identity paperclip --pin

# 7. See everything across all projects
devassets doctor
```

---

## Commands

| Command | Description |
|---|---|
| `devassets init` | Initialize database and signing key |
| `devassets add-project <name>` | Register a project |
| `devassets scan <project>` | Scan `.env` files; detect missing keys vs `.env.example` |
| `devassets check <project>` | Check asset health and risks |
| `devassets identity <project>` | Resolve token → account/workspace/project; `--pin` to lock expected |
| `devassets doctor` | Global health report across all projects; `--fix` to re-scan all |
| `devassets export <project>` | Export a signed (optionally encrypted) manifest |
| `devassets verify <project>` | Verify a manifest's signature |
| `devassets rotate <project> <key>` | Record rotation intent + instructions |
| `devassets audit <project>` | View audit log |
| `devassets ui` | Start web dashboard at localhost:9090 |
| `devassets serve` | Start MCP server (stdio) |
| `devassets install-skills` | Install Claude Code slash commands (`/devassets-check`, `/devassets-ci`) |

---

## Credential Identity (the headline feature)

`devassets identity <project>` reads each provider token **transiently**, asks the provider "who does this belong to?", and records only the answer.

```
Credential Identities — company-app

  ✓ VERCEL_TOKEN              (vercel)
      account:   ops@company.com
      workspace: company-team
  ⚠ NEXT_PUBLIC_SUPABASE_URL  (supabase)
      workspace: staging-ref-9921
      ⚠ MISMATCH: expected workspace=prod-ref-1188
  ✗ NEON_API_KEY             (neon)
      Neon API 401 — token invalid or expired
```

**Supported providers** (matched by env var name):

| Provider | Env var pattern | Resolves |
|---|---|---|
| Vercel | `VERCEL_TOKEN`, `VERCEL_API_TOKEN` | account email + teams |
| Supabase | `SUPABASE_ACCESS_TOKEN` / `SUPABASE_URL` | org + project refs (URL parsed offline) |
| Neon | `NEON_API_KEY` | account + projects |
| npm | `NPM_TOKEN`, `NODE_AUTH_TOKEN` | username |
| Google Cloud | `GOOGLE_APPLICATION_CREDENTIALS`, `GCP_SERVICE_ACCOUNT` | service account email + project_id (parsed offline) |
| Paddle / Stripe | `PADDLE_API_KEY` / `STRIPE_SECRET_KEY` | webhook + key status (via `check`) |

---

## `.devassets.yml` (optional, per project)

Zero-config works for most projects. Drop a `.devassets.yml` at the project root only when you need to be explicit:

```yaml
# Monorepo scan roots (else auto-detected from workspace manifest or discovery)
roots:
  - web
  - api

# Where each secret actually lives — so cloud/CI/runtime secrets aren't flagged "missing"
secrets:
  VERCEL_TOKEN: cloud-platform        # managed in the Vercel dashboard
  SUPABASE_SERVICE_ROLE_KEY: cloud-platform
  APPLE_PRIVATE_KEY: ci-secret        # GitHub Actions secret
  ANTHROPIC_API_KEY: runtime-user     # end-user provides at runtime
  PADDLE_CLIENT_TOKEN: source-public  # publishable, lives in source
  # unlisted keys default to local-env (normal missing-detection)
```

Locations: `local-env` (default) · `cloud-platform` · `ci-secret` · `runtime-user` · `source-public` · `external-vault`.
Non-`local-env` keys show as **managed** (☁) instead of missing — closing the "the token isn't local but that's correct" gap for desktop/mobile/cloud-deployed projects.

## Web Dashboard

```bash
devassets ui --port=9090   # http://localhost:9090 (bound to 127.0.0.1)
```

Per-project view: asset table, missing-key risks, payment platform status, and a **Credential Identities** panel showing account/workspace/project per token with mismatch warnings.

---

## MCP Integration (Claude Code / Cursor)

`.claude/settings.json`:

```json
{
  "mcpServers": {
    "devassets": { "command": "devassets", "args": ["serve"] }
  }
}
```

| Tool | Description |
|---|---|
| `devassets_list_projects` | List all projects and health status |
| `devassets_check` | Check a project's assets and risks |
| `devassets_scan` | Scan and update asset records |
| `devassets_identity` | Resolve token → account/workspace; detect mismatch |
| `devassets_export` | Export a signed manifest |
| `devassets_health` | Quick health summary across projects |
| `devassets_doctor` | Global health report |
| `devassets_audit` | Query audit log |
| `devassets_rotate` | Initiate key rotation |
| `devassets_add_project` | Register a new project |
| `devassets_ci_snippet` | Generate a GitHub Actions CI workflow |
| `devassets_skills` | Return installable Claude Code skills |

> *"Which projects have credential mismatches or missing production secrets?"*
> *"Resolve the accounts for all tokens in company-app."*

---

## Security Model

- **No secret values stored.** Key *names* and resolved *metadata* only.
- **Transient value reads.** `identity`/`check` read a token value in-memory to call the provider, then discard it. This is the single, deliberately-scoped exception to names-only — values are never written to disk or logs.
- **Signed exports.** HMAC-SHA256 with a local key (`~/.devassets/signature.key`, mode 600, atomically created).
- **Opt-in encryption.** AES-256-GCM, scrypt N=65536; password never persisted.
- **Local-only.** `~/.devassets/devassets.db` (SQLite). No cloud, no telemetry.
- **Dashboard is localhost-only** (127.0.0.1, CORS restricted).

---

## Local Storage

```
~/.devassets/
  devassets.db        Projects, assets, identities (metadata only), audit logs
  signature.key       32-byte HMAC signing key (chmod 600, auto-generated)
  permissions.yml     RBAC config
```

---

## License

MIT — part of [Hyphen Network](https://github.com/0xRyanlee).
