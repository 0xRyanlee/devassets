# DevAssets - 开发资产管理系统

> ⚠️ **此文件為 2025-06-07 的早期設計稿，已與現況架構脫節，僅供歷史參考，不代表當前實作。**
> 已知落差(2026-07-19 核對):DB 路徑寫的是 `~/.devasidecar/`(現況為 `~/.devassets/`)、
> ORM 寫的是 Drizzle(現況是 `node:sqlite` 手寫 queries)、Skills 章節描述的是完全不同設計的
> `@devassets/*` 介面(現況是 `src/mcp/server.ts` 的 18+ 個 MCP tools)。要了解現況架構請看
> `docs/ARCHITECTURE.md`；要了解實際指令/工具介面請看 `README.md`。

**PRD 版本**: 1.0  
**最后更新**: 2025-06-07  
**产品定位**: 独立开发者的多项目、多平台开发资产统一管理系统

---

## 1. 产品定义

### 核心价值
- **一目瞭然**: 10+ 个项目的环境变量、API 接口、支付平台状态一览无遗
- **智能导出**: 环境变量清单支持签名、加密，agent 自动判定最优策略
- **即时验证**: 开发工作流中（提交、部署、导出）自动触发资产检查，无背景进程
- **完整审计**: 谁什么时候导出、轮换、验证了什么，一切有迹可循

### 不做什么
- ❌ 不存储明文 secret value（值永远在本地或外部 vault）
- ❌ 不做完整的 secret vault（用 macOS Keychain / 1Password / GitHub Secrets）
- ❌ 不做后台守护进程（用事件驱动和手动触发）
- ❌ 不做云同步（所有数据本地存储）

---

## 2. 用户故事

### 用户
- **Ryan**: 独立开发者，10+ 个项目（桌面、Web、iOS、Android、SaaS）
- **用例时间表**: 日常开发、部署前检查、团队分享（未来）

### 场景 1: 晨间站会（自己）
```
时间: 每天上午 10 点
行为:
  - 打开 DevAssets Dashboard
  - 一眼看到 12 个项目的状态
  - Sparkie: Paddle webhook ❌（需要注册）
  - Legita: 所有 OK ✅
  - MyApp iOS: Paddle key 90 days old（建议轮换）
  
行动:
  - 点 [Verify Now] for Sparkie
  - 点 [Schedule Rotation] for MyApp iOS
```

### 场景 2: 部署到生产（自己做）
```
时间: 下午 3 点，部署新版本
前置检查:
  - 运行 devassets check legita --immediate
  - 返回: ✅ All production assets configured, 🟡 2 warnings
  
导出清单:
  - 需要在 Vercel 和 Paddle dashboard 中验证
  - 运行: devassets export legita --env=production --format=checklist
  - 返回: production-checklist.md（可读的）
  
部署:
  - 运行 GitHub Actions workflow
  - CI 自动调用 devassets check --fail-on-risk
  - 如果有风险，构建失败，阻止部署
  - 否则部署成功
  
部署后验证:
  - 自动记录 audit log: "Ryan deployed legita to production"
```

### 场景 3: Paddle webhook 失效排查
```
时间: 收到 webhook 失败告警
步骤:
  1. Claude Code 问: "Legita 的 Paddle webhook 怎么了？"
  
  2. Claude Code 调用:
     @devassets/health legita --focus=payments
     → Webhook last verified: 2h ago
     → Last delivery: failed (5 min ago)
     → Status: ⚠️  Signature verification failed
  
  3. Claude Code 提示修复步骤:
     - 检查 webhook secret 是否轮换过
     - 运行 devassets verify legita paddle-webhook --test
     - 如果失败，运行 devassets rotate legita paddle-webhook-secret --confirm
  
  4. 验证:
     @devassets/verify legita --webhook=paddle
     → ✅ Webhook restored
```

### 场景 4: 与 DevOps 共享环境配置（未来团队场景）
```
时间: 新的 DevOps 加入团队
步骤:
  1. Ryan 导出生产环境清单（加密给 DevOps）:
     devassets export legita --env=production --encrypt-for=devops@
     → legita-production.manifest.enc.devops
  
  2. Ryan 分享给 DevOps (邮件 / 1Password)
  
  3. DevOps 在他的机器上验证:
     devassets verify legita --manifest=legita-production.manifest.enc.devops
     → ✅ 他的 .env 符合清单
     → 🟡 3 个变量还没配置（手工去 Vercel Dashboard 设置）
  
  4. 后续同步:
     - Git 中 commit 签名版本（legita-production.manifest）
     - 任何人可以验证当前状态
     - 更新时自动 diff 显示变化
```

---

## 3. 功能范围

### 核心功能

#### 3.1 资产扫描 (Scan)
```
命令: devassets scan <project> [--deep]

扫描内容:
- 环境文件: .env, .env.local, .env.{stage}
- 环境变量: 找到所有的 KEY=VALUE 的名字（不读值）
- API 服务: Supabase, OpenAI, Vercel, Firebase 等 (检查配置)
- 支付平台: Paddle, Stripe, Apple IAP, Google Play (检查注册状态)
- Webhook: 验证注册、最后交付时间、失败次数

输出:
  扫描结果 → SQLite (Asset 表)
  扫描时间 → audit log
```

**数据模型**:
```typescript
Asset {
  id: string;
  project_id: string;
  
  // 资产信息
  type: "env_var" | "api_service" | "payment_platform" | "webhook" | "domain";
  name: string;
  service?: string;  // "Supabase", "Paddle", etc.
  
  // 位置信息（不存值）
  location: string;                    // ".env:5", "vault://", "1password://", etc.
  found: boolean;
  
  // 状态
  status: "configured" | "missing" | "empty" | "error";
  last_verified: DateTime;
  last_updated: DateTime;
  
  // 元数据
  age_days?: number;                   // API key 多少天前创建
  expiration_days?: number;            // 距离过期还有多少天
  
  // 风险标记
  risk_level: "🟢" | "🟡" | "🔴" | null;
  risk_message?: string;               // "Key is 120 days old, rotate in 30 days"
  
  // 关联资产
  related_assets?: string[];           // webhook secret, etc.
  
  created_at: DateTime;
}
```

#### 3.2 资产检查 (Check)
```
命令: devassets check <project> [--env=<env>] [--format=json|markdown]

检查内容:
- 所有资产是否配置完整
- 风险等级（API key 年龄、webhook 状态、失败次数）
- 与上次扫描的差异

输出:
  ✅/🟡/🔴 状态 + 详细报告
  
示例输出（Markdown）:
---
# Legita Status

## 🟢 Production Ready
- Supabase: ✅ (last verified 1h ago)
- OpenAI: ✅ (last verified 2h ago)
- Paddle: ✅ (webhook verified 10m ago)

## 🟡 Warnings
- Paddle API key is 90 days old (rotate in 60 days)
- Stripe webhook last verified 2h ago

## 🔴 Critical
- Google OAuth redirect URL: missing
- Production database: not configured

## Summary
2 critical issues, 2 warnings, 4 OK
Risk Level: Medium
Last Check: 2025-06-07 10:30 UTC
---

Exit Code:
  0 = all OK
  1 = warnings
  2 = critical
```

#### 3.3 资产导出 (Export)
```
命令: devassets export <project> --env=<env> [--format=manifest|checklist|reference-only] [--encrypt] [--encrypt-for=email]

三种导出格式:

1️⃣ Manifest (默认)
   - YAML 格式，签名版本，可读
   - 包含: 资产名称、位置、状态、年龄、风险
   - 用途: Git 提交、版本控制、Audit trail
   - 加密: --encrypt (AES-256) 或 --encrypt-for=email (RSA)

2️⃣ Checklist
   - Markdown 格式，给人看的
   - 包含: [ ] 变量名称, [ ] API 配置, [ ] Webhook 验证
   - 用途: 部署前手动检查、打印出来
   - 加密: 选项 (通常不加密，易于阅读)

3️⃣ Reference-Only
   - 纯变量名列表，不含任何状态信息
   - 包含: 变量名、预期位置 (e.g., ".env", "vault://")
   - 用途: CI/CD 的参考、公开分享
   - 加密: 通常不加密 (没啥敏感信息)

签名机制:
  - 所有导出文件都会被签名
  - HMAC-SHA256(content + timestamp)
  - 用本地密钥生成，防篡改

输出示例（Manifest YAML）:
---
project: legita
environment: production
exported_at: "2025-06-07T10:30:00Z"
exported_by: ryan
exported_from: ryan-macbook.local

variables:
  SUPABASE_URL:
    expected_in: .env
    found: true
    status: configured
    
  OPENAI_API_KEY:
    expected_in: .env.local
    found: false
    status: missing

api_services:
  - name: Supabase
    status: configured
    last_verified: "2025-06-07T10:00:00Z"
  - name: OpenAI
    status: configured
    last_verified: "2025-06-07T09:30:00Z"

payment_platforms:
  - name: paddle
    webhook_registered: true
    webhook_last_verified: "2025-06-07T10:25:00Z"
    api_key_age_days: 90
    risks:
      - "API key is 90 days old"

risks:
  - severity: "🟡"
    message: "OpenAI key not found in .env.local"

content_hash: "sha256:abc123..."
signature: "hmac-sha256:xyz789..."
```

#### 3.4 资产验证 (Verify)
```
命令: devassets verify <project> --manifest=<path> [--decrypt-key=<key>]

验证内容:
- manifest 的签名是否有效
- 当前本地环境是否符合 manifest 清单
- 变量是否都配置了（不检查值）

输出:
  ✅ Manifest signature valid
  ✅ All required variables configured
  🟡 2 optional variables missing
  
  Variables status:
  - SUPABASE_URL: ✅ found in .env
  - SUPABASE_ANON_KEY: ✅ found in .env
  - OPENAI_API_KEY: ❌ missing

用途:
  - CI/CD 部署前验证
  - 新环境初始化时的检查清单
  - 远程验证（不暴露值）
```

#### 3.5 API Key 轮换 (Rotate)
```
命令: devassets rotate <project> <key_name> [--confirm]

支持轮换的 key:
  - paddle
  - stripe
  - openai
  - 其他 API key

流程:
  1. 显示要轮换的 key 信息 (当前年龄、关联资产等)
  2. 要求用户确认 (--confirm 或交互式)
  3. 如果支持自动轮换 (via API)，自动执行
  4. 否则给出手动步骤
  5. 更新本地记录
  6. 记录 audit log

输出:
  ✅ Paddle API key rotated
  - Old key: sk_live_***... (will expire in 7 days)
  - New key: sk_live_***... (hash)
  - Updated in: .env
  - Audit: Recorded as "rotate paddle-api-key by ryan"
```

#### 3.6 审计日志 (Audit)
```
命令: devassets audit <project> [--since=24h] [--action=export|rotate|verify|scan] [--format=json|markdown]

记录的操作:
  - scan: 扫描项目资产
  - check: 检查资产状态
  - export: 导出清单
  - verify: 验证清单
  - rotate: 轮换 API key
  - import: 导入清单配置

输出:
  timestamp | action | user | details
  2025-06-07 10:30 | export | ryan | legita/production, format=manifest, encrypted
  2025-06-06 15:00 | rotate | ryan | legita/paddle-api-key
  2025-06-05 11:20 | check | claude | legita/all, format=json

用途:
  - 谁什么时候做了什么的完整记录
  - 合规审计（证明轮换历史等）
  - 问题排查（什么时候配置变了）
```

### UI/Dashboard 功能

#### 3.7 Web Dashboard
```
架构:
  - 后端: Express (Node.js)
  - 前端: React + Vite + shadcn/ui
  - 数据: SQLite (同 CLI)
  
启动:
  devassets ui [--port=9090]
  → http://localhost:9090

页面:

1️⃣ Dashboard (主页)
   - 项目卡片网格 (12 个项目)
   - 每个卡片显示:
     * 项目名 + 类型 (Desktop/Web/iOS/Android/SaaS)
     * 支付平台 (Paddle ✅, Stripe ⏳)
     * 关键资产状态 (3-5 最重要的)
     * 总体风险数 (🔴 critical, 🟡 warning, 🟢 ok)
     * [Details] [Re-check] [Export]

2️⃣ Project Detail
   - 完整的资产列表 (环境变量、API、支付平台)
   - Webhook 状态详情 (注册、最后交付、失败次数)
   - 环境映射 (dev vs staging vs production)
   - API key 年龄追踪
   - 风险面板
   - Quick actions: [Verify Now] [Rotate] [Export]

3️⃣ Payment Platforms Overview
   - Paddle 状态 (5 个项目)
   - Stripe 状态 (2 个项目)
   - Apple IAP 状态 (1 个项目)
   - Google Play 状态 (1 个项目)
   - 平台级别的快速操作

4️⃣ Audit Log Timeline
   - 时间线视图 (最近 30 天)
   - 每个操作的详情 (谁、什么、什么时候)
   - 可以按项目 / 操作类型过滤

5️⃣ Settings (配置)
   - 权限管理 (permissions.yml 编辑)
   - 加密密钥设置
   - GitHub/1Password 集成 (未来)
   - 导出备份
```

### Skills (Claude Code 集成)

#### 3.8 Skill: Check
```
@devassets/check
  project: "legita"
  environment?: "production"
  format?: "json" | "markdown"
  
⚙️  自动判定逻辑:
  - 检查返回的风险等级
  - 如果有 🔴 critical risks → 提醒加密导出
  - 返回结构化结果给 agent

用途:
  - 部署前检查
  - 导出前验证
  - Agent 决策参考
```

#### 3.9 Skill: Export
```
@devassets/export
  project: "legita"
  environment: "production"
  format?: "manifest" | "checklist" | "reference-only"
  encrypt?: boolean
  encrypt_for?: "email@example.com"
  reason?: "deploy to production"
  
⚙️  自动判定逻辑:
  - 如果 environment === "production" 且 encrypt 未指定
    → 建议加密，提示加密对象
  - 如果 encrypt === true 但 encrypt_for 未指定
    → 问 agent: "谁要用这个文件？"
  - 生成 manifest 并签名
  
返回:
  manifest content 或文件路径
  + 加密状态说明
```

#### 3.10 Skill: Health
```
@devassets/health
  project: "legita"
  focus?: "payments" | "apis" | "risks" | "all"
  
⚙️  快速健康检查:
  - 支付平台状态
  - API 服务健康度
  - 风险汇总
  
用途:
  - 晨间站会 (一眼看状态)
  - 问题排查 (哪个方面有问题)
```

#### 3.11 Skill: Verify
```
@devassets/verify
  project: "legita"
  manifest_path: "./legita-production.manifest"
  decrypt_key?: "..."
  
⚙️  自动判定:
  - 检测文件是否加密
  - 如果加密，提示需要密钥
  - 验证签名
  - 比对当前环境
  
用途:
  - 导出后验证
  - 新机器初始化时验证清单
```

#### 3.12 Skill: Rotate
```
@devassets/rotate
  project: "legita"
  key_name: "paddle" | "openai" | "stripe"
  confirm?: boolean
  
⚙️  安全流程:
  - 如果 confirm === false，显示摘要并要求确认
  - 执行轮换
  - 返回新 key hash（不是真实值）
  
用途:
  - Agent 提醒轮换时间到了
  - 代理执行轮换流程
```

#### 3.13 Skill: Audit
```
@devassets/audit
  project: "legita"
  since?: "24h" | "7d" | "30d"
  action?: "export" | "rotate" | "verify" | "scan"
  
用途:
  - 查看最近操作历史
  - 问题排查 (什么时候变的)
```

---

## 4. 技术规范

### 4.1 CLI 架构
```
devassets/
├── src/
│   ├── cli.ts              # 命令行入口
│   ├── commands/
│   │   ├── scan.ts
│   │   ├── check.ts
│   │   ├── export.ts
│   │   ├── verify.ts
│   │   ├── rotate.ts
│   │   ├── audit.ts
│   │   └── ui.ts
│   ├── core/
│   │   ├── scanner.ts      # 扫描逻辑
│   │   ├── validator.ts    # 验证逻辑
│   │   ├── exporter.ts     # 导出逻辑
│   │   └── signer.ts       # 签名逻辑
│   ├── integrations/
│   │   ├── paddle.ts       # Paddle API
│   │   ├── stripe.ts       # Stripe API
│   │   ├── apple-iap.ts    # Apple IAP
│   │   └── google-play.ts  # Google Play
│   ├── db/
│   │   ├── schema.ts       # Drizzle ORM schema
│   │   └── index.ts        # DB 连接
│   ├── types/
│   │   ├── assets.ts
│   │   ├── project.ts
│   │   └── export.ts
│   └── utils/
│       ├── logger.ts
│       ├── crypto.ts       # 签名、加密
│       └── formatters.ts   # 输出格式化

技术栈:
  - Node.js (>= 18)
  - TypeScript
  - SQLite + Drizzle ORM
  - Crypto (Node.js built-in)
  - Commander.js (CLI)
  - Axios (HTTP)
```

### 4.2 Dashboard 架构
```
ui/
├── src/
│   ├── main.tsx            # React 入口
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── ProjectDetail.tsx
│   │   ├── PaymentOverview.tsx
│   │   ├── AuditLog.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── ProjectCard.tsx
│   │   ├── AssetTable.tsx
│   │   ├── RisksPanel.tsx
│   │   ├── WebhookStatus.tsx
│   │   └── AuditTimeline.tsx
│   ├── hooks/
│   │   ├── useProjects.ts
│   │   ├── useAssets.ts
│   │   └── useAudit.ts
│   └── styles/
│       └── globals.css

技术栈:
  - React 18
  - TypeScript
  - Vite
  - shadcn/ui
  - TailwindCSS
  - React Router

API Endpoints (Express):
  GET  /api/projects
  GET  /api/project/:id
  GET  /api/audit-log
  POST /api/check/:id
  POST /api/verify/:id
  POST /api/export/:id
  POST /api/rotate/:id/:key
```

### 4.3 数据存储
```
SQLite 数据库位置:
  macOS: ~/.devasidecar/devassets.db
  
表结构:

1. Project
   - id: string (PK)
   - name: string
   - type: enum (desktop|web|ios|android|saas|api|internal)
   - path: string
   - repo_url?: string
   - created_at: DateTime
   - updated_at: DateTime

2. Asset
   - id: string (PK)
   - project_id: string (FK → Project)
   - type: enum (env_var|api_service|payment|webhook)
   - name: string
   - service?: string
   - location: string
   - found: boolean
   - status: enum (configured|missing|empty|error)
   - age_days?: number
   - expiration_days?: number
   - risk_level?: enum (🔴|🟡|🟢)
   - risk_message?: string
   - last_verified: DateTime
   - created_at: DateTime

3. PaymentPlatform
   - id: string (PK)
   - project_id: string (FK)
   - type: enum (paddle|stripe|apple_iap|google_play)
   - api_key_hash?: string
   - api_key_age_days?: number
   - api_key_expires_in_days?: number
   - webhook_url?: string
   - webhook_registered: boolean
   - webhook_last_verified: DateTime
   - webhook_last_delivery?: DateTime
   - webhook_failures_7d: number
   - risks: string[] (JSON)
   - last_verified: DateTime

4. Environment
   - id: string (PK)
   - project_id: string (FK)
   - name: enum (development|staging|production|ci|local)
   - variables: string[] (JSON, 变量名列表)
   - created_at: DateTime
   - updated_at: DateTime

5. AuditLog
   - id: string (PK)
   - project_id?: string (FK)
   - action: enum (scan|check|export|verify|rotate)
   - user: string ($USER)
   - timestamp: DateTime
   - details: JSON
   - status: enum (success|failed)
```

### 4.4 加密方案

**签名 (总是做)**:
```typescript
import { createHmac } from 'crypto';

const secret = fs.readFileSync(
  path.join(process.env.HOME, '.devasidecar/signature.key')
);

const content = YAML.stringify(manifest);
const signature = createHmac('sha256', secret)
  .update(content + timestamp)
  .digest('hex');

manifest.signature = signature;
```

**对称加密 (--encrypt)**:
```typescript
import { createCipheriv, randomBytes } from 'crypto';

const key = crypto.scryptSync(password, 'salt', 32);
const iv = randomBytes(16);
const cipher = createCipheriv('aes-256-gcm', key, iv);

let encrypted = cipher.update(content, 'utf8', 'hex');
encrypted += cipher.final('hex');

const authTag = cipher.getAuthTag().toString('hex');
// 存储: iv + authTag + encrypted
```

**非对称加密 (--encrypt-for=email)**:
```typescript
import { publicEncrypt, privateDecrypt } from 'crypto';

// 生成密钥对
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// 加密 AES 密钥（用接收者的公钥）
const encryptedAesKey = publicEncrypt(
  { key: recipientPublicKey },
  Buffer.from(aesKey)
);

// 内容用 AES 加密，密钥用 RSA 加密
// 存储: encryptedAesKey + encryptedContent
```

---

## 5. 实现时间线（7 周）

### Week 1: 数据模型 + CLI 核心
- [ ] Drizzle ORM schema 定义
- [ ] SQLite 初始化脚本
- [ ] CLI 框架（Commander.js）
- [ ] scan / check 命令实现
- [ ] 输出格式化

### Week 2: 资产导出 + 签名
- [ ] export 命令实现
- [ ] YAML 格式生成
- [ ] 签名生成和验证
- [ ] 多环境支持

### Week 3: 支付平台集成
- [ ] Paddle API 集成
- [ ] Webhook 状态验证
- [ ] API key 年龄追踪
- [ ] Stripe 预留接口
- [ ] iOS/Android 预留接口

### Week 4: 完整 CLI 功能
- [ ] verify / rotate 命令
- [ ] RBAC 基础 (permissions.yml)
- [ ] 加密支持 (对称 + 非对称)
- [ ] audit 命令
- [ ] Git hooks 集成

### Week 5: Skills 设计 + 测试
- [ ] 6 个 Skills 实现
- [ ] Agent 自动判定逻辑
- [ ] 本地测试

### Week 6: Dashboard 前端
- [ ] React 项目初始化
- [ ] 5 个页面实现
- [ ] Express 后端 API 实现
- [ ] 样式 (shadcn/ui + TailwindCSS)

### Week 7: 集成 + 文档
- [ ] CLI + Dashboard 集成
- [ ] E2E 测试
- [ ] README + API 文档
- [ ] 发布到 npm

---

## 6. 成功指标

- ✅ CLI 能完整扫描 12 个项目
- ✅ Dashboard 一屏显示所有项目状态
- ✅ export 支持签名 + 加密，agent 自动判定
- ✅ 0 个 secret value 泄露的风险
- ✅ 完整的 audit log（谁什么时候做了什么）
- ✅ 6 个 Skills 可用，Claude Code 能自主判定加密策略

---

## 7. 未来扩展

- [ ] 远程同步 (HTTP gateway，用于团队协作)
- [ ] macOS Keychain 集成
- [ ] 1Password CLI 集成
- [ ] GitHub Actions 官方 plugin
- [ ] Slack 通知集成
- [ ] Google Play / Apple IAP 的完整支持
- [ ] 多租户支持 (商业化)
