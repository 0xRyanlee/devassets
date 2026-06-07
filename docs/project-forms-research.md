# Project Forms & Credential Classification — Research Report

> Purpose: ground devassets' next milestone in evidence. Two inputs — (1) a survey of all
> local projects (the "local-side model", since GitHub-side secrets can't be inspected from here),
> and (2) online research on credential/secret classification taxonomies. Conclusions feed a
> design discussion on how devassets can genuinely help.

Date: 2026-06-08

---

## Part 1 — Local survey (the local-side model)

22 projects under `/Volumes/Astoria/Projects` (excluding OLD/legacy). Classified by build signals.

### Project forms observed

| Form | Projects | Secret reality |
|---|---|---|
| **Web (Next.js / Vite SSR)** | MomoLandingpage, Prophet, computer.com.tw, sideproject, comma (frontend/), BDDB (frontend/), Party (web/) | `.env` server secrets + `NEXT_PUBLIC_*` in client bundle + cloud platform env (Vercel) |
| **Tauri desktop (+ web UI)** | Cuckoo, mindset, sparkie | client/publishable tokens in source; user-runtime keys in local DB; signing in CI. `.env` mostly N/A for runtime |
| **Web + Mobile (Expo/RN)** | paperclip | `.env` + platform keystores + CI secrets |
| **Python backend / service** | salva, HyphenNetwork, hermes_workspace, hypermemresearch | `.env` or `config/.env` server secrets |
| **Rust / native** | meetily-zh | local config, no web `.env` model |
| **Unity (C#)** | worlds-of-dao | no `.env`; secrets in build pipeline / external services |
| **CLI / library** | devassets | publish token in CI only, no runtime secrets |
| **Monorepo (secrets in subdir)** | Party (`web/`), MomoContractor (`momocontractor-frontend/`), BDDB (`frontend/`), comma (`frontend/`) | **root scan misses them** |

### Credential taxonomy actually found in local `.env` files

Aggregated key names across all `.env*` (names only). The decisive finding: **a large share are NOT secrets.**

**Public by design** (must NOT be flagged as missing-secret):
- `NEXT_PUBLIC_*` — exposed to the browser bundle by Next.js (SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID, APP_URL, MAPBOX_TOKEN, VAPID_KEY, SITE_URL, PAYMENTS_ENABLED, API_BASE_URL)
- `*_CLIENT_ID` — OAuth client IDs are public (GOOGLE_CLIENT_ID, GITHUB_CLIENT_ID, EXPO_CLIENT_ID, GOOGLE_IOS/WEB_CLIENT_ID)
- Payment identifiers — `PADDLE_*_PRICE_ID`, `PADDLE_*_PRODUCT_ID`, `PADDLE_SELLER_ID`
- Apple identifiers — `APPLE_TEAM_ID`, `APPLE_SERVICE_ID`, `APPLE_KEY_ID` (the `.p8` private key is the secret, not these)
- `LINE_LIFF_ID`

**Real server-side secrets:**
- `*_SECRET` — GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_SECRET, BETTER_AUTH_SECRET, ADMIN_SECRET, PUSH_INTERNAL_SECRET, PADDLE_WEBHOOK_SECRET
- `*_API_KEY` (server) — PADDLE_API_KEY, SALVA_API_KEY, GEMINI_API_KEY, RESEND_API_KEY
- `*_ACCESS_TOKEN` / cloud tokens — SUPABASE_ACCESS_TOKEN, VERCEL_TOKEN, TUNNEL_TOKEN
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS, extremely sensitive
- `*_PRIVATE_KEY` — VAPID_PRIVATE_KEY
- `*_PASSWORD` — ADMIN_PASSWORD
- `DATABASE_URL` / `DIRECT_URL` — **password embedded in the URL** (name says neither KEY nor SECRET)

**Cloud tokens present locally (verifiable!):** `Party/web/.env.local` holds real `VERCEL_TOKEN` + `SUPABASE_ACCESS_TOKEN` — exactly the identity-resolution target.

### Bugs/gaps the survey exposes in current devassets

1. **`isSensitiveKey` misclassifies public keys.** Current regex flags `_KEY$` → `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_VAPID_KEY` would be marked sensitive-missing, but both are public by design. **The `NEXT_PUBLIC_` / `PUBLIC_` / `VITE_` prefix must override sensitivity.**
2. **Monorepo blind spot.** Secrets in `web/`, `frontend/` subdirs aren't scanned when the project path is the repo root (Party, comma, BDDB, MomoContractor).
3. **No form awareness.** Desktop/Unity/mobile projects get a web-`.env` model applied, producing both false positives (publishable token "missing") and blind spots (CI/keystore secrets invisible).
4. **`DATABASE_URL` under-rated.** Contains an embedded DB password but matches no sensitivity pattern → would be treated as low/config.

---

## Part 2 — Online research

### Secret-scanner taxonomies (gitleaks / trufflehog / detect-secrets)

- **TruffleHog**: 800+ purpose-built detectors, each knows a credential's *pattern* AND how to *validate it against the provider API*. Classifies findings as **active / inactive / indeterminate**. Two-phase: regex/entropy candidate → live verification.
- **Gitleaks**: 150+ regex patterns + entropy; **no live verification**.
- Common evaluation categories: **API Keys, Private Keys, Database credentials, Usernames, Generic Secrets** (8-category models in literature).
- Takeaway for devassets: the high-value differentiator is **verification** (active/expired/wrong-scope), which is exactly the `identity` layer's direction — and what gitleaks deliberately lacks.

### Public vs secret env vars (Next.js model)

- `NEXT_PUBLIC_*` is compiled into the client bundle — inspectable by anyone. Only endpoints, feature flags, analytics/OAuth client IDs belong there.
- Non-prefixed vars are server-only.
- Best-practice consensus (Doppler, GitGuardian): **env vars are for non-sensitive config; real secrets belong in a secrets manager.** devassets should position as the *map/health layer*, not the vault.

### Token TYPE: client (publishable) vs server (secret)

This is the root of the mindset 404.

| Provider | Client-side (publishable, safe in source) | Server-side (secret) |
|---|---|---|
| Stripe | `pk_` publishable | `sk_` secret, `rk_` restricted |
| Paddle | client-side token (`test_`/`live_`) — checkout/pricing only | API key (`pdl_live_`/`sdbx_apikey_`) — full data access |
| Supabase | anon key (public, RLS-guarded) | service_role key (bypasses RLS) |

- **Implication**: a token's correct *location* and *risk* depend on its TYPE. A Paddle client token in source is correct; a Paddle API key in source is a breach. devassets checking a client token against the server webhooks endpoint → 404 → currently mislabeled "invalid/expired."

### Validity verification

- Providers expose identity/validation endpoints (Supabase `getUser()`, Vercel `/v2/user`, npm whoami). 401/403 ⇒ invalid/expired; 200 ⇒ active + identity.
- Verification must distinguish **wrong token TYPE** (client token on server endpoint) from **invalid token** (expired/revoked) — different remediation.

---

## Part 3 — Proposed classification model (for discussion)

Two independent axes per credential:

### Axis A — Sensitivity
`public` (by design) · `secret` (server-side) · `identifier` (id/ref, non-sensitive)

Decision rules (in priority order):
1. `NEXT_PUBLIC_` / `PUBLIC_` / `VITE_` prefix ⇒ **public** (overrides everything)
2. `*_SECRET`, `*_PASSWORD`, `*_PRIVATE_KEY`, `SERVICE_ROLE`, server `*_API_KEY`, `*_ACCESS_TOKEN`, `DATABASE_URL`/`DIRECT_URL` ⇒ **secret**
3. `*_CLIENT_ID`, `*_PRICE_ID`, `*_PRODUCT_ID`, `*_SELLER_ID`, `*_TEAM_ID`, `*_LIFF_ID` ⇒ **identifier**
4. else ⇒ config (low)

### Axis B — Storage location (where the secret actually lives)
`local-env` · `cloud-platform` (Vercel/Supabase dashboard env) · `ci-secret` (GitHub Actions) · `runtime-user` (end-user enters at runtime) · `source-public` (publishable, committed) · `external-vault`

- This is what solves "GitHub can't be verified from here" and "desktop tokens aren't local": devassets **annotates** where each secret should live, rather than demanding everything be in `.env`.
- Missing-detection only fires for `local-env` secrets. `cloud-platform`/`ci-secret`/`runtime-user` get an informational badge ("managed in Vercel", "GitHub secret", "user-provided at runtime"), never a false "missing".

### Axis C — Project form → default expectations
Map `type` (already in schema) to a default secret-location profile:

| Form | Default secret location | `.env` missing-check |
|---|---|---|
| web-ssr | local-env + cloud-platform | on |
| desktop | source-public (client) + runtime-user + ci-secret | off for runtime secrets |
| mobile | ci-secret + keystore | off |
| backend | local-env | on |
| library/cli | ci-secret | off |
| unity/native | external | off |

### Delivery mechanism options (pick in discussion)
1. **Heuristic-only** — ship the Axis-A prefix fix now (cheap, removes false positives immediately).
2. **`.devassets.yml` per project** — declares form + per-key location/type overrides; precise but needs user setup.
3. **Hybrid** — heuristics as default, `.devassets.yml` for overrides. (Recommended starting point.)

---

## Part 4 — Open questions for our discussion

1. **Scope of v1**: just the Axis-A public/secret fix (quick win), or the full location-annotation model?
2. **`.devassets.yml`**: worth the per-project setup cost, or keep it zero-config heuristic?
3. **Monorepo**: support multiple env roots per project (e.g. `paths: [web/, api/]`)?
4. **Verification depth**: how far to push live validity checks (active/expired/wrong-type) given each needs a provider-specific detector like TruffleHog's 800?
5. **Cloud-managed secrets**: should devassets optionally connect to Vercel/Supabase APIs to *list* what env vars are set cloud-side (closing the "GitHub can't verify" gap for cloud platforms that DO have APIs)?

---

## Sources

- [TruffleHog](https://github.com/trufflesecurity/trufflehog) · [TruffleHog vs Gitleaks (Jit)](https://www.jit.io/resources/appsec-tools/trufflehog-vs-gitleaks-a-detailed-comparison-of-secret-scanning-tools) · [Secret scanners comparison 2026](https://devsecops.ae/secrets-scanners-comparison-2026/) · [A Comparative Study of Secret Detection Tools (arXiv)](https://arxiv.org/pdf/2307.00714)
- [Next.js env vars: public vs private (Configu)](https://configu.com/blog/next-js-environment-variables-built-in-public-and-private/) · [Next.js env security guide 2025](https://www.hashbuilds.com/articles/next-js-environment-variables-complete-security-guide-2025) · [Are env vars still safe for secrets in 2026 (Doppler)](https://www.doppler.com/blog/environment-variable-secrets-2026)
- [Stripe API keys](https://docs.stripe.com/keys) · [Paddle authentication](https://developer.paddle.com/api-reference/about/authentication/) · [Paddle client-side tokens](https://developer.paddle.com/api-reference/client-tokens/overview)
- [Supabase JWTs](https://supabase.com/docs/guides/auth/jwts)
