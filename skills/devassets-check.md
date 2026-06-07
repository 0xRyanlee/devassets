Use the devassets MCP tools to run a full asset health check on the current project.

Steps:
1. Call `devassets_list_projects` to find registered projects. If none, call `devassets_add_project` with the current directory as path, then `devassets_scan`.
2. Identify which project matches the current working directory (match by path prefix).
3. Call `devassets_scan` on the project to refresh asset records.
4. Call `devassets_check` with `environment: production` (or the environment the user specifies).
5. Present findings: status, critical/high risks first, then suggestions. Keep it concise — one line per risk.
6. If status is not healthy, ask the user if they want to rotate any keys or export a manifest.

If the user says "check all projects", call `devassets_doctor` instead of steps 2–4.
