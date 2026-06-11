# DevAssets Audit Fix Report — 2026-06-11

## Summary

Full audit cycle completed. 18 tasks executed across Medium/High/Architecture/Cosmetic priority buckets.
Build: ✅ `tsc` clean | Tests: ✅ 127/127 passed (was 110/110; +17 new vault-db unit tests)

---

## Fixes by Priority

### Medium (M) — 7 items

| ID | Change | File(s) |
|----|--------|---------|
| M1 | `listVaultSecrets(scope='global')` auto-redirects to `_global` project regardless of `projectId` arg | `src/db/queries.ts` |
| M2 | `getVaultSecretFallback` reads real scope from DB via `queryVaultSecretScope()` instead of hardcoded strings | `src/db/queries.ts` |
| M3 | `vaultEnv` default for payment key lookups is `'production'`; added comment explaining the semantic | `src/commands/check.ts` |
| M4 | `devassets_get_global_secret` not-found hint now points to the MCP tool, not CLI syntax | `src/mcp/server.ts` |
| M5 | `devassets get <proj> <KEY>` falls back to `_global` vault on miss; audit log records `sourceProject` | `src/commands/get.ts` |
| M6 | WAL mode + `busy_timeout=5000` after DB open to handle concurrent access without SQLITE_BUSY errors | `src/db/index.ts` |
| M7 | `inject --print` uses single-quote wrapping with `'\\''` escaping, safe for all shell meta-chars | `src/commands/inject.ts` |
| M8 | `devassets init` output includes step-by-step global vault setup hints | `src/commands/init.ts` |
| M10 | `devassets_set_global_secret` value schema adds `.max(65536)` to prevent OOM on oversized input | `src/mcp/server.ts` |

### High (H) — 5 items

| ID | Change | File(s) |
|----|--------|---------|
| H1 | `inject` and `run` commands merge `_global` keys before injection; project-specific keys take precedence | `src/commands/inject.ts`, `src/commands/run.ts` |
| H2 | `status` and `doctor` filter `_global` from project table; show global vault count as separate summary line | `src/commands/status.ts`, `src/commands/doctor.ts` |
| H3 | `devassets set _global <KEY>` auto-detects `_global` project and writes `scope='global'` | `src/commands/set.ts` |
| H5 | New `tests/unit/vault-db.test.ts` — 17 tests covering scope routing, fallback priority order, `listVaultSecrets` redirect, `findSecretAcrossProjects` scope filter, and scope-from-DB accuracy | `tests/unit/vault-db.test.ts` |
| H6 | `rotate` detects `projectId === '_global'` and outputs correct vault update steps | `src/commands/rotate.ts` |

### Architecture (A) — 3 items

| ID | Change | File(s) |
|----|--------|---------|
| A3/A4 | `generateCiSnippet` moved from `mcp/server.ts` to `src/core/ci.ts`; `canPerformAction` in `permissions.ts` annotated with TODO for future wiring | `src/core/ci.ts`, `src/core/permissions.ts`, `src/mcp/server.ts` |
| A5 | `SecretScope = 'global' \| 'project'` centralized in `src/types/assets.ts`; all query/command files use the type | `src/types/assets.ts`, `src/db/queries.ts` |

### Cosmetic/Docs (C) — 2 items

| ID | Change | File(s) |
|----|--------|---------|
| C2a | HKDF design comment added to `getVaultKey()` explaining domain separation and why salt is omitted | `src/utils/crypto.ts` |
| C2b | `~/.devassets/` cloud backup warning strengthened in both `init` output and README with explicit iCloud/Time Machine/gitignore steps | `src/commands/init.ts`, `README.md` |

---

## New Files

| File | Purpose |
|------|---------|
| `src/core/ci.ts` | `generateCiSnippet` extracted from `mcp/server.ts` |
| `tests/unit/vault-db.test.ts` | Vault DB layer integration tests (17 tests) |

## Infrastructure

- `src/db/index.ts`: Added `closeDb()` export for test isolation
- `vitest.config.ts`: Added `node-builtin-passthrough` Vite plugin to handle `node:sqlite` (Node 26 built-in) in the Vite transform pipeline

---

## Test Coverage

```
 Test Files  13 passed (13)
      Tests  127 passed (127)
```

New tests added: **17** (vault-db scope routing, fallback priority, `listVaultSecrets` redirect, `findSecretAcrossProjects` filter, scope-from-DB, `getGlobalSecret`)
