# takkar.info website

The public website for Takkar, built from the "Landing page" artboard in the design canvas. Plain HTML, CSS and a little JavaScript, hosted on Cloudflare Pages. The early-access form saves emails to a D1 database through one Pages Function.

```
public/              everything served at takkar.info
  index.html         landing page
  privacy.html  terms.html  refunds.html  contact.html  404.html
  assets/            styles.css, site.js, self-hosted fonts, og-image.png
  _headers           security headers (SEC-15) and caching
  .well-known/security.txt
functions/api/waitlist.js   POST /api/waitlist
schema.sql           D1 table for the early-access list
wrangler.toml        Pages + D1 config
```

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

## Deploy

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
