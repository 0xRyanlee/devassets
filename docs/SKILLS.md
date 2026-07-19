# DevAssets Skills 设计文档

> ⚠️ **此文件為早期設計稿，已與現況架構脫節，僅供歷史參考，不代表當前實作。**
> 描述的 `@devassets/check|export|health|verify|rotate|audit` 六個 Skill 與其 TypeScript
> interface，在現行 `src/mcp/server.ts` 找不到對應實作——現況是 18+ 個 `devassets_*` MCP
> tools，設計方式完全不同。要看實際可用的工具清單請讀 `README.md` 的「MCP Integration」章節，
> 或直接讀 `src/mcp/server.ts`。

**目的**: 定义所有 Claude Code 可调用的 Skills，包括参数、返回值、自动判定逻辑。

---

## 总体设计原则

1. **Agent 自主判定**：Skill 返回足够的信息，让 Agent 自己决定下一步
2. **加密策略自动化**：根据上下文自动判定是否需要加密，但给 Agent 最终决定权
3. **即时反馈**：所有操作都有明确的成功/失败信息和审计记录
4. **安全优先**：任何涉及 secret 的操作都有额外的确认步骤

---

## Skill 列表

### 1. @devassets/check
**用途**: 检查项目资产状态，智能判定风险等级

#### 参数
```typescript
interface CheckParams {
  project: string;              // 项目名称（必须）
  environment?: string;         // 环境（可选）: "development" | "staging" | "production"
  format?: string;              // 输出格式（可选）: "markdown" | "json"
}
```

#### 返回值
```typescript
interface CheckResult {
  project: string;
  environment?: string;
  timestamp: string;            // ISO 8601
  
  // 总体状态
  status: "healthy" | "warning" | "critical";
  
  // 资产汇总
  assets: {
    total: number;
    configured: number;
    missing: number;
    errors: number;
  };
  
  // 分类状态
  categories: {
    environment_variables: AssetStatus[];
    api_services: AssetStatus[];
    payment_platforms: PaymentStatus[];
    webhooks: WebhookStatus[];
  };
  
  // 风险汇总
  risks: RiskItem[];
  
  // 建议
  suggestions?: string[];
}

interface AssetStatus {
  name: string;
  status: "✅" | "⚠️" | "❌";
  message?: string;
  age_days?: number;
}

interface PaymentStatus extends AssetStatus {
  webhook_registered?: boolean;
  webhook_verified?: boolean;
  api_key_age_days?: number;
}

interface RiskItem {
  severity: "🔴" | "🟡" | "🟢";
  message: string;
  suggestion?: string;
}
```

#### 自动判定逻辑
```typescript
// 当 Agent 调用 @devassets/check legita
if (result.status === "critical") {
  console.log("⚠️  Critical issues detected!");
  console.log("Recommendation: Use signed export + encryption for safety");
}

if (result.categories.payment_platforms.some(p => !p.webhook_verified)) {
  console.log("🟡 Payment webhooks need verification");
  console.log("Next: Run @devassets/verify legita --webhook");
}

if (result.risks.some(r => r.severity === "🔴")) {
  console.log("🔴 Critical issue detected!");
  console.log("This must be fixed before production deployment");
}
```

#### 使用示例
```typescript
// 基础检查
const result = await skills["devassets/check"]({ project: "legita" });

// 指定环境
const prodResult = await skills["devassets/check"]({
  project: "legita",
  environment: "production",
  format: "markdown"
});

// Agent 自主决策
if (result.status === "critical") {
  // 提醒用户立即修复
  console.log("🔴 Must fix before proceeding");
} else if (result.status === "warning") {
  // 询问是否继续
  const proceed = await askUser("Continue with warnings?");
}
```

---

### 2. @devassets/export
**用途**: 导出项目资产清单（支持签名、加密、多格式）

#### 参数
```typescript
interface ExportParams {
  project: string;              // 项目名称（必须）
  environment: string;          // 环境（必须）: "development" | "staging" | "production"
  format?: string;              // 格式（可选）: "manifest" | "checklist" | "reference-only"
  encrypt?: boolean;            // 是否加密（可选）
  encrypt_for?: string;         // 加密给谁（可选）: email or "self"
  reason?: string;              // 导出原因（可选）: 用于审计日志
  output?: string;              // 输出文件路径（可选）
}
```

#### 返回值
```typescript
interface ExportResult {
  project: string;
  environment: string;
  format: "manifest" | "checklist" | "reference-only";
  
  // 文件信息
  file_path?: string;           // 如果生成了文件
  content?: string;             // 如果返回内容
  size_bytes: number;
  
  // 加密信息
  encrypted: boolean;
  encryption_method?: string;   // "aes-256-gcm" | "rsa-2048"
  encrypted_for?: string;       // 加密对象
  
  // 签名
  signature: string;            // HMAC-SHA256
  signature_valid: boolean;
  
  // 清单摘要
  summary: {
    total_variables: number;
    configured: number;
    missing: number;
    risks: RiskCount;
  };
  
  // 导出前的自动判定结果
  recommendations?: string[];
  
  // 审计
  audit_id: string;             // 用于追踪这次导出
}

interface RiskCount {
  critical: number;
  warning: number;
  ok: number;
}
```

#### 自动判定逻辑
```typescript
// Agent 调用: @devassets/export legita --env=production

// Step 1: 检查环境
if (environment === "production") {
  // 生产环境，默认建议加密
  if (!encrypt && !encrypt_for) {
    console.log("ℹ️  Production environment detected");
    console.log("Recommendation: Add --encrypt-for=recipient@email.com for security");
  }
}

// Step 2: 检查风险
if (summary.risks.critical > 0) {
  console.log("🔴 Critical issues in manifest!");
  console.log("Fix these before exporting to production");
  return; // 阻止导出
}

// Step 3: 加密判定
if (encrypt === undefined) {
  if (environment === "production") {
    // 自动建议加密
    if (encrypt_for) {
      // 知道对象，自动用非对称加密
      console.log(`✅ Will encrypt for ${encrypt_for}`);
    } else {
      // 不知道对象，询问 Agent
      console.log("🔒 Who should receive this manifest?");
      console.log("Add --encrypt-for=email@example.com");
    }
  } else if (format === "reference-only") {
    // reference-only 不需要加密（没敏感信息）
    console.log("ℹ️  Reference-only format, signature is sufficient");
  }
}

// Step 4: 返回信息
return {
  ...result,
  recommendations: [
    "✅ Manifest signed with HMAC-SHA256",
    encrypt ? `🔒 Encrypted for ${encrypt_for}` : "ℹ️  Not encrypted",
    "📋 Ready to share / commit"
  ]
};
```

#### 格式说明

**manifest** (默认)
- YAML 格式，可读
- 包含所有资产信息（名称、位置、状态、年龄、风险）
- 支持加密
- 用途: Git 提交、版本控制、Audit trail

**checklist**
- Markdown 格式，给人看
- [ ] 任务清单形式
- 部署前手工核对用
- 通常不加密（易读性重要）

**reference-only**
- 纯变量名列表
- 无状态信息
- 公开分享用
- 通常不加密（没敏感信息）

#### 使用示例
```typescript
// 1. 简单导出（dev 环境）
const result = await skills["devassets/export"]({
  project: "legita",
  environment: "development"
});
// → manifest (YAML, 签名), 保存到本地

// 2. 生产环境导出给 DevOps
const result = await skills["devassets/export"]({
  project: "legita",
  environment: "production",
  encrypt_for: "devops@company.com",
  reason: "pre-deployment verification"
});
// → manifest (加密, RSA), 可以安全分享

// 3. 部署前检查清单
const result = await skills["devassets/export"]({
  project: "legita",
  environment: "production",
  format: "checklist"
});
// → Markdown 清单，打印出来手工核对

// 4. 公开分享 reference
const result = await skills["devassets/export"]({
  project: "legita",
  environment: "production",
  format: "reference-only"
});
// → 变量名列表，可以 commit 到 GitHub
```

---

### 3. @devassets/health
**用途**: 快速健康检查，聚焦特定类别

#### 参数
```typescript
interface HealthParams {
  project: string;              // 项目名称（必须）
  focus?: string;               // 聚焦类别: "payments" | "apis" | "risks" | "all"
}
```

#### 返回值
```typescript
interface HealthResult {
  project: string;
  focus: "payments" | "apis" | "risks" | "all";
  timestamp: string;
  
  // 总体评分 0-100
  health_score: number;         // 90+ 绿色，70-89 黄色，<70 红色
  
  // 分类健康度
  payments?: {
    platforms: {
      name: string;
      status: "🟢" | "🟡" | "🔴";
      webhook_registered: boolean;
      webhook_verified: boolean;
      webhook_failures_7d: number;
      api_key_age_days?: number;
    }[];
    overall: "🟢" | "🟡" | "🔴";
  };
  
  apis?: {
    services: {
      name: string;
      status: "🟢" | "🟡" | "🔴";
      last_verified: string;
      error?: string;
    }[];
    overall: "🟢" | "🟡" | "🔴";
  };
  
  risks?: {
    critical: string[];
    warnings: string[];
    ok: number;
  };
}
```

#### 使用示例
```typescript
// 晨间站会：快速看支付状态
const payment_health = await skills["devassets/health"]({
  project: "legita",
  focus: "payments"
});

// 输出
console.log(`
🟢 Paddle: Webhook OK, Key 90d old (rotate in 60d)
🟡 Stripe: Webhook last verified 2h ago
   Last delivery failed 30m ago (investigating)

Overall: 🟡 Warning - Stripe needs attention
`);

// Agent 自动判定下一步
if (payment_health.overall === "🔴") {
  // 立即提醒
  console.log("⚠️  Payment integrations broken!");
  console.log("Next: Run @devassets/verify legita --webhook=paddle");
}
```

---

### 4. @devassets/verify
**用途**: 验证导出的清单，检查当前环境是否符合

#### 参数
```typescript
interface VerifyParams {
  project: string;              // 项目名称（必须）
  manifest_path: string;        // 清单文件路径（必须）
  decrypt_key?: string;         // 解密密钥（可选，如果清单加密）
  webhook?: string;             // 验证特定的 webhook（可选）: "paddle" | "stripe"
}
```

#### 返回值
```typescript
interface VerifyResult {
  project: string;
  manifest_path: string;
  
  // 清单验证
  manifest_valid: boolean;
  signature_valid: boolean;
  signature_timestamp: string;
  encrypted: boolean;
  decrypted: boolean;
  
  // 内容对比
  comparison: {
    total_assets: number;
    found: number;
    missing: number;
    mismatched: number;
  };
  
  // 详细差异
  assets: {
    name: string;
    expected_in: string;
    found: boolean;
    status: "✅" | "⚠️" | "❌";
    notes?: string;
  }[];
  
  // Webhook 验证（如果指定）
  webhook_status?: {
    registered: boolean;
    verified: boolean;
    last_delivery: string;
    failures_7d: number;
  };
  
  // 总体评分
  match_percentage: number;      // 100 = 完全匹配，0 = 无匹配
  
  // 建议
  recommendations?: string[];
}
```

#### 使用示例
```typescript
// 导出后验证
const export_result = await skills["devassets/export"]({
  project: "legita",
  environment: "production"
});

const verify_result = await skills["devassets/verify"]({
  project: "legita",
  manifest_path: export_result.file_path
});

// 输出
console.log(`
✅ Manifest signature valid
✅ All 12 assets found and configured
⚠️  3 warnings:
   - OPENAI_API_KEY in .env (should be .env.local)
   - PADDLE_WEBHOOK_SECRET differs (might be OK if recently rotated)

Match: 100%
Status: ✅ Ready for deployment
`);

// 验证特定 webhook
const webhook_verify = await skills["devassets/verify"]({
  project: "legita",
  manifest_path: "./legita-production.manifest",
  webhook: "paddle"
});

// 输出
console.log(`
Paddle Webhook
✅ Registered in Paddle dashboard
✅ Last delivery: 5 min ago
✅ Signature validation: pass
⚠️  Consider rotating signature secret (45 days old)
`);
```

---

### 5. @devassets/rotate
**用途**: 轮换 API key，需要用户确认

#### 参数
```typescript
interface RotateParams {
  project: string;              // 项目名称（必须）
  key_name: string;             // Key 类型（必须）: "paddle" | "openai" | "stripe"
  confirm?: boolean;            // 是否已确认（可选，默认 false）
}
```

#### 返回值
```typescript
interface RotateResult {
  project: string;
  key_name: string;
  
  // 轮换前信息
  old_key: {
    age_days: number;
    last_rotated: string;
    location: string;
  };
  
  // 轮换流程
  status: "pending_confirmation" | "rotating" | "success" | "failed";
  
  // 轮换后信息
  new_key?: {
    hash: string;               // 不是真实值，是 hash
    created_at: string;
    updated_location: string;
  };
  
  // 建议
  next_steps?: string[];
  
  // 审计
  audit_id: string;
}
```

#### 使用示例
```typescript
// Step 1: Agent 提醒轮换
console.log("🟡 Paddle API key is 90 days old");
console.log("Recommendation: Rotate in next 30 days");

// Step 2: 用户决定轮换
const result = await skills["devassets/rotate"]({
  project: "legita",
  key_name: "paddle"
});

// 返回摘要（不显示真实值）
console.log(`
⚠️  About to rotate Paddle API key for legita
- Old key: Created 90 days ago
- Current location: .env
- This action will:
  1. Generate new key in Paddle
  2. Update .env.local
  3. Keep old key for 7 days (grace period)

Type "yes" to confirm:
`);

// Step 3: 确认后执行
const confirm_result = await skills["devassets/rotate"]({
  project: "legita",
  key_name: "paddle",
  confirm: true
});

// 返回成功
console.log(`
✅ Paddle API key rotated successfully
- New key: sk_live_*** (hash: abc123...)
- Old key expires in: 7 days
- Location: ~/.env.local
- Next rotation recommended: 90 days later

⚠️  Remember to:
1. Restart your app (if using old key from memory)
2. Verify webhooks still work: @devassets/verify legita --webhook=paddle
`);
```

---

### 6. @devassets/audit
**用途**: 查看操作审计日志，用于问题排查和合规

#### 参数
```typescript
interface AuditParams {
  project: string;              // 项目名称（必须）
  since?: string;               // 时间范围: "24h" | "7d" | "30d" | "90d"
  action?: string;              // 过滤操作: "export" | "rotate" | "verify" | "scan" | "check"
}
```

#### 返回值
```typescript
interface AuditResult {
  project: string;
  since: string;
  filter: string;
  
  // 操作列表
  entries: AuditEntry[];
  
  // 统计
  total: number;
  by_action: Record<string, number>;
  by_user: Record<string, number>;
}

interface AuditEntry {
  timestamp: string;            // ISO 8601
  action: string;
  user: string;
  details: {
    reason?: string;
    export_format?: string;
    encrypted?: boolean;
    webhook_verified?: boolean;
    asset_count?: number;
    risks_found?: number;
  };
  status: "success" | "failed";
  error?: string;
}
```

#### 使用示例
```typescript
// 最近 7 天发生了什么
const audit = await skills["devassets/audit"]({
  project: "legita",
  since: "7d"
});

console.log(`
Audit Log (Last 7 days)

2025-06-07 10:30  export  ryan    production manifest, encrypted for devops@
2025-06-06 15:00  rotate  ryan    paddle-api-key
2025-06-05 14:00  verify  claude  legita-production.manifest ✅
2025-06-04 09:00  scan    ryan    Scanned 3 .env files
2025-06-03 11:20  check   claude  environment check, 2 warnings

Summary:
- Total operations: 5
- Exports: 1
- Rotations: 1
- Verifications: 1
- Scans: 1
- Checks: 1
`);

// 特定操作的历史
const rotation_history = await skills["devassets/audit"]({
  project: "legita",
  action: "rotate"
});

console.log(`
Paddle API Key Rotation History
2025-06-06 15:00  rotate  ryan    paddle-api-key ✅
2025-05-07 10:00  rotate  ryan    paddle-api-key ✅
2025-04-07 08:30  rotate  ryan    paddle-api-key ✅

Last rotation: 31 days ago
Next recommended: 59 days from now
`);
```

---

## Skill 调用示例（综合场景）

### 场景：部署前的完整检查流程

```typescript
// Agent 接收用户请求: "我要部署 Legita 到生产环境"

// Step 1: 检查资产状态
console.log("🔍 Checking production readiness...");
const check = await skills["devassets/check"]({
  project: "legita",
  environment: "production"
});

if (check.status === "critical") {
  console.log("❌ Critical issues found. Fix before deploying:");
  check.risks.forEach(r => {
    if (r.severity === "🔴") console.log(`  ${r.message}`);
  });
  return; // 阻止继续
}

// Step 2: 生成导出清单（自动判定加密）
console.log("📋 Generating deployment manifest...");
const export_result = await skills["devassets/export"]({
  project: "legita",
  environment: "production",
  format: "checklist",
  reason: "pre-deployment check"
});

// Step 3: 显示检查清单
console.log("📄 Production Checklist:");
console.log(export_result.content);

// Step 4: 要求用户确认
const proceed = await askUser("All items checked? Ready to deploy?");

if (!proceed) {
  console.log("⏸️  Deployment cancelled");
  return;
}

// Step 5: 验证清单一致性
console.log("✔️  Final verification...");
const verify = await skills["devassets/verify"]({
  project: "legita",
  manifest_path: export_result.file_path
});

if (verify.match_percentage < 100) {
  console.log("⚠️  Some assets differ from manifest");
  verify.assets.forEach(a => {
    if (a.status === "❌") console.log(`  ${a.name}: ${a.notes}`);
  });
}

// Step 6: 清单签名版本，commit 到 Git
console.log("✅ Exporting signed manifest for Git...");
const signed_export = await skills["devassets/export"]({
  project: "legita",
  environment: "production"
});

console.log(`
✅ All checks passed!
- Manifest: ${export_result.file_path}
- Signature: ${signed_export.signature}
- Status: Ready to deploy

Next: Push to GitHub, CI will verify automatically
`);

// Step 7: 记录审计
// (自动记录在 audit log 中)
```

---

## 错误处理和边界情况

### Skill 返回的错误类型

```typescript
interface SkillError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// 常见错误:
"PROJECT_NOT_FOUND"           // 项目不存在
"MANIFEST_SIGNATURE_INVALID"  // 清单被篡改
"DECRYPTION_FAILED"           // 无法解密
"WEBHOOK_VERIFICATION_FAILED" // Webhook 验证失败
"API_KEY_INVALID"             // API key 无效或过期
"INSUFFICIENT_PERMISSIONS"    // RBAC 权限不足（未来）
"RATE_LIMITED"                // API 速率限制
```

### Agent 应该如何处理

```typescript
try {
  const result = await skills["devassets/check"]({ project: "legita" });
} catch (error) {
  if (error.code === "PROJECT_NOT_FOUND") {
    console.log("❌ Project 'legita' not found");
    console.log("First, add it: devassets add-project legita --path=...");
  } else if (error.code === "WEBHOOK_VERIFICATION_FAILED") {
    console.log("⚠️  Webhook verification failed");
    console.log("Check Paddle dashboard for webhook configuration");
  } else {
    console.log(`❌ Error: ${error.message}`);
  }
}
```

---

## Skill 设计指导原则（给 Claude Code Agent）

### 1. 安全第一
- 任何涉及 secret 的操作都要确认
- 不返回真实的 secret value，只返回 hash 或状态
- 签名所有导出，防篡改

### 2. 智能推荐
- 根据环境（dev vs prod）自动判定加密需求
- 根据风险等级提示 Agent 下一步
- 给 Agent 完整的信息做决策

### 3. 即时反馈
- 每个操作都有明确的成功/失败信息
- 返回可采取行动的建议
- 完整的审计日志用于事后回溯

### 4. 工作流融合
- Skills 设计要符合开发者的自然工作流
- 比如：导出 → 验证 → 提交 → 部署
- 每步都可以独立调用，也可以流程化调用

---

## 下一步

1. **CLI 实现**: 完成所有 6 个命令的 Node.js 实现
2. **Skill 包装**: 将 CLI 命令包装成 Skill 类
3. **测试**: 本地测试 Skills 调用和返回值
4. **发布**: 发布到 npm，CLaude Code 自动发现
