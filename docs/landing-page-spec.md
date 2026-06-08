# devassets.hyphen-network.com — Complete Build Spec

> Supersedes `landing-page-plan.md`. Research-backed full specification: visual system,
> information architecture, copy, comparison tables, SEO/AEO/agent-friendliness, CTAs
> (GitHub/npm/donate), and the implementation plan. Built into `HyphenNetwork/web`
> (Next 16 / React 19 / Tailwind 4 / framer-motion), tool-page pattern (`app/devassets/`).

---

## 1. Goals

1. **Convert developers** → `npm install` + GitHub star.
2. **Be the answer** when a human or AI agent asks "tool to track which account a token belongs to / find missing env vars across projects" → AEO.
3. **Communicate the category** — devassets is the *map + health + identity layer*, NOT another vault.
4. Optional: a low-friction **$1 author support** CTA.

---

## 2. Visual system — linear.app website aesthetic

> Clarified: emulate **linear.app's actual website design**, not the existing Hyphen page style.

linear.app signature treatment to replicate:
- **Near-black canvas** with a **subtle multi-stop gradient mesh** glow (blue/violet, very low opacity, blurred) behind hero and section transitions — the defining Linear background.
- **Big, tight typography**: oversized bold headline (`clamp(44px,7vw,76px)`), tracking `-0.03em`, generous line-height control; lots of negative space / vertical rhythm.
- **One bold headline + one primary action per viewport**; everything else recedes.
- **Glassmorphism**: cards are semi-transparent (`rgba(surface, 0.6)`) with `backdrop-filter: blur`, hairline borders, soft inner glow on hover.
- **Product mock with glow + perspective**: the terminal/dashboard floats with a large soft shadow and a faint accent halo (Linear's product-shot treatment).
- **Restrained, near-monochrome** with a single accent (devassets blue `#3b82f6`); gradients do the color work, not flat fills.
- **Refined micro-motion**: subtle fade-up on scroll, gradient drift, hover lifts — nothing loud.

- **Canvas**: reuse Hyphen `--canvas #06070a`; devassets accent **`#3b82f6`** (blue) via layout override.
- **Type**: geist sans (site default) for headings; geist mono for code/labels/keys.
- **Surfaces**: hairline borders (`--hairline`), `--surface-1/2`, glass blur on nav + cards.
- **Gradient**: one faint blue radial glow behind hero (like our dashboard Aurora), nothing loud.
- **Motion** (framer-motion, all subtle, `ease [0.16,1,0.3,1]`):
  - hero text staggered fade-up; nav slide-down (matches `tool-nav`)
  - section reveal on scroll (`whileInView`, once, y:16→0, 0.4s)
  - the terminal/dashboard mock animates (typed command → output) — "show, don't tell"
  - number count-up on the proof stats (reuse the dashboard CountUp idea)
  - hover: cards lift 2px + accent hairline; copy-button "copied ✓" state
- **Anti-goals**: no carousels, no parallax, no autoplaying video, no loud color.

---

## 3. Information architecture (top → bottom)

| # | Section | Purpose | Key element |
|---|---|---|---|
| 1 | **Hero** | hook + install | headline, one-liner, `npm i` copy block, GitHub + Docs buttons, animated terminal |
| 2 | **The Problem** | resonate | 4 pain quotes (mono, as if from the dev's head) |
| 2.5 | **Who it's for** | self-identify | 5 persona cards: situation → pain → how devassets solves it (honest, not testimonials) |
| 3 | **What it does** | features | 6-card grid with icons |
| 4 | **Live demo** | show product | animated `devassets identity` + `doctor` output / dashboard screenshot |
| 5 | **With / Without** | value contrast | 2-column comparison table |
| 6 | **vs. secret managers** | category clarity | comparison table (complementary, not competing) |
| 7 | **Proof** | social proof (HONEST only) | dogfood stats (count-up) + real engineering signals; NO fabricated testimonials |
| 8 | **For AI agents** | AEO + agent onboarding | MCP snippet + "ask your agent" examples |
| 9 | **FAQ** | AEO + objections | FAQPage-schema Q&A accordion |
| 10 | **Get started** | conversion | install steps, MCP config, links |
| 11 | **Support / Contact** | author | donate CTA + contact |
| 12 | **ToolFooter** (shared) | nav | back to hyphen-network |

---

## 4. Copy (ready to paste)

**Hero**
- Eyebrow: `MIT · npm · MCP-native`
- H1: **Your credential command center**
- Sub: Know which API keys every project uses, which account & workspace each token belongs to, and what's missing before you deploy — secret values never leave your machine.
- Primary CTA: `npm install -g @hyphen-network/devassets` (click-to-copy)
- Secondary: **GitHub** (★) · **Docs**

**Problem** (mono quotes)
- "Which `.env.example` key did I forget to set before this deploy?"
- "Is this `VERCEL_TOKEN` my personal account or the company team?"
- "This `SUPABASE_URL` — right project, or did I paste staging into prod?"
- "Which npm account / GCloud project does this service account belong to?"

**Who it's for** (persona cards — situation → pain → solution; lets visitors self-identify. Honest framing: these are use cases, not quotes from named users.)

1. **The multi-project solo dev** — "I run 12 side projects." → *Can't remember which `VERCEL_TOKEN`/Supabase belongs to which account.* → `doctor` cross-project overview + `identity` resolves every token's account/workspace.
2. **The vibe-coder (AI-driven)** — "I build with Claude Code / Cursor." → *The agent can't see my credential state, so it guesses.* → MCP server gives the agent 12 tools to check/scan/resolve directly.
3. **The Friday-deploy founder** — "Shipping to prod, again." → *A forgotten secret 500s production.* → `check --fail-on-risk` gates the deploy and names the missing secret.
4. **The repo-reviver** — "Reopening a 6-month-old project." → *`.env` archaeology to figure out what it needs.* → `scan` + `identity` map every key and account in seconds.
5. **The security-minded dev** — "I don't want a leaked/over-privileged token." → *A broad PAT sitting in the wrong project's `.env`.* → classification + `identity` surface it (this is a real find from the author's own dogfooding).

**Features** (6)
1. **Inventory, not exposure** — scans `.env*` for key *names* only, across every project.
2. **Missing before deploy** — diffs actual env vs `.env.example`; secrets missing in prod = critical.
3. **Whose token is this?** — resolves Vercel / Supabase / Neon / npm / Google Cloud token → account, workspace, projects.
4. **Wrong-account guardrail** — `--pin` the right identity; warns on any future drift.
5. **Knows what's a secret** — public vs secret vs identifier; cloud/CI/runtime keys = "managed", never false-flagged.
6. **AI-native** — MCP server; your agent checks credentials directly.

**Proof** (honest social proof — NO fake testimonials; see §11)
> Run on 10 of my own production projects: surfaced **33 unset secrets** and an **over-privileged Supabase token spanning 4 projects** — caught before any of it reached production.

Real trust signals (all true, link each to evidence):
- **92 tests · MIT · fully open source** — auditable, no telemetry.
- **Shipped after an adversarial security audit** — 13 findings fixed before release (link the commit).
- **Secret values never leave your machine** — names + metadata only.
- Author's dogfooding note as a quote (first-person, true), not a fabricated user.

---

## 5. Comparison tables

### 5a. With / Without devassets

| Situation | Without | With devassets |
|---|---|---|
| Required secret unset at deploy | 500 in prod, debug from logs | `check --fail-on-risk` blocks deploy, names the secret |
| Token from the wrong account | silent until data lands wrong | `identity` shows account/workspace; ⚠ MISMATCH |
| "Where's this app's Supabase project?" | dig dashboards | exact project ref shown |
| Onboarding an old repo | manual `.env` archaeology | `scan` + `identity` maps it in seconds |
| Sharing a deploy checklist | paste secrets in chat | signed, AES-encrypted, names-only export |

### 5b. devassets vs secret managers (category clarity — it's complementary)

| | **devassets** | Doppler / Infisical / Vault | dotenvx |
|---|---|---|---|
| Category | map · health · identity | secret **store** / injector | encrypted `.env` |
| Stores secret values | **no** (names + metadata) | yes (the point) | yes (encrypted) |
| Resolves token → account/workspace | **yes** | no | no |
| Cross-project overview | **yes** | per-project/env | no |
| MCP / agent-native | **yes** | no | no |
| Runs | local, on-demand | cloud/self-host service | local |
| Price | free, MIT | freemium / paid | free |

> Positioning line: *"devassets doesn't replace your vault — it's the layer that tells you whether what's in (and out of) it is correct."*

---

## 6. SEO / AEO / agent-friendliness

Research consensus (Frase, LLMrefs, Addy Osmani): structured headings, lead-with-outcome, tables for
reference, FAQ schema, llms.txt, and statistics/quotes increase AI citation.

**Implement:**
- **`/llms.txt`** (root, markdown) — supported by OpenAI & Perplexity. A concise directory: what
  devassets is, install, key commands, links to README/docs. (Static file in `public/`.)
- **JSON-LD schema** in the page `<head>`:
  - `SoftwareApplication` (name, description, applicationCategory: DeveloperApplication, operatingSystem, offers price 0, downloadUrl npm)
  - `FAQPage` (mirrors the FAQ section)
- **Semantic structure**: single H1, ordered H2/H3, outcome-first paragraphs, code right after the claim, tables for the command/provider reference.
- **`/robots.txt`** — explicitly allow AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) + `Sitemap:` line.
- **`/sitemap.xml`** — include `/devassets` (Next can generate via `app/sitemap.ts`).
- **Entity naming**: name competitors and the exact problem phrases people search/ask, so the page matches agent queries ("tool to check which account a token belongs to", "find missing env vars across projects", "alternative to Doppler for solo devs").
- **Keywords/intent**: "developer credential manager", "env var inventory", "token account checker", "MCP secrets tool", ".env.example missing keys", "wrong supabase project guard".

**"For AI agents" section copy** (also feeds AEO):
- One-line install for MCP + the `.claude/settings.json` snippet.
- Example agent prompts: *"Which of my projects have missing production secrets?"* / *"Resolve the accounts for all tokens in <project>."*

---

## 7. CTAs: GitHub / npm / download / contact / donate

- **npm**: hero click-to-copy `npm install -g @hyphen-network/devassets` + link to npm page.
- **GitHub**: star button + repo link (`github.com/0xRyanlee/devassets`). Show star count (GitHub API, optional).
- **Docs**: link to README / docs.
- **Contact author**: email + X/GitHub. Reuse a simple mailto + social row (the Hyphen footer already has a pattern).

### Donation / support CTA — analysis (the $1 question)

**Can you use Paddle for a $1 donation? Short answer: technically yes but it's the wrong tool, and there are real concerns.**

- **Paddle is a Merchant of Record** — it registers, collects, and remits VAT/sales tax globally and is liable for compliance. That's the big plus: *you don't handle sales tax at all*. Your only tax duty is income tax on payouts (normal business/personal income).
- **But**:
  1. **Fees destroy $1.** MoR fees ≈ 5% + ~$0.50/transaction. On $1 that's ~55% gone — economically pointless.
  2. **ToS friction.** Paddle sells *software/SaaS digital products*; pure "donations/tips" aren't their model and can fail review. Workaround = frame it as a digital product ("Supporter" / "Sponsor" badge), not a donation.
  3. **Onboarding overhead** for a tip jar is disproportionate.

**Recommendation (ranked):**
1. **GitHub Sponsors** — zero platform fee, native to OSS, one-click for devs already on GitHub. Best primary.
2. **Buy Me a Coffee / Ko-fi** — purpose-built for $1–$5 tips, handles the flow; small fee but designed for this.
3. **Polar.sh** — modern MoR for developers/OSS; handles tax like Paddle but built for exactly this (tips, one-off, sponsorware). Use if you want MoR tax-handling without Paddle's friction.
4. **Paddle/Lemon Squeezy** — only if devassets later sells a paid tier; not for a $1 tip.

**Tax concern summary**: with any MoR (GitHub Sponsors handles its own, Polar, Paddle, Lemon Squeezy), **sales tax/VAT is not your problem** — the platform handles it. You only declare the received amount as income. For a Taiwan-based author, that's personal/business income tax on payouts; no need to register for foreign VAT. A literal "donation" has different (sometimes worse) tax/legal treatment than "payment for a digital product/sponsorship", so framing it as **"buy me a coffee / supporter"** (a product) via GitHub Sponsors or Polar is cleaner than a "donation".

**DECIDED order (trust-first — stars before money):**
1. **★ Star on GitHub** (primary CTA) — free, builds the social proof that any later donation depends on. A link/button to `github.com/0xRyanlee/devassets` (cannot auto-star; it takes the user to GitHub where they click Star).
2. **GitHub Sponsors** (secondary, soft) — for those who want to support.
3. Paid tip (Ko-fi / Polar) — **deferred** until there's traction; not worth building now.
4. Paddle — not used for tips (fees + ToS, see above). ("Paddle Pro" isn't a tipping product; Paddle is a MoR for selling software — only relevant if devassets later sells a paid tier.)

**Page treatment**: a "Support" block led by `★ Star on GitHub`, with a quiet "Sponsor" link. No $ amount shown yet.

---

## 8. FAQ (FAQPage schema + objections)

1. **Does devassets store my secrets?** No — only key names and resolved metadata (account/workspace/validity). Values are read transiently to call a provider API, then discarded.
2. **Is it a replacement for Doppler / Vault / 1Password?** No — it's the map/health/identity layer on top of wherever your secrets live.
3. **How does it know which account a token belongs to?** It calls each provider's identity API (Vercel/Supabase/Neon/npm/GCloud) at check time with the value read transiently.
4. **Does it work with monorepos?** Yes — auto-detects scan roots from workspace manifests or discovery; or declare `roots:` in `.devassets.yml`.
5. **How do I use it with Claude Code / Cursor?** Add the MCP server to `.claude/settings.json`; the agent gets 12 tools.
6. **Is it free?** Yes, MIT.
7. **Which providers are supported?** Vercel, Supabase, Neon, npm, Google Cloud (identity); Paddle, Stripe (payment status).
8. **Does anything leave my machine?** Only the provider API calls you trigger (`check`/`identity`); everything else is local SQLite.

---

## 9. Implementation plan

**Files (in `HyphenNetwork/web`):**
- [x] `lib/tools.ts` — devassets entry
- [ ] `app/devassets/layout.tsx` — metadata (title/description/OG), JSON-LD (SoftwareApplication + FAQPage), accent palette `#3b82f6`
- [ ] `app/devassets/page.tsx` — ToolNav + sections + ToolFooter
- [ ] `components/devassets/hero.tsx` — headline, copy-install, GitHub/Docs, animated terminal
- [ ] `components/devassets/problem.tsx`
- [ ] `components/devassets/features.tsx` — 6-card grid
- [ ] `components/devassets/demo.tsx` — animated terminal/dashboard
- [ ] `components/devassets/compare.tsx` — both tables
- [ ] `components/devassets/proof.tsx` — count-up stats
- [ ] `components/devassets/agents.tsx` — MCP + prompts
- [ ] `components/devassets/faq.tsx` — accordion
- [ ] `components/devassets/get-started.tsx`
- [ ] `components/devassets/support.tsx` — GitHub star + buy-me-a-coffee
- [ ] `public/llms.txt`, `public/robots.txt` (allow AI crawlers + sitemap), `app/sitemap.ts`
- [ ] Shared `components/shared/copy-button.tsx` (click-to-copy install)

**Deploy:**
- [ ] Vercel: add domain `devassets.hyphen-network.com` → rewrite to `/devassets` (dashboard or `middleware.ts` for all HOSTED_TOOL_IDS)
- [ ] Push HyphenNetwork commit (currently held — pushing before the page exists would show a broken nav link)

**Assets to capture:** dashboard screenshot, ProjectDetail+identities, `devassets doctor` / `identity` terminal output (for the demo + OG image).

**Build order:** layout+page shell → hero → features → compare → proof → faq → get-started → agents → support → demo animation → llms.txt/robots/sitemap/schema → screenshot pass → push + domain.

---

## 10. Decisions (resolved)

1. **Support**: trust-first — `★ Star on GitHub` primary, Sponsors secondary, paid tips deferred. No Paddle for tips.
2. **Star count**: NOT shown live (too low to help yet). Instead: honest trust signals (tests/MIT/audit) — see §11.
3. **Hero visual**: **animated terminal** (`devassets doctor` / `identity` typing → output), Linear-style "product in action"; dashboard screenshot used lower in the demo section.
4. **URL**: ship the subdomain **devassets.hyphen-network.com** (path `/devassets` works immediately; add the domain rewrite on Vercel). The "Star" button is a plain link to the GitHub repo — clicking it sends the visitor to GitHub to star (no auto-star possible without their GitHub auth).

## 11. Integrity guardrail (no fake testimonials)

Fabricated user comments are out — deceptive, illegal in many jurisdictions (FTC/EU/UK), and
uniquely fatal for a *trust/security* product if discovered. Replace with honest, stronger proof:
author dogfooding (true), engineering signals (92 tests, MIT, open source, no telemetry), the
adversarial security audit (true, link commits), and a placeholder testimonials structure to fill
with **real** quotes once early users exist. This is a hard line.
