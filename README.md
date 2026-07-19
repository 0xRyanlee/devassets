# DevAssets

**The local-first secrets manager and credential command center for independent developers.**

Store your API keys and env vars encrypted on your machine. Manage them across 10+ projects from one CLI. Know exactly which account every token belongs to, what's missing before you deploy, and inject secrets directly into commands — no cloud, no account, no telemetry.

[![npm](https://img.shields.io/npm/v/@hyphen-network/devassets)](https://www.npmjs.com/package/@hyphen-network/devassets)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.5.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Free & open source. MIT license. No subscription. No cloud. No account. No telemetry.**

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

## Who Is DevAssets For?

**Independent developers and small teams managing 5–20+ projects.** If you are a solo founder, freelancer, or indie dev who:

- Maintains multiple SaaS projects, side projects, and client work simultaneously
- Has accumulated dozens of API keys across Vercel, Supabase, Neon, Stripe, Paddle, GCP, LLM providers
- Uses AI coding tools (Claude Code, Cursor, Copilot) and wants your agent to reason about credential state
- Wants the security guarantees of a vault without the cost and complexity of a cloud secrets manager

DevAssets is **not** designed for:
- Centrally-managed enterprise credential rotation (use HashiCorp Vault or AWS Secrets Manager)
- Shared team vaults with SSO/SCIM (use 1Password Teams or Doppler)

---

## DevAssets vs. Alternatives

Most secrets tools are either cloud-based (Doppler, 1Password) or offer no security at all (direnv, plain `.env`). DevAssets occupies a different position: **fully local + identity-aware + AI-native**.

| | DevAssets | 1Password CLI | Doppler | direnv | Infisical |
|---|---|---|---|---|---|
| Storage | Local SQLite | Cloud vault | Cloud | `.envrc` files | Cloud / self-hosted |
| Encryption | AES-256-GCM per value | AES-256 | AES-256 | **None** | AES-256 |
| Account required | **No** | Yes | Yes | No | Yes |
| Monthly cost | **Free** | $3–8/user | $0–10+/project | Free | Free OSS |
| Identity resolution | **✓ (unique)** | ✗ | ✗ | ✗ | ✗ |
| Multi-project health | **✓** | ✗ | Partial | ✗ | Partial |
| AI agent / MCP | **Native** | ✗ | ✗ | ✗ | ✗ |
| Telemetry | **Zero** | Vendor | Vendor | Zero | Vendor |

**Identity resolution** (`devassets identity`) is unique in this category. No other tool asks "which account and workspace does this token actually belong to?" — and warns when it drifts. This catches the silent class of incident where a staging token was used in production, or a personal token was used on a company workspace.

**MCP integration** means your AI coding agent can check credential health, retrieve secrets, and detect missing keys — without you ever switching context to a terminal.

---

## Pricing

**DevAssets is free.** No trial, no freemium gate, no subscription required.

It is MIT-licensed open source, part of [Hyphen Network](https://github.com/0xRyanlee). The source is on GitHub. All data stays on your machine — there is no service to pay for.

If DevAssets saves you from a production incident, consider [starring the repo](https://github.com/0xRyanlee/devassets).

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

#### Choosing project vs. global — the default is project scope

**Project scope is the default. `_global` is the deliberate exception**, reserved for
credentials that authenticate to a shared *account or platform* — not credentials that
*are* one application's own identity or data. In a typical multi-project setup, most
secrets in any given project are correctly project-scoped; only a handful are ever
truly account-level.

The test: would this exact value still be valid if you pasted it into a brand-new,
unrelated project tomorrow?

- **Yes → `_global`**: `VERCEL_TOKEN`, `NPM_TOKEN`, `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`,
  `OPENAI_API_KEY`, `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, an R2 access key pair,
  a Paddle seller API key, a Supabase account management token. These authenticate
  *you* to a platform; the platform doesn't care which project is asking.
- **No → project scope (the default)**: a database connection string, a JWT/session
  signing secret, an app's Tauri/Android signing key, an OAuth client ID/secret
  registered for one app's specific redirect URI, a webhook secret bound to one
  endpoint (`PADDLE_WEBHOOK_SECRET` is *not* the same kind of thing as
  `PADDLE_API_KEY` — same provider, different scope). These are the application's own
  identity or data; a different project has no legitimate use for the same value.

**Why this matters more than it looks like it should:** `get`/`inject`/`run` fall back
to `_global` automatically. A project-specific secret stored under `_global` by
mistake becomes silently readable from *every other project* the next time one of
them calls `inject` or `run` — a signing key or session secret leaking across
unrelated applications is a real security incident, not a hypothetical. `devassets
set` prints an advisory hint in both directions (recommending `_global` for a
recognized account-level key stored under a project; warning when a per-application
pattern is stored under `_global`) — it never blocks the write, because the heuristic
can't see your actual architecture, only the key's name.

#### File & signing credentials

DevAssets stores not just string tokens but also **file-type secrets**: `.p8` private keys, Android keystores, GCP service-account JSON, SSH keys, and any other file whose content needs to stay out of your repository and off cloud sync.

```bash
# Store a file — DevAssets auto-detects binary vs. text
devassets set myapp APPLE_NOTARY_KEY --file ~/AuthKey_ABCD1234EF.p8
devassets set myapp GCP_SA_KEY       --file ~/service-account.json
devassets set myapp ANDROID_KEYSTORE --file ~/release.jks
devassets set myapp SSH_DEPLOY_KEY   --file ~/.ssh/id_ed25519

# Materialize back to a file at 0600 permissions
devassets get myapp APPLE_NOTARY_KEY --out /tmp/AuthKey.p8
devassets get myapp ANDROID_KEYSTORE --out ~/build/release.jks
```

Binary files are stored as base64 and decoded transparently on `--out`. Text files (JSON, PEM, etc.) round-trip as UTF-8. `devassets list` tags file-type secrets with `[file]` or `[file/bin]`.

**Apple signing credentials** are identity-resolved by format when stored:

| Key name | What DevAssets resolves |
|---|---|
| `APPLE_KEY_ID` | Validates 10-char alphanumeric format |
| `APPLE_ISSUER_ID` | Validates UUID format |
| `APPLE_TEAM_ID` | Validates 10-char format; stored as workspace |
| `APPLE_API_KEY`, `APPLE_NOTARY_KEY`, `APPLE_PRIVATE_KEY_P8` | Validates PEM/base64-PEM; if `APPLE_KEY_ID` + `APPLE_ISSUER_ID` are present, makes a readonly App Store Connect API call to confirm the key is active |

```bash
# Store Apple credentials (set APPLE_KEY_ID and APPLE_ISSUER_ID first for API validation)
devassets set myapp APPLE_KEY_ID    ABCD1234EF
devassets set myapp APPLE_ISSUER_ID 12345678-1234-1234-1234-1234567890ab
devassets set myapp APPLE_TEAM_ID   TEAM123456
devassets set myapp APPLE_NOTARY_KEY --file ~/AuthKey_ABCD1234EF.p8

# Confirm the key is active
devassets identity myapp
```

> **Security note:** materialized files are written with `chmod 0600`. DevAssets never logs or transmits private key content — only identity metadata (key ID, team ID) is recorded.

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
| `devassets import` | Batch-register every subdirectory under `--root` as a project (onboarding an existing multi-project setup) |
| `devassets delete-project <project>` | Remove a project and its vault secrets; `--force` to skip confirmation (CI) |
| `devassets doctor` | Global health report across all projects; `--fix` to re-scan |
| `devassets portfolio` | Point-in-time snapshot of all projects under a root |
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
- **Auto-update notification** — DevAssets checks the npm registry for newer versions at startup (cached 24h, non-blocking, TTY-only — silent in CI pipelines). If a security patch is available, you'll see a one-line stderr notice.
- **CI-aware** — spinner, interactive prompts, and update notifications are all suppressed in CI environments (`CI`, `GITHUB_ACTIONS`, `GITLAB_CI`, etc.)

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
| Apple | `APPLE_KEY_ID`, `APPLE_ISSUER_ID`, `APPLE_TEAM_ID`, `APPLE_*_KEY*` | format validation offline; `.p8` keys optionally validated against App Store Connect API (readonly) |

Pin the expected account/workspace with `--pin`. Every subsequent `identity` run compares against the pin and warns on drift.

Stripe and Paddle keys aren't resolved by `identity` — their key status and webhook health are checked by `devassets check` instead.

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

DevAssets is the only secrets manager designed from day one for AI agents. Install it as an MCP server and your agent can check deploy-readiness, retrieve secrets, and detect identity drift — without you ever opening a terminal.

```
You:    "Is myapp ready to deploy to production?"
Agent:  devassets_check(myapp, env=production)
        → STRIPE_WEBHOOK_SECRET missing [high]
        → NEON_API_KEY expired [critical]
        → Blocking deploy. Fix these 2 issues first.
```

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
`devassets_list_projects` · `devassets_resolve_project` · `devassets_check` · `devassets_scan` · `devassets_health` · `devassets_doctor`

**Credential management**
`devassets_identity` · `devassets_rotate` · `devassets_audit` · `devassets_export` · `devassets_add_project`

**Vault — secret retrieval (agent routing)**
| Tool | When to use |
|---|---|
| `devassets_get_global_secret(key, env)` | Account-level credentials: `VERCEL_TOKEN`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `NPM_TOKEN`, `PADDLE_API_KEY`, `CLOUDFLARE_API_TOKEN` |
| `devassets_set_global_secret(key, value, env)` | Store an account-level credential (once, shared across all projects) — see [Choosing project vs. global](#choosing-project-vs-global--the-default-is-project-scope) before defaulting here |
| `devassets_get_secret(project, key, env)` | Project-specific credentials: `DATABASE_URL`, `PADDLE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, signing keys |
| `devassets_set_secret(project, key, value, env)` | Store a project-scoped secret — see [Choosing project vs. global](#choosing-project-vs-global--the-default-is-project-scope) before defaulting here |
| `devassets_list_secrets(project, env, scope)` | List keys; use `project="_global"` or `scope="global"` for account-level |
| `devassets_find_secret(key, env, scope)` | Discover where a key is stored; `scope` filter narrows to global or project |

**Tooling**
`devassets_ci_snippet` · `devassets_skills`

> *"Check all my projects and tell me which ones have missing production secrets."*
> *"Get the VERCEL_TOKEN for this deploy."* → routes to `devassets_get_global_secret`
> *"What account does this SUPABASE_SERVICE_ROLE_KEY belong to?"* → `devassets_identity`

**Claude Code skills** (`devassets install-skills`): installs `/devassets-check` and `/devassets-ci` slash commands locally.

---

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

**DevAssets 是獨立開發者的本地加密憑證指揮中心。**

你同時維護多個專案，每個都有自己的 `.env`、Vercel 專案、Supabase 資料庫、API 金鑰和支付 secret。每次部署前你都要手動核對一遍，總有漏掉的；token 是哪個帳號的記不清楚；staging 和 production 的金鑰容易貼錯；AI coding agent 問你要哪個 key，你還要自己去翻 `.env` 貼給它。

DevAssets 用一個 CLI 解決這些問題：

- **本地加密保存 secret 值**（AES-256-GCM），不上雲、不需要帳號、**MIT 免費**
- **`devassets run myapp -- npm run migrate`** — 自動注入 secret 到子命令，不經過 shell 歷史記錄
- **`devassets identity myapp`** — 自動解析每個 token 屬於哪個帳號，偵測 staging/prod 帳號混用（業界唯一）
- **`devassets check myapp --fail-on-risk`** — 部署前阻擋缺少的必要 secret，適合 CI 使用
- **檔案/簽名型憑證** — `set --file` 儲存 `.p8`、Android keystore、GCP JSON、SSH key；`get --out` 還原為 0600 檔案；Apple 金鑰格式驗證 + App Store Connect 唯讀確認
- **MCP 整合（AI-native）** — Claude Code / Cursor agent 可直接查詢憑證健康狀態，無需切換 terminal

**vs. 競品：** Doppler 和 1Password CLI 需要帳號和月費，data 存在對方的雲端。direnv 無加密。Infisical 需要自架 server。DevAssets 是唯一零雲依賴 + 身份解析 + MCP 原生的選項。

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
- **ファイル型シークレット** — `set --file` で `.p8`・Android キーストア・GCP JSON・SSH 鍵を保管；`get --out` でパーミッション 0600 のファイルとして復元；Apple 鍵はフォーマット検証 + App Store Connect 読み取り専用確認
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
- **Secrets de type fichier** — `set --file` stocke les clés `.p8`, keystores Android, JSON GCP, clés SSH ; `get --out` les matérialise en fichiers 0600 ; les clés Apple sont validées par format + confirmation App Store Connect en lecture seule
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
- **Segreti di tipo file** — `set --file` archivia chiavi `.p8`, keystore Android, JSON GCP, chiavi SSH; `get --out` li materializza come file con permessi 0600; le chiavi Apple vengono validate per formato + conferma App Store Connect in sola lettura
- **Server MCP** — gli agenti Claude Code / Cursor possono interrogare direttamente lo stato delle credenziali

```bash
npm install -g @hyphen-network/devassets
devassets init
devassets set myapp DATABASE_URL   # input nascosto, nessuna traccia nella shell
devassets run myapp -- npm run migrate
```
