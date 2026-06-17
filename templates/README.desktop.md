# [App Name]

> [One-line tagline]

[![Version](https://img.shields.io/github/v/release/0xRyanlee/[public-repo])]()
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

[Screenshot — the app in action. Required.]

---

## Download

| Platform | Link |
|---|---|
| macOS (Apple Silicon) | [Download .dmg](https://github.com/0xRyanlee/[public-repo]/releases/latest) |
| macOS (Intel) | [Download .dmg](https://github.com/0xRyanlee/[public-repo]/releases/latest) |
| Windows | [Download .exe](https://github.com/0xRyanlee/[public-repo]/releases/latest) |

> This is the **public release repo**. App source code is in the private repo.

---

## What It Does

[2–3 sentences from the **user's perspective**.]

**Key features:**
- Feature A
- Feature B
- Feature C

---

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Tauri 2 |
| Frontend | Next.js 15 / React / Tailwind |
| Backend | Rust (Tauri commands) |
| Storage | SQLite (local-first) |
| Payment | Paddle (license key / subscription) |
| Build | GitHub Actions → release artifacts |

---

## Building from Source

> Source code is in the **private** repo: `github.com/0xRyanlee/[private-repo]`
> 
> This repo contains only release artifacts and documentation.

If you have access to the source:

```bash
git clone https://github.com/0xRyanlee/[private-repo]
cd [private-repo]
pnpm install
pnpm tauri dev      # development
pnpm tauri build    # production build
```

**Prerequisites:** Rust 1.80+, Node.js 20+, pnpm

---

## Release Process

Releases are automated via GitHub Actions on tag push:

```bash
git tag v1.0.0 && git push --tags
# → builds macOS + Windows artifacts
# → publishes to this repo's Releases
```

---

## Pricing

| Plan | Price | Features |
|---|---|---|
| Free | $0 | [core features] |
| Lifetime | $49.9 | [premium features, no watermark] |
| AI Subscription | $9.9–12.9/mo | [AI features] |

Payments via **Paddle** — handles VAT/GST, no account required.

---

## Project Management

Linear: [Project Name](https://linear.app/things-need-to-be-done/project/[slug])

---

## License

MIT © [Ryan Li](https://github.com/0xRyanlee)
