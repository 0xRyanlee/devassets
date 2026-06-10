Use the devassets MCP tools to run a full asset health check on the current project.

Steps:
1. Call `devassets_list_projects` to find registered projects.
   - If none found: call `devassets_add_project` with the current directory as path and name, then proceed to step 2.
   - If found: identify the project whose path matches the current working directory (longest prefix match).
2. Call `devassets_scan` on the project to refresh asset records. (Required before check — a project with 0 assets will show healthy even if unconfigured.)
3. Call `devassets_check` with `environment: production` (or the environment the user specifies).
4. Present findings concisely: status badge first, then critical/high risks one line each, then suggestions.
5. If status is not healthy:
   - Offer to call `devassets_identity` to verify which provider account each token belongs to.
   - Offer to call `devassets_rotate` for any key the user wants to replace.
   - Offer to export a manifest: `devassets_export` with `--stdout` or a file path.
6. If the user says "check all projects": call `devassets_doctor` instead of steps 2–4.

## Retrieving a token/secret — routing rules

When you need to look up a credential value, apply this decision tree:

**Is the key account-level (shared across projects)?**
Examples: `VERCEL_TOKEN`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `NPM_TOKEN`, `GCP_SERVICE_ACCOUNT`, `STRIPE_SECRET_KEY` (if shared across projects)

→ Call `devassets_get_global_secret(key, env)` — no project required.

**Is the key project-specific?**
Examples: `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`

→ Call `devassets_get_secret(project, key, env)`.
The tool searches: project vault → global vault → other projects (fallback). The `scope` field in the response tells you where it was found.

**Don't know which scope?**
→ Call `devassets_find_secret(key)` to search everywhere. Check the `scope` field in results:
- `scope: "global"` → the key is account-level; prefer `devassets_get_global_secret` next time.
- `scope: "project"` → use `devassets_get_secret` with the listed `projectId`.

**Key not found anywhere?**
- For global credentials: `devassets_set_global_secret(key, value, env)` — stores once, accessible from all projects.
- For project secrets: `devassets set <project> <key>` via CLI or ask the user.
