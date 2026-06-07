# DevAssets 开发快速开始指南

这份指南帮助 Claude Code 快速理解项目架构并开始开发。

---

## 项目概览

**DevAssets** = CLI 工具 + React Dashboard + MCP Server（AI 接口）

> **决策记录（2026-06-07）**
> - AI 接口：MCP Server（替代 Claude Code Plugin）— 详见 ARCHITECTURE.md
> - SQLite 实现：Node.js 内置 `node:sqlite`（替代 better-sqlite3，不需要原生编译，Node 22.5+）
> - Stripe/Apple IAP/Google Play：不实现（Paddle 完整，其他预留占位）
> - 扫描策略：全动态扫描，无预定义项目
> - npm scope：`@sparkie/devassets`

```
用户
  ├─ 本地开发
  │   ├─ devassets scan legita
  │   ├─ devassets check legita
  │   └─ devassets export legita --env=production
  │
  ├─ Dashboard UI
  │   ├─ devassets ui --port=9090
  │   └─ http://localhost:9090
  │
  └─ Claude Code（通过 MCP Server）
      ├─ devassets_check → project=legita
      ├─ devassets_export → project=legita
      └─ devassets_audit → project=legita

  配置: .claude/settings.json → mcpServers.devassets.command = "devassets serve"
```

---

## 代码结构

```
devassets/
│
├── package.json                 # 主项目配置
├── tsconfig.json                # TypeScript 配置
│
├── src/
│   ├── index.ts                 # 入口点
│   ├── cli.ts                   # Commander.js CLI 定义
│   │
│   ├── commands/                # 各命令实现
│   │   ├── scan.ts              ← 扫描资产
│   │   ├── check.ts             ← 检查状态
│   │   ├── export.ts            ← 导出清单（核心，支持加密）
│   │   ├── verify.ts            ← 验证清单
│   │   ├── rotate.ts            ← 轮换 API key
│   │   ├── audit.ts             ← 审计日志
│   │   └── ui.ts                ← 启动 Dashboard
│   │
│   ├── core/                    # 核心业务逻辑
│   │   ├── scanner.ts           ← 扫描逻辑（读 .env、检测 API）
│   │   ├── validator.ts         ← 验证逻辑（检查资产完整性）
│   │   ├── exporter.ts          ← 导出逻辑（YAML 生成）
│   │   ├── signer.ts            ← 签名和加密逻辑（最关键）
│   │   └── formatter.ts         ← 输出格式化（JSON、Markdown、YAML）
│   │
│   ├── integrations/            # 第三方 API 集成
│   │   ├── paddle.ts            ← Paddle webhook 验证、API key 检查
│   │   ├── stripe.ts            ← Stripe API（预留）
│   │   ├── apple-iap.ts         ← Apple IAP（预留）
│   │   └── google-play.ts       ← Google Play（预留）
│   │
│   ├── db/                      # 数据层
│   │   ├── schema.ts            ← Drizzle ORM schema 定义
│   │   ├── queries.ts           ← 数据库查询助手
│   │   └── index.ts             ← DB 连接和初始化
│   │
│   ├── skills/                  # Claude Code Skills
│   │   ├── check.ts             ← @devassets/check
│   │   ├── export.ts            ← @devassets/export
│   │   ├── health.ts            ← @devassets/health
│   │   ├── verify.ts            ← @devassets/verify
│   │   ├── rotate.ts            ← @devassets/rotate
│   │   └── audit.ts             ← @devassets/audit
│   │
│   ├── types/                   # TypeScript 类型定义
│   │   ├── assets.ts            ← Asset、PaymentPlatform、Asset 类型
│   │   ├── export.ts            ← ExportResult、ManifestFormat 类型
│   │   └── index.ts             ← 主导出文件
│   │
│   └── utils/                   # 工具函数
│       ├── logger.ts            ← 日志输出
│       ├── crypto.ts            ← 签名、加密、解密
│       ├── dotenv.ts            ← .env 文件解析（不读值，只读键名）
│       └── constants.ts         ← 常量定义
│
├── ui/                          # React Dashboard
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx             # 入口
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx     # 项目卡片列表
│   │   │   ├── ProjectDetail.tsx # 单项目详情
│   │   │   ├── PaymentOverview.tsx
│   │   │   ├── AuditLog.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/          # 可复用组件
│   │   ├── hooks/               # React hooks
│   │   └── styles/              # TailwindCSS
│   │
│   └── server.ts                # Express 后端（数据接口）

├── docs/
│   ├── PRD.md                   # 产品需求文档（完整功能定义）
│   ├── SKILLS.md                # Skills 详细设计
│   ├── API.md                   # API 文档
│   └── ARCHITECTURE.md          # 架构深潜

└── README.md                    # 项目说明
```

---

## 开发优先级（Week by Week）

### Week 1: 基础设施 + 数据模型
```
目标: 能扫描项目和存储结果

1. 初始化项目
   npm init -y
   npm install typescript ts-node @types/node
   npm install sqlite3 drizzle-orm
   npm install commander             # CLI 框架
   npm install dotenv yaml           # 文件解析

2. 定义数据类型 (src/types/assets.ts)
   - Asset interface
   - Project interface
   - PaymentPlatform interface
   - AuditLog interface

3. 数据库 schema (src/db/schema.ts)
   - 用 Drizzle ORM 定义表
   - 创建迁移脚本

4. 数据库初始化 (src/db/index.ts)
   - SQLite 连接
   - 自动建表

5. 简单 CLI (src/cli.ts)
   - devassets init
   - devassets add-project

完成指标:
  ✅ npm install 后能运行 devassets init
  ✅ 项目数据可存储和读取
```

### Week 2: 扫描和检查
```
目标: 能扫描 .env 文件和检查资产状态

1. 扫描逻辑 (src/core/scanner.ts)
   - 扫描 .env / .env.local / .env.* 文件
   - 提取变量名（不读值）
   - 检测支持的 API 服务（检查配置存在性）
   - 返回扫描结果

2. 扫描命令 (src/commands/scan.ts)
   - devassets scan <project>
   - 存储到数据库
   - 返回 JSON

3. 验证逻辑 (src/core/validator.ts)
   - 检查资产是否完整
   - 判定风险等级
   - 生成警告和建议

4. 检查命令 (src/commands/check.ts)
   - devassets check <project> [--env]
   - 支持 --format=json|markdown
   - 返回结构化结果

完成指标:
  ✅ devassets scan legita → 扫描 3 个 .env 文件，识别 20+ 变量
  ✅ devassets check legita → 显示状态、风险、建议
```

### Week 3: 支付平台 + 导出
```
目标: Paddle 集成完整，支持导出和签名

1. Paddle 集成 (src/integrations/paddle.ts)
   - Webhook 状态验证（HTTP 请求到 Paddle API）
   - API key 检查（验证格式、年龄）
   - Signature secret 管理

2. Signer/Encryptor (src/utils/crypto.ts)
   - HMAC-SHA256 签名
   - AES-256-GCM 对称加密（可选）
   - RSA 非对称加密（未来）

3. 导出逻辑 (src/core/exporter.ts)
   - 生成 YAML manifest
   - 生成 Checklist（Markdown）
   - 生成 Reference-only（纯变量名）
   - 添加签名
   - 可选加密

4. 导出命令 (src/commands/export.ts)
   - devassets export <project> --env=production
   - --format=manifest|checklist|reference-only
   - --encrypt / --encrypt-for=email
   - 保存文件或输出

完成指标:
  ✅ devassets export legita --env=production → 生成 signed manifest
  ✅ manifest 包含所有资产、Paddle webhook 状态、签名
  ✅ 可选加密支持
```

### Week 4: 验证 + RBAC + 审计
```
目标: 完整的验证流程、权限系统、审计日志

1. 验证逻辑 (src/core/validator.ts 扩展)
   - 验证 manifest 签名
   - 比对当前环境和 manifest
   - 解密（如果加密）

2. 验证命令 (src/commands/verify.ts)
   - devassets verify <project> --manifest=<path>
   - 验证签名、对比资产
   - 支持 Webhook 特殊验证

3. RBAC (src/core/permissions.ts - 新增)
   - 读取 .devassets/permissions.yml
   - 检查操作权限
   - 记录权限日志

4. 审计日志 (src/commands/audit.ts)
   - devassets audit <project> --since=7d
   - 记录所有操作（scan、export、rotate、verify）
   - 按用户、操作类型过滤

5. 轮换命令 (src/commands/rotate.ts)
   - devassets rotate <project> <key> --confirm
   - 要求用户确认
   - 记录 audit log
   - 处理 API key 更新（Paddle 等）

完成指标:
  ✅ 导出的 manifest 可以被验证
  ✅ 权限系统可以限制操作
  ✅ 审计日志完整记录所有操作
```

### Week 5: Skills + 自动判定
```
目标: 所有 6 个 Skills 可用，支持 Claude Code 调用

1. Skills 基础 (src/skills/)
   - 每个 skill 是一个 async function
   - 返回结构化结果
   - 包含自动判定逻辑

2. 6 个 Skills 实现
   - check.ts: @devassets/check
   - export.ts: @devassets/export (支持加密判定)
   - health.ts: @devassets/health
   - verify.ts: @devassets/verify
   - rotate.ts: @devassets/rotate
   - audit.ts: @devassets/audit

3. 自动判定逻辑（在 export skill 中最复杂）
   ```typescript
   // skill 看到 environment === "production" + encrypt undefined
   // → 自动建议加密
   
   // 看到有 critical risks
   // → 阻止导出，建议先修复
   
   // 看到 encrypt_for === undefined 但 encrypt === true
   // → 提示 agent: "Who should receive this?"
   ```

4. 发布到 npm
   - package.json 配置 "bin" 字段
   - 自动注册 skills

完成指标:
  ✅ npm install 后，Claude Code 自动发现 6 个 skills
  ✅ Agent 能调用 @devassets/check 等
  ✅ Export skill 支持加密判定
```

### Week 6: Dashboard 前端
```
目标: 完整的 React Dashboard，能查看和管理项目

1. React 项目初始化 (ui/)
   npm create vite@latest ui -- --template react-ts
   npm install shadcn/ui react-router-dom axios

2. 5 个页面
   - Dashboard: 项目卡片列表
   - ProjectDetail: 单项目详情（资产、webhooks、风险）
   - PaymentOverview: 支付平台聚合视图
   - AuditLog: 时间线
   - Settings: 权限管理

3. Express 后端 (src/commands/ui.ts)
   - GET /api/projects
   - GET /api/project/:id
   - GET /api/audit-log
   - POST /api/check/:id
   - POST /api/export/:id
   - POST /api/rotate/:id/:key

4. 样式 (shadcn/ui + TailwindCSS)
   - 响应式卡片
   - 状态指示（✅/🟡/🔴）
   - 操作按钮

完成指标:
  ✅ devassets ui --port=9090
  ✅ 打开 http://localhost:9090
  ✅ 看到 12 个项目的卡片
  ✅ 点击进入可看详情
```

### Week 7: 集成 + 文档 + 发布
```
目标: 完整可发布的产品

1. 集成测试
   - CLI 功能全覆盖
   - Skills 本地测试
   - Dashboard E2E 测试

2. 文档完善
   - README: 用户指南（已完成）
   - PRD: 功能定义（已完成）
   - SKILLS.md: API 文档（已完成）
   - DEVELOPMENT.md: 开发指南（本文件）

3. 发布
   - npm publish
   - GitHub release
   - 文档发布到网站

完成指标:
  ✅ npm install -g @sparkie/devassets
  ✅ 所有功能可用
  ✅ 文档完整
```

---

## 关键实现细节

### 1. 扫描逻辑（不读值）
```typescript
// scanner.ts 的核心

import dotenv from 'dotenv';
import fs from 'fs';

export function scanEnvFiles(projectPath: string): Asset[] {
  const envFiles = ['.env', '.env.local', '.env.production'];
  const assets: Asset[] = [];

  for (const file of envFiles) {
    const path = `${projectPath}/${file}`;
    if (!fs.existsSync(path)) continue;

    // ❌ 不要这样做（读值）
    // const env = dotenv.parse(fs.readFileSync(path, 'utf-8'));
    // assets.push({ name: key, value: env[key] }); // 危险！

    // ✅ 只读键名
    const content = fs.readFileSync(path, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=/);
      if (match) {
        assets.push({
          name: match[1],
          location: `${file}:${line_number}`,
          found: true,
          status: 'configured'
        });
      }
    }
  }

  return assets;
}
```

### 2. 签名逻辑
```typescript
// crypto.ts 的核心

import { createHmac } from 'crypto';
import fs from 'fs';
import path from 'path';

const SIGNATURE_KEY_PATH = path.join(
  process.env.HOME!,
  '.devassets/signature.key'
);

// 获取或生成签名密钥
export function getSignatureKey(): Buffer {
  if (!fs.existsSync(SIGNATURE_KEY_PATH)) {
    // 首次使用，生成密钥
    const key = crypto.randomBytes(32);
    fs.mkdirSync(path.dirname(SIGNATURE_KEY_PATH), { recursive: true });
    fs.writeFileSync(SIGNATURE_KEY_PATH, key);
    return key;
  }
  return fs.readFileSync(SIGNATURE_KEY_PATH);
}

// 签名 manifest
export function signManifest(content: string, timestamp: string): string {
  const key = getSignatureKey();
  return createHmac('sha256', key)
    .update(content + timestamp)
    .digest('hex');
}

// 验证签名
export function verifySignature(
  content: string,
  timestamp: string,
  signature: string
): boolean {
  const expected = signManifest(content, timestamp);
  return expected === signature;
}
```

### 3. 加密逻辑（可选）
```typescript
// crypto.ts 的加密部分

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// 对称加密（AES-256-GCM）
export function encryptAES(content: string, password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32); // 密钥派生
  const iv = randomBytes(16);

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(content, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // 格式: salt:iv:authTag:encrypted
  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

// 对称解密
export function decryptAES(encrypted: string, password: string): string {
  const [saltHex, ivHex, authTagHex, encryptedData] = encrypted.split(':');

  const salt = Buffer.from(saltHex, 'hex');
  const key = scryptSync(password, salt, 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### 4. Paddle Webhook 验证
```typescript
// integrations/paddle.ts

import axios from 'axios';

export async function verifyPaddleWebhook(
  projectId: string,
  apiKey: string
): Promise<WebhookStatus> {
  // 调用 Paddle API 获取 webhook 状态
  const response = await axios.get(
    'https://api.paddle.com/webhooks',
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    }
  );

  // 查找我们的 webhook URL
  const ourWebhook = response.data.data.find(
    w => w.url.includes('your-domain.com')
  );

  if (!ourWebhook) {
    return {
      registered: false,
      verified: false,
      last_delivery: null,
      failures_7d: 0
    };
  }

  return {
    registered: true,
    verified: ourWebhook.status === 'active',
    last_delivery: ourWebhook.last_delivery,
    failures_7d: ourWebhook.failures_7d
  };
}
```

---

## 常见实现陷阱

### ❌ 不要做的事

1. **存明文 secret**
   ```typescript
   // 错误
   Asset { value: "sk_live_abc123" }
   ```

2. **读取 .env 的值用于其他地方**
   ```typescript
   // 错误
   const env = dotenv.parse(content);
   exportToCloud(env); // 危险！
   ```

3. **在日志中输出 secret**
   ```typescript
   // 错误
   console.log(`Exporting key: ${secret}`);
   ```

4. **没有签名就导出**
   ```typescript
   // 错误
   fs.writeFileSync('manifest.yaml', content);
   ```

### ✅ 正确的做法

1. **只存元数据和 hash**
   ```typescript
   Asset {
     name: "PADDLE_API_KEY",
     location: ".env:5",
     found: true,
     hash: "abc123..." // 只存 hash，不存值
   }
   ```

2. **签名所有导出**
   ```typescript
   const signature = signManifest(yamlContent, timestamp);
   manifest.signature = signature;
   ```

3. **加密时只传 reference**
   ```typescript
   // 在清单中
   reference: "vault://paddle/api-key"
   // 真实值存在本地 Keychain 或 1Password
   ```

---

## 测试策略

### Unit Tests
```typescript
// test/core/signer.test.ts
import { signManifest, verifySignature } from '../src/utils/crypto';

describe('Signer', () => {
  it('should sign and verify manifest', () => {
    const content = 'test content';
    const timestamp = new Date().toISOString();
    const signature = signManifest(content, timestamp);
    
    expect(verifySignature(content, timestamp, signature)).toBe(true);
  });
  
  it('should reject tampered manifest', () => {
    const content = 'original content';
    const timestamp = new Date().toISOString();
    const signature = signManifest(content, timestamp);
    
    expect(verifySignature('tampered content', timestamp, signature)).toBe(false);
  });
});
```

### Integration Tests
```typescript
// test/e2e/export.test.ts
import { exportManifest } from '../src/core/exporter';

describe('Export Flow', () => {
  it('should export signed manifest', async () => {
    const result = await exportManifest('legita', 'production');
    
    expect(result.signature).toBeDefined();
    expect(result.content).toContain('SUPABASE_URL');
    expect(result.content).not.toContain('sk_live_'); // 不包含真实值
  });
});
```

---

## 调试技巧

### 启用详细日志
```bash
DEBUG=devassets:* devassets scan legita
```

### 检查数据库
```bash
sqlite3 ~/.devassets/devassets.db
sqlite> SELECT * FROM assets WHERE project_id = 'legita';
```

### 测试 Paddle 集成
```bash
export PADDLE_API_KEY=your_test_key
devassets check legita --debug
```

---

## 下一步

1. 阅读完整 PRD：[DevAssets_PRD.md](./DevAssets_PRD.md)
2. 了解 Skills 设计：[DevAssets_SKILLS.md](./DevAssets_SKILLS.md)
3. 开始 Week 1 的实现
4. 有问题随时查看这份指南

---

**祝开发顺利！** 🚀
