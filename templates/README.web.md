# [Project Name]

> [One-line tagline — what it does, for whom]

[![Status](https://img.shields.io/badge/status-active-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Live](https://img.shields.io/badge/live-[domain]-orange)]()

[Screenshot or demo GIF — the most important element. No screenshot = no README.]

---

## What It Does

[2–3 sentences from the **user's perspective**. What problem does it solve? Who uses it?]

**Key features:**
- Feature A — what it enables
- Feature B — what it enables
- Feature C — what it enables

**Live:** [https://your-domain.com](https://your-domain.com)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 / React 19 / Tailwind v4 |
| Backend | Supabase / Cloudflare Workers |
| Auth | Supabase Auth / Clerk |
| Payment | Paddle |
| Analytics | GA4 (`G-XXXXXXXXXX`) |
| Deployment | Vercel |

---

## Local Development

**Prerequisites:** Node.js 20+, pnpm

```bash
git clone https://github.com/0xRyanlee/[repo]
cd [repo]
pnpm install
cp .env.example .env.local   # fill in required vars
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_GA_ID` | Yes | Google Analytics 4 measurement ID |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Yes | Paddle client-side token |
| `PADDLE_WEBHOOK_SECRET` | Yes | Paddle webhook signing secret |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key |

Full list: see `.env.example`.

---

## Deployment

Deployed on **Vercel**. Every push to `main` triggers a production deploy.

```bash
vercel --prod   # manual deploy
```

**Domains:** `[domain.com]` → Vercel project `[project-name]`

---

## Analytics & CTA

- **GA4**: `G-XXXXXXXXXX` — tracks pageview, `cta_click`, `purchase`
- **Waitlist**: `/api/waitlist` — stores emails in Supabase `waitlist` table
- **Paddle**: product `pro_XXXXX`, prices `pri_XXXXX` (monthly) / `pri_XXXXX` (annual)

---

## Project Management

Linear: [Project Name](https://linear.app/things-need-to-be-done/project/[slug])

---

## License

MIT © [Ryan Li](https://github.com/0xRyanlee)
