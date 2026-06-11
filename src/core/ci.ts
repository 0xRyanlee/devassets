export function generateCiSnippet(projectId: string, branch: string, environment: string) {
  const safe = /^[a-zA-Z0-9_.-]+$/;
  if (!safe.test(projectId) || !safe.test(branch) || !safe.test(environment)) {
    throw new Error('projectId, branch, and environment must contain only alphanumeric characters, hyphens, underscores, and dots');
  }
  const reusable = `name: DevAssets Check
on:
  push:
    branches: [${branch}]
  pull_request:
    branches: [${branch}]

jobs:
  asset-check:
    uses: 0xRyanlee/devassets/.github/workflows/check.yml@main
    with:
      project: ${projectId}
      environment: ${environment}`;

  const standalone = `name: DevAssets Check
on:
  push:
    branches: [${branch}]
  pull_request:
    branches: [${branch}]

jobs:
  asset-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm install -g @hyphen-network/devassets
      - run: devassets init
      - run: devassets add-project ${projectId} --path=\${{ github.workspace }} --type=saas
      - run: devassets scan ${projectId}
      - run: devassets check ${projectId} --env=${environment} --fail-on-risk`;

  return { reusable, standalone };
}
