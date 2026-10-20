# Takkar (टक्कर)

**Roz ek takkar.** A four-minute daily quiz duel for SSC, banking and railway aspirants aged 18 and over: ten Quant and Reasoning questions, exam-style marking, a rival, step-by-step solutions, friend challenges, squads and educator leagues. No cash prizes and no betting, ever.

Status: early prototype (Phase 1, October 2026).

## What is in this repository

| Folder | What it is | Stack |
| --- | --- | --- |
| [`website/`](website/) | The public site for takkar.info, with the early-access form | HTML, CSS, a little JavaScript; Cloudflare Pages + a Pages Function + D1 |
| [`app/`](app/) | The playable prototype: question engine, duels, challenges, league demo, squads, ranks | Plain JavaScript web app, packaged as an Android APK with Capacitor 7 |
| [`server/`](server/) | The admin console and its API (the player API comes next) | Cloudflare Workers + D1, Web Crypto, no framework |
| [`marketing/`](marketing/) | App screenshots, Play Store images, social posts, educator pitch, banners | PNG and PDF, generated from the app |

Everything runs on free tiers: Cloudflare Pages, Workers and D1.

## Quick start

```
# Website preview
cd website && python scripts/serve.py              # http://localhost:8787

# App in a browser, and its tests
cd app && npm install && npm test && npm run serve # http://localhost:8790

# Admin console
cd server && npm install && npm run db:migrate:local && npm run seed:local && npm run dev
node scripts/bootstrap-owner.mjs --local you@example.com "Your name"   # prints a setup link
```

Each folder's README has the details, including how to build the APK and how to deploy.

## Quality checks

- Question engine release test: 100,000 generated questions per level, 0 defects (`cd app && npm test`).
- Challenge codes: every single-character edit is rejected.
- Admin API: 80 checks covering sign-in with authenticator codes, roles, CSRF, rate limits and the append-only audit log (`cd server && npm test`, on its own throwaway database).

## Secrets

Never committed: `server/.dev.vars` (admin encryption key), `app/android/takkar-release.jks` and `app/android/keystore.properties` (APK signing). Keep backups of these outside Git.

Takkar is independent and not affiliated with any exam-conducting organisation.
