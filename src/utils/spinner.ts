import ora from 'ora';
import chalk from 'chalk';
import { isCI } from './env.js';

type SpinnerLike = {
  start(text?: string): SpinnerLike;
  succeed(text?: string): SpinnerLike;
  fail(text?: string): SpinnerLike;
  stop(): SpinnerLike;
  text: string;
};

// Silent: no output at all (used in --json mode)
function silentSpinner(): SpinnerLike {
  const s: SpinnerLike = { start: () => s, succeed: () => s, fail: () => s, stop: () => s, text: '' };
  return s;
}

// Plain: no animation (non-TTY / piped / CI), but still emits final result lines
function plainSpinner(): SpinnerLike {
  const plain: SpinnerLike = {
    start() { return plain; },
    succeed(t?: string) { if (t) console.log(chalk.green('✓'), t); return plain; },
    fail(t?: string) { if (t) console.error(chalk.red('✗'), t); return plain; },
    stop() { return plain; },
    text: '',
  };
  return plain;
}

export function createSpinner(text: string, active = true): SpinnerLike {
  if (!active) return silentSpinner();
  // CI environments and non-TTY pipes get plain output (no animation)
  if (!process.stdout.isTTY || isCI()) return plainSpinner();
  return ora({ text, spinner: 'dots' }) as unknown as SpinnerLike;
}
