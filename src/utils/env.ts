// CI env vars set by GitHub Actions, CircleCI, GitLab CI, Jenkins, etc.
const CI_ENV_VARS = ['CI', 'CONTINUOUS_INTEGRATION', 'GITHUB_ACTIONS', 'GITLAB_CI', 'CIRCLECI', 'TRAVIS'];

export function isCI(): boolean {
  return CI_ENV_VARS.some((v) => !!process.env[v]);
}

export function isTTY(): boolean {
  return !!process.stdout.isTTY;
}

// Interactive = has TTY AND not running inside a CI pipeline
export function isInteractive(): boolean {
  return isTTY() && !isCI();
}
