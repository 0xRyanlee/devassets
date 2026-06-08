# DevAssets — Development Report

Date: 2026-06-08 · Package: `@hyphen-network/devassets` · Repo: github.com/0xRyanlee/devassets

---

## 1. Executive summary

DevAssets went from a 0.1 env-scanner to a **0.7.0 credential command center** — published to npm, with
a 3-axis classification model, provider identity resolution, monorepo support, a redesigned dashboard,
a marketing landing page (linear.app aesthetic) on the Hyphen site, and a reusable `audit` skill.
**92 tests pass; both the CLI and the web build are green; npm 0.7.0 is live.** Five-lens audits
were run on the new surfaces; all findings fixed.

---

## 2. What shipped

### CLI / MCP (npm `@hyphen-network/devassets@0.7.0`)
| Version | Delivered |
|---|---|
| 0.2.0 | Stripe integration, `doctor`, `doctor --fix` (listr2), `install-skills`, CLI spinners (ora), MCP `devassets_doctor`/`ci_snippet`/`skills` |
| 0.3.0 | **Real missing-key detection** — `.env.example` treated as required-key declaration (fixed false "healthy"); two-tier severity |
| 0.4.0 | **Credential identity layer** — resolve token → account/workspace/project (Vercel/Supabase/Neon/npm/GCloud); `--pin` mismatch guard; `devassets_identity` MCP tool; dashboard identity panel |
| 0.4.1 | Fix: payment check reads project `.env` (not `process.env`) |
| 0.4.2 | **Axis A** — 4-way `classifyKey` (public/secret/identifier/config); `NEXT_PUBLIC_*` no longer false-flagged |
| 0.5.0 | **Monorepo** — 3-layer scan-root resolution (`.devassets.yml` → workspace manifest → discovery) |
| 0.6.0 | **Axis B** — `.devassets.yml secrets:` location annotation; `managed` status (cloud/CI/runtime not flagged missing) |
| 0.7.0 | **Axis C** — project `type` relaxes desktop/mobile/library missing-secret severity. Classification model complete |

Security: two adversarial audits across the arc → **13 findings fixed** (atomic key write, localhost-only
dashboard, path-traversal guards, scrypt N=65536, no plaintext preview in MCP, input validation).

### Dashboard (ui/, shadcn + React Bits motion)
Redesigned all 5 pages: shadcn primitives, CountUp/SpotlightCard/Aurora, framer-motion; ProjectDetail
reorganized into Assets/Identities/Risks tabs with the managed/identity surfacing.

### Landing page (HyphenNetwork/web `app/devassets/`, linear.app aesthetic)
Hero (animated terminal), Problem, Personas (who-it's-for), Features, Compare (with/without + vs
secret managers), Proof (count-up + honest signals), Agents (MCP), FAQ (accordion), Get-started, Support.
SEO/AEO: JSON-LD (SoftwareApplication + FAQPage), `llms.txt`, `robots.ts` (welcomes AI crawlers),
`sitemap.ts`. **No fabricated testimonials** — personas + author dogfooding + engineering signals instead.

### `audit` skill (`~/.claude/skills/audit/SKILL.md`)
Routed multi-lens audit: say "audit" → it picks 1–3 of {graph exploration, user journey, architecture,
adversarial, intent} by signal, executes, reports `[LENS][SEVERITY]` findings. Defaults to intent+adversarial.

---

## 3. The classification model (the core IP)

Three independent axes, grounded in `docs/project-forms-research.md` (survey of 22 real projects + AEO/secret-tooling research):

- **A — sensitivity**: public (NEXT_PUBLIC_ etc.) / secret (KEY/SECRET/TOKEN/DSN/DATABASE_URL) / identifier (_ID) / config.
- **B — location**: local-env (default) / cloud-platform / ci-secret / runtime-user / source-public / external-vault → non-local = `managed`, never false-missing.
- **C — form**: `type` relaxes severity for desktop/mobile/library (secrets live in CI/keystore/runtime, not `.env`).

This makes the tool correct across web (strict), desktop (relaxed), monorepo (multi-root), and cloud-managed setups.

---

## 4. Five-lens audit (this session's new surfaces)

**Routed**: landing page → user-journey + intent + adversarial; CLI changes already covered by prior adversarial rounds.

| # | Lens | Severity | Finding | Status |
|---|---|---|---|---|
| 1 | user journey / graph | HIGH | Nav anchors `AI agents`/`FAQ` pointed at `#get-started`; sections had no ids | Fixed (added `#agents`/`#faq`) |
| 2 | intent | MEDIUM | "Contact author" (a stated requirement) was missing | Fixed (added @0xRyanlee + npm) |
| 3 | user journey | MEDIUM | Sponsor link to a possibly-unconfigured GitHub Sponsors page → 404 risk | Fixed (→ Issues "回報問題/許願") |
| 4 | adversarial | PASS | Static page, no user input, external links `rel=noopener`, JSON-LD from static data | — |
| 5 | architecture | PASS | Components self-contained, match the paperclip pattern; faq-data extracted to fix client/server boundary | — |
| 6 | intent | PASS | Spec coverage: linear style ✓, GitHub+npm ✓, SEO/AEO ✓, comparison tables ✓, personas ✓, honest proof ✓ |

CLI/MCP (prior rounds): 13 adversarial findings fixed; classification verified on real data (paperclip 4 secrets critical / 32 non-secret low; Party over-privileged Supabase PAT surfaced).

---

## 5. Verification

- **Tests**: 92 passing (vitest) — unit (classify, validator, scanner, roots, providers, crypto, dotenv, stripe) + integration (CLI, export).
- **Builds**: devassets `tsc` + `ui` vite green; HyphenNetwork `next build` green (`/devassets`, `/robots.txt`, `/sitemap.xml` generated).
- **npm**: `@hyphen-network/devassets@0.7.0` live (`latest`).
- **Dogfood**: re-scanned 10 real projects under 0.7.0 — classification accurate, zero misclassification.
- **Visual**: landing page screenshotted (hero + full page) — linear aesthetic confirmed.

---

## 6. Outstanding / next

- **HyphenNetwork commit is local** (no git remote here) — user pushes/deploys (Vercel). Add domain `devassets.hyphen-network.com` rewrite.
- **GitHub Sponsors** not enabled — Support secondary currently points to Issues; switch to Sponsors once set up.
- **Promotion** (was deferred): Smithery.ai `smithery.yaml`, awesome-mcp-servers PR.
- **Deferred by design**: deep live token-type verification (TruffleHog-style detectors), cloud env listing via provider APIs.
- **Security follow-up (out of scope, noted)**: dogfooding surfaced a forgeable client-side `checkout.completed` license write in the `mindset` desktop app — unrelated to devassets but worth fixing.
