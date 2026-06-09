# DevAssets Architecture

## Overview

```
devassets/
├── src/
│   ├── cli.ts                 Commander entry — 14 commands
│   ├── commands/              One file per CLI command
│   ├── core/                  scanner, validator, exporter, identity, roots, portfolio
│   ├── integrations/          paddle, stripe + providers/ (vercel, supabase, neon, npm, gcloud)
│   ├── db/                    node:sqlite schema + queries
│   ├── mcp/                   MCP server (12 tools) + skills loader
│   ├── types/                 assets, export, identity
│   └── utils/                 crypto, dotenv, constants (classifyKey), slug, spinner, logger
├── ui/                        React 18 + Vite + Tailwind + shadcn/ui dashboard
├── skills/                    Claude Code slash commands (devassets-check, devassets-ci)
├── tests/                     vitest unit + integration
└── docs/                      Design + research documents
```

## Runtime Stack

| Layer | Technology | Notes |
|---|---|---|
| CLI | Commander.js | `devassets <command>` |
| Language | TypeScript → ESM | Node 22.5+ |
| Database | `node:sqlite` (built-in) | no native compile; `~/.devassets/devassets.db` |
| MCP Server | `@modelcontextprotocol/sdk` | stdio transport |
| Dashboard Backend | Express.js (127.0.0.1 only) | serves UI + REST API |
| Dashboard Frontend | React 18 + Vite + Tailwind + shadcn/ui | compiled to `ui/dist/` |
| Signing | HMAC-SHA256 (`node:crypto`) | key at `~/.devassets/signature.key` (0600, atomic) |
| Encryption | AES-256-GCM (`node:crypto`) | scrypt N=65536 |

## Core pipeline

1. **roots** (`core/roots.ts`) — resolve scan roots: `.devassets.yml roots:` → workspace manifest → smart discovery (monorepo-aware).
2. **scanner** (`core/scanner.ts`) — per root, read env key *names* (configured) and `.env.example` declarations (missing); `.devassets.yml secrets:` → managed. Locations are scope-prefixed (`web/.env:8`).
3. **classification** (`utils/constants.ts classifyKey`) — Axis A: public / secret / identifier / config.
4. **validator** (`core/validator.ts`) — severity from sensitivity + environment + project form (Axis C); managed never risks.
5. **identity** (`core/identity.ts` + `integrations/providers/`) — transiently read token values across roots, resolve account/workspace/projects via provider APIs, store metadata (never the token); `--pin` baselines expected identity for mismatch detection.
6. **portfolio** (`core/portfolio.ts`) — inspect project, Git/GitHub, CI, and asset signals; write immutable run snapshots plus an atomically replaced current report.

## Classification model (3 axes)

- **A — sensitivity**: `classifyKey` (public prefix overrides; DATABASE_URL = secret; *_ID = identifier).
- **B — location**: `.devassets.yml secrets:` → local-env (default) / cloud-platform / ci-secret / runtime-user / source-public / external-vault. Non-local → `managed`.
- **C — form**: project `type` relaxes missing-secret severity for desktop/mobile/library.

## Data Storage (all local, no cloud)

```
~/.devassets/
  devassets.db        projects, assets, payment_platforms, credential_identities, audit_logs
  signature.key       32-byte HMAC signing key (chmod 600)
  permissions.yml     RBAC configuration
```

`credential_identities` stores resolved account/workspace/projects/validity + pinned expectations — **never token values**.

## MCP Tools (12)

`devassets_list_projects`, `devassets_check`, `devassets_scan`, `devassets_identity`,
`devassets_export`, `devassets_health`, `devassets_doctor`, `devassets_audit`,
`devassets_rotate`, `devassets_add_project`, `devassets_ci_snippet`, `devassets_skills`

## Security Invariants

1. **No secret values stored** — only key names, resolved metadata, and status.
2. **Transient value reads** — `identity`/`check` read a value in-memory to call a provider, then discard it (the single scoped exception); never written to disk or logs.
3. **All exports signed** — HMAC-SHA256 with local key.
4. **Encryption opt-in** — AES-256-GCM, password never stored.
5. **No network by default** — provider API calls only when `check`/`identity` are explicitly run. MCP tool invocations of `devassets_check` are treated as explicit invocations; agent-driven calls are equivalent to user-driven CLI calls under this invariant.
6. **Dashboard localhost-only** — 127.0.0.1 bind, CORS restricted.
