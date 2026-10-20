# Takkar server: API and admin console

One Cloudflare Worker serves the admin console (`/admin/`) and its API (`/admin/api/*`), with a Cloudflare D1 (SQLite) database. It also serves the player API (`/api/*`) the app uses. Everything fits the free tiers: Workers Free (100,000 requests a day) and D1 Free (5 GB, 5 million rows read a day).

## Player API (app beta 0.2.0)

| Route | Who | What |
| --- | --- | --- |
| `GET /api/config` | anyone | Pause, switches, free-duel limit, announcements, paused question types, latest and minimum app build, whether sign-in is set up (cached 30 s) |
| `POST /api/auth/firebase` | anyone | Swaps a Firebase ID token (Google or phone) for a Takkar session; first sign-in also sends nickname and 18+ |
| `GET /api/me` | signed in | Profile, Plus, streak; `?history=1` returns recent duels for a new phone |
| `POST /api/duels` | signed in | Up to 50 finished or abandoned duels, checked and stored once each; rebuilds the streak |
| `POST /api/reports` | anyone | Report a problem or a player (lands in the Reports queue) |
| `POST /api/flags` | anyone | Flag a question; too many flags in 24 h pauses the question type automatically |
| `POST /api/auth/logout`, `POST /api/account/delete` | signed in | Sign out; delete the account and its data |

Sign-in tokens are checked against Google's public keys (RS256, audience, issuer, expiry) with Web Crypto, no Firebase SDK. Sessions are random tokens stored only as SHA-256, 90 days, sliding. Only the last 4 digits of a phone number are stored. Suspended and banned players get 403 with the end date. Rate limits use hashed IPs that change daily. CORS allows only the app (`https://localhost`).

## What the console does

| Area | Owner | Moderator | Requirement |
| --- | --- | --- | --- |
| Overview: duels today, active players, day-1 and day-7 return, share rate, Plus, 14-day trend, queues | ✓ | ✓ | ADMIN-09 |
| Free-tier usage (storage; live requests and reads with an optional Cloudflare API token) | ✓ | | NFR-13 |
| Players: search, profile, speed check, warn, mute, rename, reset scores, suspend, restore | ✓ | ✓ | ADMIN-03, MOD-04 |
| Players: ban, delete account and data, export data, grant or remove Plus | ✓ | | ADMIN-01, PROF-02, PROF-03 |
| Reports queue by severity, one-tap actions | ✓ | ✓ (not delete or ban) | ADMIN-04, MOD-05 |
| Question templates: flags, fresh samples, keep, pause, retire | ✓ | ✓ | ADMIN-05, QGEN-06 |
| Hand-written drafts that need a source and approval | ✓ | ✓ | QGEN-07 |
| Leagues: close and reopen; educators: approve or reject | ✓ | close only | ADMIN-10, LEAG-08 |
| Squads: close | ✓ | ✓ | |
| Switches, pause everything, free-duel limit, Plus price, size limits, flag thresholds, change history | ✓ | | ADMIN-06, ADMIN-07, PLUS-08 |
| Word filter | add and remove | add | MOD-02 |
| Announcement banner for everyone or one league | ✓ | | ADMIN-11 |
| Payments, full or partial refunds, coupons | ✓ | | PLUS-05, ADMIN-07 |
| Audit log, filters and CSV export | ✓ | | ADMIN-08 |
| Admin accounts: invite, change role, sign out, reset 2-step, disable | ✓ | | ADMIN-01 |

Security built in: password plus authenticator code on every sign-in, each code usable once, no SMS (SEC-01); sessions end after 30 minutes idle or 12 hours (SEC-02); roles checked on the server for every request (SEC-03); the audit log is append-only and the database refuses edits and deletes (SEC-04); HttpOnly, Secure, SameSite=Strict session cookie scoped to `/admin`; CSRF token and same-origin check on every change (SEC-18); sign-in rate limits and a 15-minute lock after 5 wrong passwords (SEC-08); strict security headers (SEC-15); parameterised queries only (SEC-19); authenticator secrets encrypted with AES-GCM; no third-party scripts (SEC-24).

## Run it on your laptop

```
npm install
npm run db:migrate:local          # create the tables
npm run seed:local                # optional: 150 sample players, reports, leagues
npm run dev                       # http://localhost:8788/admin/
node scripts/bootstrap-owner.mjs --local you@example.com "Your name"
```

Open the link the last command prints, choose a password, scan the QR code with Google Authenticator, Microsoft Authenticator or Authy, and type the code. Then sign in.

`npm test` runs 80 admin API checks and 66 player API checks on a separate throwaway database and server (port 8789), so your own local admin account is never touched. `npm run db:reset:local` empties and reseeds your main local database (you then need to create the owner again).

## Put it live (free)

1. `npx wrangler login`
2. `npx wrangler d1 create takkar` and paste the printed `database_id` into `wrangler.jsonc`.
3. `npm run db:migrate:remote`
4. Set the secret key that encrypts authenticator secrets (keep a copy somewhere safe; losing it means every admin re-enrols):
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` then `npx wrangler secret put TOTP_KEY`
5. `npm run deploy`
6. `node scripts/bootstrap-owner.mjs --remote you@example.com "Your name"` and open the link on your Worker's address.
7. For Google and phone sign-in, set `FIREBASE_PROJECT_ID` in `wrangler.jsonc` (see `../app/README.md`) and deploy again.
8. Optional secrets: `CF_ACCOUNT_ID` and a read-only `CF_API_TOKEN` (Account Analytics: Read) for live free-tier usage; `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to refund through Razorpay from the console.

Never run the seed or reset scripts on the live database; both refuse `--remote`.

## Files

```
src/index.js            router
src/lib/                crypto (passwords, TOTP, encryption), auth (sessions, roles, audit), settings, names
src/lib/firebase.js     checks Firebase sign-in tokens (Web Crypto)
src/routes/             auth, overview, players, reports, questions, community, config, money, admins, player (the app's API)
migrations/             0001 schema, 0002 defaults (generated from the app by scripts/gen-defaults.mjs), 0003 player API
public/admin/           the console: plain HTML, CSS and JavaScript, no framework
scripts/                bootstrap-owner, seed-demo, reset-local, gen-defaults
tests/api.test.mjs      80 admin checks against the local server
tests/player.test.mjs   66 player API checks (signs its own test tokens)
```

The question engine and the name rules are imported from `../app/www/js`, so the app and the server always agree.
