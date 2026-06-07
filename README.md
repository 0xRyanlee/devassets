# DevAssets - 开发资产管理系统

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

**一句话**: 为独立开发者设计的多项目开发资产统一管理系统。在一个地方统一管理 10+ 个项目的环境变量、API 接口、支付平台，支持智能导出和加密分享。

## 快速开始

### 安装

```bash
npm install -g @sparkie/devassets
```

### 初始化

```bash
# 首次使用，初始化本地数据库
devassets init

# 添加第一个项目
devassets add-project legita --path=~/projects/legita --type=saas
```

### 常用命令

```bash
# 扫描项目资产
devassets scan legita

# 检查项目状态
devassets check legita

# 导出清单（默认签名）
devassets export legita --env=production

# 导出并加密（给特定人）
devassets export legita --env=production --encrypt-for=devops@email.com

# 验证清单
devassets verify legita --manifest=./legita-production.manifest

# 轮换 API key
devassets rotate legita paddle --confirm

# 查看审计日志
devassets audit legita --since=7d

# 启动 Dashboard
devassets ui --port=9090
```

## 核心特性

### 1. 一览无遗的资产管理
```
devassets check legita
→ 一眼看到：
  ✅ 7 个资产已配置
  🟡 3 个警告（API key 年龄、webhook 未验证）
  🔴 2 个关键问题（缺失配置、过期证书）
```

### 2. 智能导出和加密
```bash
# Agent 自动判定最优导出方式
devassets export legita --env=production
→ 自动检查：
  - 是否有敏感信息？
  - 谁要用这个文件？
  - 需不需要加密？

# 可选：显式指定加密策略
devassets export legita --env=production --encrypt-for=devops@example.com
→ 用 DevOps 的公钥加密，只有他能解密
```

### 3. 无背景进程，事件驱动
不维护后台守护进程，而是在工作流中自动触发检查：

```bash
# Git hooks
devassets install-hooks
→ 提交前自动检查 (pre-commit)
→ 合并后自动扫描 (post-merge)

# 部署前验证
devassets check legita --fail-on-risk
# 返回退出码，用于 CI/CD 中断构建

# 手动触发
devassets verify legita --manifest=./legita-production.manifest
```

### 4. 完整的审计日志
```bash
devassets audit legita --since=30d
→ 谁什么时候：
  - 导出了什么清单
  - 轮换了什么 key
  - 验证了什么资产
  - 做了什么修改
```

### 5. Claude Code 集成
在 Claude Code 中自动可用的 Skills：

```typescript
// 检查项目状态
@devassets/check legita --format=markdown
→ Agent 看到状态，自动判定下一步

// 导出生产环境清单
@devassets/export legita --env=production
→ Skill 自动建议加密，Agent 确认对象

// 快速健康检查
@devassets/health legita --focus=payments
→ 支付平台状态一览

// 验证导出文件
@devassets/verify legita --manifest=./legita-production.manifest
→ 验证文件完整性和当前环境匹配度

// 轮换 API key
@devassets/rotate legita paddle
→ Skill 显示信息，要求确认后执行

// 查看操作历史
@devassets/audit legita --since=7d
→ 审计日志用于问题排查
```

## 工作流示例

### 场景 1: 晨间站会（独立开发者的自检）

```bash
$ devassets health --focus=all
→ 看到 12 个项目的一览表：
  Sparkie: ✅ (Paddle webhook ❌)
  Legita: ✅
  MyApp iOS: ⚠️ (Key 90 days old)
  ...
```

### 场景 2: 部署到生产

```bash
# 前置检查
$ devassets check legita --immediate
→ ✅ All configured, 🟡 2 warnings

# 生成部署清单
$ devassets export legita --env=production --format=checklist
→ production-checklist.md (可读的检查清单)

# 部署（CI 自动阻止有风险的部署）
$ git push
→ GitHub Actions 自动运行:
  devassets check legita --fail-on-risk
→ 如果有 critical issues，构建失败

# 部署后记录
audit log: "Ryan deployed legita to production"
```

### 场景 3: 排查 Webhook 问题

```bash
# Claude Code 问: "Legita 的 Paddle webhook 怎么了？"
# Agent 自动运行:
@devassets/health legita --focus=payments
→ Paddle Webhook: ⚠️ Signature verification failed

# Agent 建议修复步骤，最后验证:
@devassets/verify legita --webhook=paddle
→ ✅ Webhook restored
```

### 场景 4: 分享环境配置给 DevOps（未来团队场景）

```bash
# 导出（加密给 DevOps）
$ devassets export legita --env=production --encrypt-for=devops@company.com
→ legita-production.manifest.enc.devops

# DevOps 验证
$ devassets verify legita --manifest=legita-production.manifest.enc.devops
→ ✅ 他的 .env 符合清单
→ 🟡 3 个变量还没配置

# 后续同步：Git 中 commit 签名版本
$ git add legita-production.manifest
→ 任何人可以验证当前状态，自动 diff 变化
```

## 项目结构

```
devassets/
├── src/
│   ├── cli.ts                  # 命令行入口
│   ├── commands/               # 各命令实现
│   │   ├── scan.ts
│   │   ├── check.ts
│   │   ├── export.ts
│   │   ├── verify.ts
│   │   ├── rotate.ts
│   │   ├── audit.ts
│   │   └── ui.ts
│   ├── core/                   # 核心逻辑
│   │   ├── scanner.ts          # 资产扫描
│   │   ├── validator.ts        # 资产验证
│   │   ├── exporter.ts         # 清单导出
│   │   └── signer.ts           # 签名和加密
│   ├── integrations/           # 第三方集成
│   │   ├── paddle.ts           # Paddle API
│   │   ├── stripe.ts           # Stripe API（预留）
│   │   ├── apple-iap.ts        # Apple IAP（预留）
│   │   └── google-play.ts      # Google Play（预留）
│   ├── db/                     # 数据存储
│   │   ├── schema.ts           # Drizzle schema
│   │   └── index.ts            # 数据库连接
│   └── skills/                 # Claude Code Skills
│       ├── check.ts
│       ├── export.ts
│       ├── health.ts
│       ├── verify.ts
│       ├── rotate.ts
│       └── audit.ts
│
├── ui/                         # Dashboard 前端
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── hooks/
│   ├── package.json
│   └── vite.config.ts
│
├── package.json
├── tsconfig.json
└── README.md
```

## 数据安全

### 核心原则
- ✅ **不存明文 secret**：值永远在本地 `.env` 或外部 vault（Keychain / 1Password）
- ✅ **签名所有导出**：HMAC-SHA256 防篡改
- ✅ **可选加密**：对称加密（AES-256）或非对称加密（RSA）
- ✅ **完整审计日志**：谁什么时候导出/轮换了什么

### 加密策略
```
导出时自动判定：

development 环境？
  → 签名版本即可（开发机本地用）

production 环境？
  → 提示需要加密

指定了接收者？
  → 用接收者的公钥加密（对方能解密）

没指定接收者？
  → 用对称加密（需要分享密钥）
```

## 支持的支付平台

### 现在
- **Paddle**: 完整支持
  - API key 验证和年龄追踪
  - Webhook 注册验证
  - Signature secret 轮换

### 未来预留
- **Stripe**: 接口已预留
- **Apple IAP**: iOS 应用支持
- **Google Play**: Android 应用支持

## 配置文件

### `.devassets/config.yml`
```yaml
projects:
  - name: legita
    path: ~/projects/legita
    type: saas
    environments:
      - development
      - staging
      - production
    payment_platforms:
      - paddle
      - stripe
    watch_files:
      - .env
      - .env.local
      - .env.production

encryption:
  method: "aes-256-gcm"           # 对称加密方法
  signature_key_location: ~/.devassets/signature.key
```

### `.devassets/permissions.yml`（未来团队支持）
```yaml
project: legita
members:
  - name: "Ryan"
    role: "owner"
    can_see: ["*"]
    can_export: ["*"]
    can_rotate: ["*"]
  
  - name: "DevOps"
    role: "devops"
    can_see: ["api_keys", "webhooks", "payment_platforms"]
    can_rotate: ["api_keys", "webhook_secrets"]
```

## API 文档

详见 [SKILLS.md](./SKILLS.md) 了解所有 Skills 的完整定义。

## 贡献

欢迎提交 Issue 和 PR！

## License

MIT

---

## 快速链接

- [完整 PRD](./DevAssets_PRD.md)
- [Skills API 文档](./SKILLS.md)
- [开发指南](./DEVELOPMENT.md)
- [FAQ](./FAQ.md)
