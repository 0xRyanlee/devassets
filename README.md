# DevAssets

**The local-first secrets manager and credential command center for independent developers.**

Store your API keys and env vars encrypted on your machine. Manage them across 10+ projects from one CLI. Know exactly which account every token belongs to, what's missing before you deploy, and inject secrets directly into commands — no cloud, no account, no telemetry.

[![npm](https://img.shields.io/npm/v/@hyphen-network/devassets)](https://www.npmjs.com/package/@hyphen-network/devassets)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.5.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

```bash
npm install -g @hyphen-network/devassets
```

---

> **中文** · **日本語** · **Français** · **Italiano** — [see multilingual intro below](#multilingual)

---

## The Problem

You run multiple projects. Each has its own `.env`, its own Vercel project, Supabase org, Neon database, GCP service account, LLM provider keys, and payment secrets. The friction is constant:

- *"Which `.env.example` key did I forget before this deploy?"*
- *"Is this `VERCEL_TOKEN` for my personal account or the company team?"*
- *"This `SUPABASE_URL` — is it staging or prod?"*
- *"Where did I store the production `DATABASE_URL` for that side project I haven't touched in six months?"*
- *"Did I rotate that key after the incident, or just mean to?"*

These cause real incidents: a missing secret 500s production, a token from the wrong workspace silently writes to the wrong database, an expired key fails a deploy at 2am.

**DevAssets gives you one encrypted local vault plus a full credential map — for every project, from one CLI.**

---

## What DevAssets Does

### Encrypted Local Vault

Store secret values with AES-256-GCM encryption. Each value gets a unique IV. The vault key is derived from your local signing key via HKDF — no separate password to remember, no key file to manage.

```bash
devassets set myapp DATABASE_URL          # hidden prompt, no shell history
devassets set myapp STRIPE_SK sk_live_…  --provider=stripe
devassets get myapp DATABASE_URL          # decrypt to stdout
devassets run myapp -- npm run migrate    # inject all secrets into a command
devassets list myapp                      # key names + metadata, never values
```

### Credential Identity Resolution

Ask every provider "who does this token belong to?" and pin the answer. Get warned the next time a token drifts to the wrong account or workspace.

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

### Deploy-Gate Health Checks

Scan `.env` files, compare against `.env.example`, and block deploys when required secrets are missing.

```bash
devassets check myapp --env=production --fail-on-risk
# exits 1 if any secrets are missing or mismatched — safe for CI
```

### Full Audit Trail

Every `get`, `set`, `rotate`, and `inject` is logged with timestamp and key name.

---

## Before / After

| Scenario | Without DevAssets | With DevAssets |
|---|---|---|
| Deploy with a required key unset | 500 in production | `check --fail-on-risk` blocks it, names the key |
| Token from the wrong account | Silent data corruption | `identity` flags ⚠ MISMATCH before deploy |
| "Where's the production DB URL?" | Search `.env` files across 10 repos | `get myapp DATABASE_URL` |
| Onboarding a 6-month-old project | Cross-check every service manually | `scan` + `identity` maps it in seconds |
| "Did I rotate that key?" | Search Slack / memory | `audit` shows every rotation with timestamp |
| Share deploy checklist | Paste secrets in chat (unsafe) | `export --encrypt` — signed, encrypted, names-only |

---

## Quick Start

```bash
# 1. Initialize (creates ~/.devassets/ — keep this off cloud sync)
devassets init

# 2. Register your project
devassets add-project myapp --path=~/projects/myapp --type=saas

# 3. Scan .env files and detect missing keys vs .env.example
devassets scan myapp

# 4. Store secrets in the encrypted vault
devassets set myapp DATABASE_URL          # prompts with hidden input
devassets set myapp STRIPE_SECRET_KEY sk_live_… --provider=stripe

# 4b. Store account-level credentials once (shared across all projects)
devassets set _global VERCEL_TOKEN --provider=vercel
devassets set _global ANTHROPIC_API_KEY --provider=anthropic

# 5. Check deploy-readiness
devassets check myapp --env=production

# 6. Resolve which account/workspace each token belongs to
devassets identity myapp --pin            # pin as expected baseline

# 7. Inject secrets into a command
devassets run myapp -- npm run migrate

# 8. See everything across all projects
devassets doctor
```

---

## Commands

### Vault — encrypted secret storage

| Command | Description |
|---|---|
| `devassets set <project> <key> [value]` | Encrypt and store a project-scoped secret (prompts if value omitted) |
| `devassets set _global <key> [value]` | Store an account-level credential shared across all projects |
| `devassets get <project> <key>` | Decrypt and print a value; `--raw` skips trailing newline |
| `devassets get _global <key>` | Retrieve a global credential |
| `devassets list <project>` | List stored key names and metadata — **values never shown** |
| `devassets list _global` | List all account-level credentials |
| `devassets unset <project> <key>` | Delete a stored secret |
| `devassets inject <project>` | Load secrets into shell env; `--print` outputs `export` statements |
| `devassets run <project> -- <cmd>` | Run a command with secrets injected |

#### Global credentials (`_global` scope)

Some credentials belong to your account, not a specific project: `VERCEL_TOKEN`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `NPM_TOKEN`. Store them once under the reserved `_global` project and they become accessible from any project.

```bash
# Store once — no project context needed
devassets set _global VERCEL_TOKEN --provider=vercel --account=you@example.com
devassets set _global ANTHROPIC_API_KEY --provider=anthropic
devassets set _global GITHUB_TOKEN --provider=github

# Read from any project context
devassets get _global VERCEL_TOKEN

# List all account-level credentials
devassets list _global
```

When you call `devassets get <project> <key>` for a project-specific key and it's not found, DevAssets automatically checks `_global` before falling back to other projects. The response includes `scope: "global"` or `scope: "project"` so you know where it came from.

> `_global` is a reserved project ID — `devassets add-project` will reject it.

### Credential management

| Command | Description |
|---|---|
| `devassets scan <project>` | Scan `.env` files; detect missing keys vs `.env.example` |
| `devassets check <project>` | Check asset health; `--fail-on-risk` for CI |
| `devassets identity <project>` | Resolve token → account/workspace; `--pin` to lock expected |
| `devassets rotate <project> <key>` | Record rotation intent + instructions |
| `devassets audit <project>` | View audit log |
| `devassets export <project>` | Export a signed (optionally AES-encrypted) manifest |
| `devassets verify <project>` | Verify a manifest's signature |

### Workspace & tooling

| Command | Description |
|---|---|
| `devassets init` | Initialize database and signing key |
| `devassets add-project <name>` | Register a project |
| `devassets doctor` | Global health report across all projects; `--fix` to re-scan |
| `devassets portfolio` | Point-in-time snapshot of all projects under a root |
| `devassets ui` | Start web dashboard at localhost:9090 |
| `devassets serve` | Start MCP server (stdio) for Claude Code / Cursor |
| `devassets status` | Compact overview of all projects — vault, assets, identity, age |
| `devassets install-skills` | Install Claude Code slash commands |

---

## Vault — Security Design

DevAssets stores secrets locally on your machine with no external service involved.

- **AES-256-GCM** encryption per secret value — each with a unique 12-byte random IV
- **HKDF-SHA256** key derivation from your local signing key — no separate vault password
- **Values never logged or exported** — `list`, `audit`, and `export` show key names and metadata only
- **Agent (MCP) access is metadata-only** by default — reading a value requires an explicit `get` or `inject` call
- **Cross-project sharing is always explicit** — no automatic propagation between projects

> **Security warning:** `~/.devassets/signature.key` is the root of all vault encryption. If this file leaks (iCloud Drive, Time Machine, dotfiles repo), every secret you have ever stored can be decrypted. **Required:** exclude `~/.devassets/` from iCloud Drive, Time Machine, and any dotfiles `.gitignore`. Loss of `signature.key` means all stored secrets are permanently unrecoverable. `devassets init` prints step-by-step exclusion instructions.

---

## Credential Identity Resolution

`devassets identity <project>` reads each provider token transiently, calls the provider's identity API, and records only the result — never the token value.

**Supported providers** (matched by env var name):

| Provider | Env var pattern | Resolves |
|---|---|---|
| Vercel | `VERCEL_TOKEN`, `VERCEL_API_TOKEN` | account email + teams |
| Supabase | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_URL` | org + project ref (URL parsed offline) |
| Neon | `NEON_API_KEY` | account + projects |
| npm | `NPM_TOKEN`, `NODE_AUTH_TOKEN` | username |
| Google Cloud | `GOOGLE_APPLICATION_CREDENTIALS`, `GCP_SERVICE_ACCOUNT` | service account email + project (parsed offline) |
| Stripe / Paddle | `STRIPE_SECRET_KEY`, `PADDLE_API_KEY` | key status + webhook check |

Pin the expected account/workspace with `--pin`. Every subsequent `identity` run compares against the pin and warns on drift.

---

## `.devassets.yml` (optional, per project)

Zero-config works out of the box. Add this file only when you need explicit control:

```yaml
# Monorepo scan roots
roots:
  - web
  - api

# Where each secret actually lives — prevents cloud/CI keys from being flagged "missing"
secrets:
  VERCEL_TOKEN: cloud-platform        # managed in Vercel dashboard
  SUPABASE_SERVICE_ROLE_KEY: cloud-platform
  APPLE_PRIVATE_KEY: ci-secret        # GitHub Actions secret
  ANTHROPIC_API_KEY: runtime-user     # end-user provides at runtime
  PADDLE_CLIENT_TOKEN: source-public  # publishable, lives in source
```

Locations: `local-env` (default) · `cloud-platform` · `ci-secret` · `runtime-user` · `source-public` · `external-vault`

Non-`local-env` keys show as **managed** (☁) instead of missing.

---

## MCP Integration (Claude Code / Cursor)

Use DevAssets as an MCP server so your AI agent can query credential health and manage assets directly.

`.claude/settings.json`:
```json
{
  "mcpServers": {
    "devassets": { "command": "devassets", "args": ["serve"] }
  }
}
```

Available MCP tools:

**Project health & scanning**
`devassets_list_projects` · `devassets_check` · `devassets_scan` · `devassets_health` · `devassets_doctor`

**Credential management**
`devassets_identity` · `devassets_rotate` · `devassets_audit` · `devassets_export` · `devassets_add_project`

**Vault — secret retrieval (agent routing)**
| Tool | When to use |
|---|---|
| `devassets_get_global_secret(key, env)` | Account-level credentials: `VERCEL_TOKEN`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `NPM_TOKEN` |
| `devassets_set_global_secret(key, value, env)` | Store an account-level credential (once, shared across all projects) |
| `devassets_get_secret(project, key, env)` | Project-specific credentials: `DATABASE_URL`, `PADDLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `devassets_list_secrets(project, env, scope)` | List keys; use `project="_global"` or `scope="global"` for account-level |
| `devassets_find_secret(key, env, scope)` | Discover where a key is stored; `scope` filter narrows to global or project |

**Tooling**
`devassets_ci_snippet` · `devassets_skills`

> *"Check all my projects and tell me which ones have missing production secrets."*
> *"Get the VERCEL_TOKEN for this deploy."* → routes to `devassets_get_global_secret`
> *"What account does this SUPABASE_SERVICE_ROLE_KEY belong to?"* → `devassets_identity`

**Claude Code skills** (`devassets install-skills`): installs `/devassets-check` and `/devassets-ci` slash commands locally.

---

## Web Dashboard (optional, not bundled)

The web UI is intentionally excluded from the npm package to keep the CLI lean. If you want a browser-based view, build it locally from source:

```bash
git clone https://github.com/0xRyanlee/devassets
cd devassets && npm install
npm run build:ui        # builds ui/dist/
npm run build           # builds CLI
node dist/index.js serve  # MCP mode, or add your own ui server
```

For day-to-day use, `devassets status` gives a full terminal overview without a browser.

---

## Requirements & Installation

- **Node.js 22.5+** (uses built-in `node:sqlite` — no native compilation)

```bash
npm install -g @hyphen-network/devassets
devassets init
```

---

## Local Storage

```
~/.devassets/
  devassets.db      Projects, assets, identities, audit logs, encrypted vault
  signature.key     32-byte signing key (chmod 600, auto-generated)
  permissions.yml   RBAC config
```

All data stays on your machine. No cloud sync, no account, no telemetry.

---

## License

MIT — part of [Hyphen Network](https://github.com/0xRyanlee).

---

<a name="multilingual"></a>

## 多語言介紹 / Multilingual Introduction

---

### 中文 (Traditional Chinese)

**DevAssets 是獨立開發者的本地加密環境變數管理器。**

你同時維護多個專案，每個都有自己的 `.env`、Vercel 專案、Supabase 資料庫、API 金鑰和支付 secret。每次部署前你都要手動核對一遍，總有漏掉的；token 是哪個帳號的記不清楚；staging 和 production 的金鑰容易貼錯。

DevAssets 用一個 CLI 解決這些問題：

- **本地加密保存 secret 值**（AES-256-GCM），不上雲、不需要帳號
- **`devassets run myapp -- npm run migrate`** — 自動注入 secret 到子命令，不經過 shell 歷史記錄
- **`devassets identity myapp`** — 自動解析每個 token 屬於哪個帳號，偵測 staging/prod 帳號混用
- **`devassets check myapp --fail-on-risk`** — 部署前阻擋缺少的必要 secret，適合 CI 使用
- **MCP 整合** — Claude Code / Cursor agent 可直接查詢憑證健康狀態

```bash
npm install -g @hyphen-network/devassets
devassets init
devassets set myapp DATABASE_URL   # 隱藏輸入，不進 shell history
devassets run myapp -- npm run migrate
```

---

### 日本語 (Japanese)

**DevAssets は、インディー開発者向けのローカル暗号化シークレットマネージャーです。**

複数のプロジェクトを管理していると、`.env` ファイル、Vercel トークン、Supabase の接続文字列、Stripe キー、GCP サービスアカウントがプロジェクトごとにバラバラに存在します。どのトークンがどのアカウントに属しているか把握できなくなり、ステージング環境のキーを本番にうっかり貼り付けてしまうことも。

DevAssets はこれを解決します：

- **AES-256-GCM でシークレット値をローカル暗号化保存** — クラウド不要、アカウント不要
- **`devassets run myapp -- node server.js`** — シークレットをサブコマンドに直接注入（シェル履歴に残らない）
- **`devassets identity myapp`** — 各トークンがどのアカウント/ワークスペースに属するか自動解決。ステージング/本番の混在を検知
- **`devassets check myapp --fail-on-risk`** — デプロイ前に必須シークレットの欠如をブロック（CI対応）
- **MCP サーバー** — Claude Code / Cursor からエージェントが直接クレデンシャルを管理

```bash
npm install -g @hyphen-network/devassets
devassets init
devassets set myapp DATABASE_URL   # 非表示入力、履歴に残らない
devassets run myapp -- npm run migrate
```

---

### Français (French)

**DevAssets est un gestionnaire de secrets local et chiffré pour les développeurs indépendants.**

Vous gérez plusieurs projets, chacun avec ses propres variables d'environnement, tokens Vercel, connexions Supabase, clés Stripe et comptes Google Cloud. Vous ne savez plus quel token appartient à quel compte, et vous risquez de mélanger les environnements staging et production.

DevAssets résout ces problèmes :

- **Stockage chiffré local des valeurs secrètes** (AES-256-GCM) — aucun cloud, aucun compte requis
- **`devassets run myapp -- npm run migrate`** — injecte les secrets dans les sous-commandes sans passer par l'historique du shell
- **`devassets identity myapp`** — résout automatiquement à quel compte/espace de travail appartient chaque token. Détecte les mélanges staging/production
- **`devassets check myapp --fail-on-risk`** — bloque les déploiements si des secrets requis sont manquants (intégration CI)
- **Serveur MCP** — les agents Claude Code / Cursor peuvent interroger directement l'état des identifiants

```bash
npm install -g @hyphen-network/devassets
devassets init
devassets set myapp DATABASE_URL   # saisie masquée, pas d'historique shell
devassets run myapp -- npm run migrate
```

---

### Italiano (Italian)

**DevAssets è un gestore di segreti locale e cifrato per sviluppatori indipendenti.**

Gestisci più progetti, ognuno con le proprie variabili d'ambiente, token Vercel, connessioni Supabase, chiavi Stripe e account Google Cloud. Non ricordi più a quale account appartiene ogni token, e rischi di confondere le chiavi di staging con quelle di produzione.

DevAssets risolve questi problemi:

- **Archiviazione cifrata locale dei valori segreti** (AES-256-GCM) — nessun cloud, nessun account necessario
- **`devassets run myapp -- npm run migrate`** — inietta i segreti nei sottocomandi senza passare per la cronologia della shell
- **`devassets identity myapp`** — risolve automaticamente a quale account/workspace appartiene ogni token. Rileva confusioni tra staging e produzione
- **`devassets check myapp --fail-on-risk`** — blocca i deploy se mancano segreti richiesti (integrabile in CI)
- **Server MCP** — gli agenti Claude Code / Cursor possono interrogare direttamente lo stato delle credenziali

```bash
npm install -g @hyphen-network/devassets
devassets init
devassets set myapp DATABASE_URL   # input nascosto, nessuna traccia nella shell
devassets run myapp -- npm run migrate
```
