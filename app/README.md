# Takkar prototype app

The Phase 1 prototype from the PRD, built as a web app (plain HTML, CSS and JavaScript, as the SRS says) and wrapped as an Android APK with Capacitor 7 for demos with aspirants and educators. It works fully offline; everything a player does is stored on the phone.

## What works

| Area | What the prototype does | Requirement IDs |
| --- | --- | --- |
| Onboarding | Nickname with word filter and reserved names, 18+ confirmation, straight into the first duel | ONB-01, ONB-02, ONB-04, ONB-05, UX-08 |
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
| Profile | Accuracy and speed by topic, badges, data download, delete everything | PROF-01 to PROF-03 |

Sample people (squad mates, other ranked players, league students) are labelled as samples on every screen. Your own scores, streak and answers are real.

## Speed on low-cost phones (UX-04, UX-05)

The app opens in a light mode (solid tinted panels, no blur) so the first screen paints fast on any phone, then times its own frames once and turns on the glass effects only if the phone draws at 50 fps or better. The choice is remembered. The Takkar splash stays up until the first screen is on display.

## Not in the prototype (by design, per the PRD)

Server, accounts and sign-in, real multiplayer, payments, reminders and emails, admin console, Hindi. Challenge codes use an in-app tamper check; the MVP replaces it with server-signed codes (SEC-12).

## Commands

```
npm install
npm test            # engine release test: 100,000 questions per level, plus challenge-code tests
npm run serve       # open http://localhost:8790 in Chrome (phone size) to try it in a browser
npm run sync        # copy www/ into the Android project after any change
```

Build the APK (uses Android Studio's JDK 21):

```
cd android
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
gradlew.bat assembleRelease     # signed, for sharing (needs keystore.properties)
gradlew.bat assembleDebug       # quick test build
```

The release APK lands in `android/app/build/outputs/apk/release/`.

## Signing

`android/keystore.properties` and `android/takkar-release.jks` sign the release APK. They are not committed. Keep a backup of both: every future update must be signed with the same key, or phones will refuse to install it over the old version.
