Generate a portfolio report for all projects under a root directory using the devassets CLI.

Steps:
1. Ask the user for the projects root directory if not obvious from context. Default: current working directory.
2. Run: `devassets portfolio --root=<path> --json`
   - Add `--no-github` if the user is offline or wants a faster run.
   - The report is also written to `<root>/overview/data/current.json` for the dashboard.
3. Parse the JSON output and present a summary table:
   - Total projects, active vs archived, healthy vs attention
   - Dirty git repos (uncommitted changes)
   - Unpushed repos (commits not pushed to remote)
   - DevAssets scan coverage (succeeded / failed)
4. List projects needing attention: show name, status, and recommended next action.
5. If any repos are dirty or unpushed, list them explicitly and ask if the user wants to address them now.
6. If any projects failed the DevAssets scan, offer to run `devassets scan <project>` on each.

Note: `portfolio` inspects project metadata (Git, GitHub, CI, stack, asset health). It does not
store or read secret values — only key names and scan results from the DevAssets database.
