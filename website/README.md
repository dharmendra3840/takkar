# takkar.info website

The public website for Takkar, built from the "Landing page" artboard in the design canvas. Plain HTML, CSS and a little JavaScript. It deploys to either host:

- **Vercel** (current): the early-access form saves emails to Upstash Redis (free tier, via the Vercel Marketplace) through `api/waitlist.js`.
- **Cloudflare Pages**: the same form saves to a D1 database through `functions/api/waitlist.js`.

```
public/              everything served at takkar.info
  index.html         landing page
  privacy.html  terms.html  refunds.html  contact.html  404.html
  assets/            styles.css, site.js, self-hosted fonts, og-image.png
  _headers           security headers (SEC-15) and caching, for Cloudflare
  .well-known/security.txt
api/waitlist.js      POST /api/waitlist on Vercel (Upstash Redis)
vercel.json          Vercel settings: serve public/, clean URLs, the same headers as _headers
functions/api/waitlist.js   POST /api/waitlist on Cloudflare Pages (D1)
schema.sql           D1 table for the early-access list
wrangler.toml        Pages + D1 config
```

If you change a header, change it in both `vercel.json` and `public/_headers`.

## The web app at /play/

`public/play/` is a copy of the app (`../app/www`) so people can play in the browser, on any phone or computer, and add it to their home screen. Do not edit it by hand. After any app change:

```
node scripts/sync-play.mjs          # copy the app, add <base href="/play/"> and the web security policy
node scripts/sync-play.mjs --check  # fails if the copy is out of date; run before pushing
```

The copy also gets a build id (a hash of the app's files) on every script and stylesheet URL (`js/main.js?v=…`, and every relative import inside the modules), and `sw.js` gets the same id in its cache name plus a list of every file to save. So one visit is enough to play offline, and a browser can never run old and new modules together after a deploy.

`/play/` has its own headers in `vercel.json` (its policy also allows the Takkar server and Google's Firebase sign-in). Links into the app: `/play/?c=CODE` opens a friend's challenge, `/play/?open=plus` and `/play/?open=challenge` open those screens.

## Run it locally

Static preview, no caching, so every refresh shows your latest edits (the form shows an error because there is no database):

```
python scripts/serve.py
```

Then open http://localhost:8787. When you change `styles.css` or `site.js`, also bump the `?v=` number where the HTML links them, so visitors' browsers fetch the new file after a deploy.

Full preview, with the form working against a local D1:

```
npx wrangler@4 d1 execute takkar-web --local --file=schema.sql
npx wrangler@4 pages dev
```

## Deploy to Vercel

1. On vercel.com, **Add New > Project** and import the GitHub repo (private repos work).
2. Set **Root Directory** to `website`. Leave Framework as "Other" and the build command empty; `vercel.json` sets the output folder to `public`.
3. Deploy. The site is live at `https://<project>.vercel.app`.
4. In the project, **Storage > Create Database > Upstash for Redis** (free plan), connect it to the project, then **Redeploy** so the function picks up `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Until then the form shows an error (503).
5. Later, **Settings > Domains** to add `takkar.info`.

Sign-ups are in the Redis hash `waitlist` (email → `{adult_confirmed_at, notice_version, created_at}`). See them in the Upstash console's Data Browser, or run `HGETALL waitlist` in its CLI. Each visitor can sign up at most 10 times an hour; the counter key is a one-way hash of the IP and expires after an hour.

## Deploy to Cloudflare Pages

1. `npx wrangler@4 login`
2. `npx wrangler@4 d1 create takkar-web` and paste the printed `database_id` into `wrangler.toml`.
3. `npx wrangler@4 d1 execute takkar-web --remote --file=schema.sql`
4. `npx wrangler@4 pages deploy`
5. In the Cloudflare dashboard, add the custom domain `takkar.info` to the Pages project.
6. Add a rate-limiting rule for `/api/waitlist` (for example 10 requests a minute per IP) under Security > WAF.

## When the app has a link

Set `APP_URL` at the top of `public/assets/site.js` (for example `https://app.takkar.info`). The play buttons switch from "Get early access" to the design's labels ("Play today’s duel", "I have a challenge code", "Try Plus") and point at the app.

## Before going public

- Set up these addresses (Cloudflare Email Routing is free): hello@, support@, educators@, privacy@, grievance@, security@ takkar.info.
- Fill in the grievance officer's name on `contact.html`.
- The Privacy, Terms and Refunds pages are marked as drafts. A lawyer reviews them before the closed beta (Legal and compliance tab).
- Run the domain, social-handle and trademark checks for "Takkar" (open decision 1).
