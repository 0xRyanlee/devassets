import { defineConfig, Plugin } from 'vitest/config';

// node:sqlite is a Node 26 built-in. Vite can't bundle it, so we intercept and provide a CJS shim.
const nodeBuiltinPlugin: Plugin = {
  name: 'node-builtin-passthrough',
  resolveId(id) {
    if (id === 'node:sqlite' || id === 'sqlite') {
      return '\0virtual:node-sqlite';
    }
  },
  load(id) {
    if (id === '\0virtual:node-sqlite') {
      // Use createRequire to load the built-in at runtime (avoids Vite's static analysis)
      return `
import { createRequire } from 'module';
const _req = createRequire(import.meta.url);
const _sqlite = _req('node:sqlite');
export const DatabaseSync = _sqlite.DatabaseSync;
export default _sqlite;
`;
    }
  },
};

export default defineConfig({
  plugins: [nodeBuiltinPlugin],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    server: {
      deps: {
        external: ['node:sqlite'],
      },
    },
  },
});
