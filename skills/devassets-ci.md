Generate a GitHub Actions CI workflow that integrates devassets asset checking into the user's deployment pipeline.

Steps:
1. Call `devassets_ci_snippet` with the project ID (ask the user if unknown) and optionally the branch they deploy from.
2. Show the returned YAML snippet.
3. Offer to create `.github/workflows/devassets.yml` in the current project directory with that content.
4. If the user agrees, write the file. Remind them to commit and push (requires GitHub token with `workflow` scope: `gh auth refresh -h github.com -s workflow`).

The workflow gates deployments: if devassets finds critical or warning-level asset risks, CI fails and the push is blocked.
