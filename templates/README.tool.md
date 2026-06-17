# [Tool Name]

> [One-line tagline — what problem it solves]

[![npm](https://img.shields.io/npm/v/[package-name])]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![CI](https://img.shields.io/github/actions/workflow/status/0xRyanlee/[repo]/ci.yml)]()

---

## Install

```bash
npm install -g [package-name]
# or
pnpm add -g [package-name]
```

---

## Quick Start

```bash
[tool] init          # first-time setup
[tool] status        # check current state
[tool] --help        # all commands
```

---

## What It Does

[2–3 sentences from the **user's perspective**. What workflow does it improve?]

---

## Commands

```
[tool] <command> [options]

Commands:
  init              Initialize [tool] in current project
  status            Show current project health
  scan              Scan project for issues
  sync              Sync with external services
  serve             Start MCP server (stdio)

Options:
  --project <name>  Target specific project
  --dry-run         Preview without executing
  --json            Output as JSON
  --help            Show help
```

---

## Configuration

```bash
# Project-level config
[tool] add --name my-project --path . --type web

# Global config at ~/.devassets/config.json
```

---

## Architecture

| Component | Technology |
|---|---|
| CLI | Node.js + TypeScript |
| Storage | SQLite (WAL mode, `~/.devassets/devassets.db`) |
| Encryption | AES-256-GCM, HKDF-SHA256 |
| MCP Server | stdio (Claude Code / Cursor compatible) |

---

## Tech Stack

Node.js 22 + TypeScript · SQLite (node:sqlite) · Vitest

---

## Development

```bash
git clone https://github.com/0xRyanlee/[repo]
pnpm install
pnpm dev            # watch mode
pnpm test           # run tests
pnpm build          # compile to dist/
```

---

## Project Management

Linear: [Project Name](https://linear.app/things-need-to-be-done/project/[slug])

---

## License

MIT © [Ryan Li](https://github.com/0xRyanlee)
