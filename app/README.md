# Takkar app (beta 0.2.0)

A web app (plain HTML, CSS and JavaScript, as the SRS says) that runs two ways: in the browser at takkar.vercel.app/play (copied into the website by `website/scripts/sync-play.mjs`, installable to the home screen, works offline) and as an Android APK with Capacitor 7. Duels run on the phone and work offline. From 0.2.0 the app talks to the Takkar server (`../server`, the same Worker as the admin console):

- **Sign-in:** Google or phone number (OTP) through Firebase, or play as a guest. Guests' games stay on the phone only; nothing about them is sent to the server. Signing in later moves the guest's games into the account.
- **What the admin controls reaches the app:** pause everything, duel/league/squad switches, the free-duel limit, announcements, paused question types, Plus granted, renames, suspensions and bans, and "update available / update required" by build number. The app checks on start and whenever it comes back to the screen (at most every 5 minutes).
- **What the app sends:** signed-in players' duels (queued when offline), reports from the in-app form, and flagged questions (guests may send reports and flags, without a name).

## What works

| Area | What the prototype does | Requirement IDs |
| --- | --- | --- |
| Opening | Native splash, then the intro: "tak" and "kar" collide into the logo (full on first open, short after, still with reduce motion, tap to skip) | UX-04 |
| Onboarding | Google, phone OTP or guest; nickname with word filter (real names like Harshita pass), 18+ confirmation, straight into the first duel | ONB-01 to ONB-05, UX-08 |
| Question engine | 30 Quant and Reasoning templates, every answer calculated in code, 3 tiers per level | QGEN-01 to QGEN-05 |
| Duel | 10 questions, 20/30/35 s timer by level, tap or keys A–D/1–4, skip in exam marking, leave = abandoned | DUEL-01 to DUEL-09 |
| Scoring | Exam marking (+4/−1/0) and speed duel (10 + speed bonus), ties by total time | SCORE-01, SCORE-02, SCORE-04 |
| Rival | Bot always labelled as a bot, three strengths | DUEL-06 |
| After each answer | Right/wrong with icon and word, correct option, solution steps, what the rival did, flag button | DUEL-04, ACC-02, QGEN-06 |
| Challenges | Code with a tamper check, shared through the phone's share sheet, friend plays the same questions, 7-day expiry | CHAL-01 to CHAL-04 |
| Educator league demo | Channel name → branded league, invite code, daily duel (same for everyone, new at midnight IST), weekly table (first attempt only), Monday report | LEAG-01 to LEAG-05 |
| Squad | Night Owls with weekly mission and 6 preset reactions, no free text | SQUAD-01 to SQUAD-03 |
| Ranks and streaks | Weekly ranks (best 3 exam duels a day, reset Monday IST), IST-day streaks | RANK-01, RANK-02, STRK-01 |
| Plus | Honest paywall shown on the 4th free duel; "Try Plus" turns on a labelled demo, no payment | PLUS-08 |
| Profile | Accuracy and speed by topic, badges, account card, sign out, in-app report form, data download, delete account (server and phone) | PROF-01 to PROF-03 |

Sample people (squad mates, other ranked players, league students) are labelled as samples on every screen. Your own scores, streak and answers are real.

## Speed on low-cost phones (UX-04, UX-05)

The app opens in a light mode (solid tinted panels, no blur) so the first screen paints fast on any phone, then times its own frames once and turns on the glass effects only if the phone draws at 50 fps or better. The choice is remembered. The Takkar splash stays up until the first screen is on display.

## Older phones

Android 6 or newer, with Android System WebView 80 or newer (2020). Keep it that way: write JavaScript no newer than ES2020 (no `??=`, `.at()` or `replaceAll`), give every `dvh` a `vh` line before it, and write `top/right/bottom/left` instead of `inset`. A script that does not parse leaves old phones on a blank screen, so check before a release by parsing `www/js` at ES2020 (for example with acorn, `ecmaVersion: 2020`).

## Not in the beta yet

Real multiplayer, real leagues and squads (still demos with sample players), payments, reminders and emails, Hindi. Duels are worked out on the phone and the server stores the results, so a determined player could fake a score; the MVP moves duels to the server (SEC-11). Challenge codes use an in-app tamper check; the MVP replaces it with server-signed codes (SEC-12).

## Turning on Google and phone sign-in (one-time, Firebase)

Without these steps the app works with guest play only, and the sign-in buttons say "being set up".

1. In the [Firebase console](https://console.firebase.google.com), add a project (Analytics not needed).
2. **Authentication > Sign-in method:** enable **Google** and **Phone**. For beta testing, add test numbers with fixed codes under *Phone numbers for testing* (no SMS is sent, free). Real SMS needs the pay-as-you-go Blaze plan.
3. **Project settings > Add app > Android**, package name `info.takkar.app`. Add these fingerprints (release key, then the debug key for test builds):
   - Release SHA-1 `F0:F6:77:51:8A:4D:5B:4D:CA:5C:06:97:8D:5C:73:A0:21:A9:B0:DE`
   - Release SHA-256 `95:00:4C:CE:A9:79:9F:78:C6:B2:CA:38:FC:2D:BC:0D:24:75:F8:19:3B:94:26:48:10:C5:20:3D:9F:73:D0:AB`
   - Debug SHA-1 `21:74:36:37:57:07:58:06:95:E7:08:07:96:25:3B:4D:76:22:9D:DD`
   - Debug SHA-256 `85:7D:C4:21:BE:57:32:FB:E5:D2:BB:ED:67:E4:AE:98:4B:03:EB:F8:67:81:30:C1:0D:00:A4:65:77:1C:3D:42`
4. Download `google-services.json` into `android/app/` (it is not committed), then `npm run sync` and build.
5. Put the Firebase **Project ID** in `../server/wrangler.jsonc` (`FIREBASE_PROJECT_ID`) and deploy the server. The app turns the sign-in buttons on when the server says sign-in is set up.
6. For sign-in on the web: **Project settings > Add app > Web**, then copy its `apiKey` and `appId` into `FIREBASE_WEB_API_KEY` and `FIREBASE_WEB_APP_ID` in `../server/wrangler.jsonc`, and add `takkar.vercel.app` (and later `takkar.info`) under **Authentication > Settings > Authorized domains**. Deploy the server again.

## Commands

```
npm install
npm test            # engine release test: 100,000 questions per level, plus challenge-code tests
npm run serve       # open http://localhost:8790 in Chrome (phone size) to try it in a browser
                    # it uses the live server; for a local one set localStorage 'takkar.api' to 'http://127.0.0.1:8788/api'
npm run sync        # copy www/ into the Android project after any change
```

Before a new release, raise `APP_BUILD` and `APP_VERSION` in `www/js/config.js` and `versionCode`/`versionName` in `android/app/build.gradle` together, then set the admin's "Latest app build" so older phones see *Update available*.

Build the APK (uses Android Studio's JDK 21):

```
cd android
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
gradlew.bat assembleRelease     # signed, for sharing (needs keystore.properties)
gradlew.bat assembleDebug       # quick test build (WebView debugging on; release builds have it off)
```

The release APK lands in `android/app/build/outputs/apk/release/`.

## Signing

`android/keystore.properties` and `android/takkar-release.jks` sign the release APK. They are not committed. Keep a backup of both: every future update must be signed with the same key, or phones will refuse to install it over the old version.
