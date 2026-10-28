# Takkar marketing kit

Screenshots and promotional images made from the working prototype (October 2026). `OVERVIEW.png` shows everything on one sheet.

Every image follows the marketing rules in the docs: no promise of selection, ranks or results; no invented player numbers; no exam-body logos; competitors named only by category. Names in the screens (Riya, Rohit, "SSC Maths with Rahul") are samples.

## What is where

| Folder | File | Size | Use it for |
| --- | --- | --- | --- |
| `screenshots/` | 01 to 14 | 1236 × 2745 | Raw app screens at 3× phone resolution, for decks, chats, the website and making new designs |
| `store/` | 01 to 08 | 1080 × 1920 | Play Store phone screenshots, in this order |
| `store/` | feature-graphic-1024x500 | 1024 × 500 | Play Store feature graphic |
| `social/` | post-01 to post-05 | 1080 × 1080 | Instagram and Telegram channel posts |
| `social/` | why-takkar-is-different-1080x1350 | 1080 × 1350 | Instagram portrait post: how Takkar compares |
| `social/` | story-01, story-02 | 1080 × 1920 | Instagram and WhatsApp status, YouTube Shorts covers, vertical screens |
| `educators/` | educator-one-pager.pdf | A4 | Send after the first outreach message or demo call |
| `educators/` | educator-pitch-1080x1350 | 1080 × 1350 | WhatsApp or Telegram image for educators |
| `display/` | hero, how-it-works, why-takkar-is-different, educator-banner | 1920 × 1080 | TVs and screens at coaching centres, slides, YouTube end screens |
| `brand/` | logo-mark-1024, logo-horizontal-on-light/dark | transparent PNG | Anywhere the logo is needed |
| `brand/` | profile-picture-1080 | 1080 × 1080 | Telegram, Instagram, YouTube and WhatsApp profile picture |
| `brand/` | channel-banner-2560x1440 | 2560 × 1440 | YouTube channel art (text sits in the safe middle area) |
| `brand/` | app-icon-512, website-share-image-1200x630 | | Play Store icon; link preview image |

## What makes Takkar different (the message in these images)

1. **A four-minute daily habit**, not another full course: ten questions, one rival, every day.
2. **Marked like the real paper**: +4, −1, 0 skipped, so aspirants learn when to skip.
3. **Every answer solved step by step**, calculated by our own engine, never copied.
4. **Friends play the same ten questions** through a challenge code on WhatsApp or Telegram.
5. **Educator leagues**: one shared daily duel per channel, a weekly table and a Monday report, with no extra work.
6. **Squads of eight**, invite-only, with preset reactions and no chat.
7. **Trust**: no cash prizes or betting, ranks can't be bought, no phone number or contacts, data can be downloaded or deleted.

## Ready-to-post captions

**post-01, story-01:** Roz ek takkar. Ten Quant and Reasoning questions, one rival, about four minutes a day. Free for aspirants aged 18 and over. Early access: playtakkar.in

**post-02:** Practise the way the paper marks you: +4 right, −1 wrong, 0 skipped. Guessing has a cost, so you learn when to skip.

**post-03:** No cash prizes. No betting. Ever. You play for practice, streaks and rank, and ranks can't be bought.

**post-04:** Finished your duel? Send the code. Your friend plays the same ten questions and tries to beat your score.

**post-05:** Every wrong answer comes with the method, step by step, so tomorrow's question feels familiar.

**why-takkar-is-different:** Keep your course and your mocks. Takkar is the daily practice you actually come back to.

**Educators (with educator-pitch or the PDF):** Your channel can have its own Takkar league: one daily duel for all your students, a weekly table and a Monday report on who is practising. Free 8-week pilot. Students must be 18 or older. Write to educators@playtakkar.in.

## Before posting

- Set up the email addresses shown (educators@playtakkar.in) before sharing the educator material.
- The PRD's open decision 1 (name, domain, handles and trademark checks) should close before any public post.
- Plus is shown at the ₹99 test price. Change the images if the price changes.

## Making new versions

`_source/capture.mjs` captures the screenshots, `_source/render-promo.mjs` builds every design from them, and `_source/overview.mjs` puts them all on `OVERVIEW.png`. Both need `puppeteer-core`, Chrome, and a local server at the `Takkar` folder (`python -m http.server 8800`).
