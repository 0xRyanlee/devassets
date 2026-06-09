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
