# devassets.hyphen-network.com — Landing Page Plan

Built into the existing Hyphen site (`HyphenNetwork/web`, Next 16 + React 19 + Tailwind 4 +
framer-motion), following the established **tool-page pattern** (`app/paperclip/` → `app/devassets/`).
Reuses `components/shared/tool-nav` + `tool-footer`; per-tool accent override in `layout.tsx`.

## Wiring (done / to do)

- [x] Register `devassets` in `lib/tools.ts` (hosted, accent `#3b82f6`, status beta)
- [ ] `app/devassets/layout.tsx` — metadata + accent palette
- [ ] `app/devassets/page.tsx` — ToolNav + sections + ToolFooter
- [ ] `components/devassets/*` — section components
- [ ] Subdomain `devassets.hyphen-network.com` → rewrite to `/devassets` (Vercel dashboard / middleware)

## Positioning

- **Name**: DevAssets · **Tagline**: 開發者憑證指揮中心
- **One-liner**: Know which API keys every project uses, which account/workspace each token
  belongs to, and what's missing before you deploy — secrets never leave your machine.
- **Distribution**: npm CLI + MCP (free, MIT). CTA = install, not signup. No pricing section.

## Sections (top → bottom)

1. **Hero**
   - H1: 你的憑證指揮中心 / The credential command center for independent builders
   - Sub: one-liner. CTAs: `npm install -g @hyphen-network/devassets` (copy button) · GitHub.
   - Visual: terminal block (`devassets doctor` output) or the dashboard screenshot.

2. **The Problem** (4 pain quotes from README)
   - "Which .env.example key did I forget to set before this deploy?"
   - "Is this VERCEL_TOKEN my personal account or the company team?"
   - "This SUPABASE_URL — right project, or did I paste staging into prod?"
   - "Which npm account / GCloud project does this token belong to?"

3. **What it does** (feature grid, 6 cards)
   - Inventory env vars/tokens across all projects (names only)
   - Detect missing required keys before deploy (`.env.example` diff)
   - Resolve token → account / workspace / project (Vercel, Supabase, Neon, npm, GCloud)
   - Catch wrong-account / workspace mismatch (`--pin`)
   - Smart classification — public vs secret vs identifier; cloud/CI/runtime = managed
   - AI-native via MCP (Claude Code / Cursor)

4. **Before / After** (the 6-row table from README, condensed to 4)

5. **Proof** (dogfood stats — social proof)
   - "Run on 10 of my own production projects: surfaced 33 unset secrets and an
     over-privileged Supabase token spanning 4 projects — before any of it broke production."

6. **Get started** (install + quick commands + MCP `.claude/settings.json` snippet)

7. **ToolFooter** (shared)

## Visual assets available

- Dashboard screenshot (`/tmp/devassets-ui.png`), ProjectDetail with identities, Audit log.
- Terminal output: `devassets doctor`, `devassets identity` (account/workspace resolution).

## Tone

Match Hyphen site: dark canvas `#06070a`, geist mono for code/labels, restrained framer-motion
entrances. devassets accent blue `#3b82f6` (overrides the site's green via layout palette).
