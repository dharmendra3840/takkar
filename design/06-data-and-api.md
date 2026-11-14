# 6. Data and API changes

Same stack: Cloudflare Worker + D1, the app and website on Vercel. **New: Cloudflare Durable Objects** for the two live features (friend duels and rooms). Durable Objects with SQLite storage are on the Workers Free plan (100,000 requests a day; idle WebSocket connections hibernate and are not billed for duration), so this stays free in the beta.

## 6.1 Exam patterns as data

`exams.js`, shared by app, server and admin: id, name, group, sections, question counts, minutes, marks, negative, seconds per question, topic weights, status (live / coming). Admin overrides in Settings → Exam patterns (stored in `settings`, audit-logged). Launch: `ssc-cgl`, `ibps-po`, `rrb-ntpc`; from app 0.6.0 also `ssc-chsl`, `ssc-gd`, `ibps-rrb`, `rrb-group-d` (`01-exam-patterns.md` §1.6).

Scores become fractional (−0.25, −⅓). The server stores scores in **twelfths** (integers: 12 = one mark), so −⅓, −0.25 and −0.5 are all exact; the app shows two decimals.

## 6.2 Tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| `users` (+) | Exam and goals | `exam_id, exam_month, daily_goal, language, hide_from_global` |
| `duels` (+) | Exam per duel; friend duels | `exam_id, opponent_id, live (bool)` |
| `squads` (rework) | Study groups | `id, name, exam_id, owner_id, invite_code, status, created_at` |
| `squad_members` | | `squad_id, user_id, role, joined_at, state` |
| `leagues` (exists) | Educator leagues | + `exam_id, max_members (100)` |
| `league_members` (exists) | | `state: pending / member / removed / left` |
| `rooms` | Live tests | `id, league_id (nullable), owner_id, title, exam_id, source, question_ids (json) or seed, starts_at, lobby_opens_at, ends_at, grace_s, seconds_per_q, marks_x12, negative_x12, access (league / link), invite_code, max (100), status` |
| `room_entries` | Joined before the start | `room_id, user_id, joined_at, submitted_at, score_x12, right, wrong, skipped, time_ms` |
| `room_answers` | Each answer, server-timed | `room_id, user_id, q_index, question_id, version, choice, correct, served_at, answered_at` |
| `questions` | Educator bank | `id, owner_id, exam_id, section, topic, difficulty, text, options (json), answer_index, solution, version, status, rights_confirmed_at` |
| `question_reports` | | `question_id, room_id, user_id, reason, status` |
| `educator_requests` (exists) | Applications | + `links, subjects, exam_id` |
| `friend_duels` | Live / challenge | `id, code, exam_id, seed, host_id, guest_id, status (lobby/live/done/challenge), created_at, expires_at` |

## 6.3 Live parts (Durable Objects)

- **`DuelRoom` object**, one per friend duel: holds the two WebSocket connections, the ready state, the start time, each player's progress; sends "opponent score" updates; writes the result to D1 at the end. Times out the lobby after 10 minutes and converts to a challenge.
- **`TestRoom` object**, one per room: lobby (joined list, count), the start signal at `starts_at`, serves question N to each player after their answer to N−1, enforces the deadline, live joined/submitted counts for the educator, writes entries and answers to D1, computes ranks at the end.
- Clients connect with a short-lived ticket from the API (signed, tied to the player's session), so WebSockets are authenticated without cookies.
- **Fallback:** if a WebSocket cannot connect (some networks), the app polls the same object over HTTPS every 2 seconds.

## 6.4 API (player)

| Method | Route | Does |
| --- | --- | --- |
| GET | `/api/exams` | Exam patterns (with admin overrides) |
| POST | `/api/me/profile` | Exam, month, goal |
| POST | `/api/me/nickname`, `/api/me/username` | Change the nickname (every 7 days) or the user ID (every 30 days), §6.7 |
| GET | `/api/username?u=` | Is this user ID free? With a free suggestion when it isn't |
| POST | `/api/duels/friend` | Create a friend duel → code, link |
| GET | `/api/duels/friend/:code` | Preview (host, exam) and a ticket to connect |
| WS | `/api/live/duel/:code` | Live duel channel |
| GET/POST | `/api/squads`, `/api/squads/:code/join`, `/api/squads/:id/members/:uid` | Squads |
| GET | `/api/squads/:id/today` | Today's squad duel and table |
| GET/POST | `/api/leagues`, `/api/leagues/:code/join`, `/api/leagues/:id/members/:uid` | Leagues (create: approved educators) |
| GET/POST | `/api/rooms`, `/api/rooms/:id` | List / create / cancel (educators) |
| POST | `/api/rooms/:id/rsvp` | "I'll be there" |
| WS | `/api/live/room/:id` | Lobby, join, questions, answers (join refused after `starts_at + grace`) |
| GET | `/api/rooms/:id/results` | After the end: rank, solutions; educator: full analysis |
| GET/POST | `/api/questions`, `/api/questions/upload` | Educator bank; sheet upload with per-row checks |
| POST | `/api/questions/:id/report` | Student report |
| POST | `/api/educators/apply` | Application |

## 6.5 Security and fairness

- Room and friend-duel questions are served one at a time; the answer key never leaves the server before results.
- The server is the clock; the join cut-off is enforced by the `TestRoom` object, not the phone.
- One entry per player per room (unique index); one result per player per friend duel.
- Educator and admin actions audit-logged; room cancellations and question removals logged with reason.
- Rate limits on creating duels, joining, uploads; text through the word filter.

**Security review, 14 November 2026.** All 102 endpoints were called without signing in, with forged tokens and with forged admin cookies. Only the three public ones answered (config, sign-out, the user ID check), and none failed with a server error. Code reviews of the player API, the admin console and the app found no access holes between squads, leagues or tests, and no XSS. Fixed:
- **Admin 2-step sign-in:** one live code challenge per admin (a new sign-in replaces it). Each try at the code is claimed in one statement, so parallel guesses can't share tries. The code check is rate-limited by IP and email. A code's time step is used up in the same statement that checks it is new, so one code opens one session.
- **Admin setup links:** a new link kills any earlier unused one. Finishing setup kills them all. A link only works while the admin is still setting up. Scanning the QR code is audit-logged.
- **Duel scores:** an uploaded duel counts on a table only if its own numbers agree: each answer's points follow its marking, and the score and skips add up. A squad duel must also match the questions the server makes from the seed (the same types in order), with each answer right exactly when it picked the right option in that player's order. A duel that fails is kept (streaks, history) but not counted, so older apps never get stuck uploading.
- **Live test tie-break:** the time is the server's clock from start to submit. The seconds the phone reports per question only feed the insights.
- **Question flags:** auto-pause counts distinct signed-in players. Guest flags still reach the moderators, but can't pause a type on their own.
- Smaller fixes: exam and report-kind checks use own properties only (`exam: "constructor"` used to pass). Friend-duel code lookups are rate-limited. CSV exports (audit log, tutor's student list) put `'` before text starting with `= + - @`. The Android file sharing scope is the cache only.
- **Closed leagues:** closing a league (by the tutor, an admin, or the tutor deleting their account) cancels its tests not yet started, so students' reminders go too. A test in a closed league takes no new students. Account deletion also removes the player's live duel tickets.
- Build tools: wrangler 4.147 → 4.162 and `npm audit fix` in the app, so both now report 0 vulnerabilities. Capacitor 8 is a major upgrade, left for its own release.

## 6.6 Free-tier check

- A 25-question room for 100 students: about 2,600 D1 row writes and about 5,000 WebSocket messages (counted 20 to 1 as requests, so about 250). Ten rooms a day stays well inside the free limits.
- A live friend duel: about 40 messages (2 requests) plus 22 row writes.
- When daily active players reach a few thousand, we move to Workers Paid ($5/month).

## 6.7 Nicknames and user IDs (decided 3 Nov 2026)

A **nickname** is the name other players see. It doesn't need to be unique: many players can be "Rohit". Letters and numbers, 3 to 12, through the word filter.

A **user ID** identifies a signed-in account and is unique: lowercase letters and numbers, 3 to 15, at least one letter (for example `rohit12`). It is asked at first sign-in with a free suggestion filled in, and can be changed once every 30 days. Where two players could share a nickname (squad and league member lists, reports), the app shows the user ID beside it.

Guests have only a nickname, kept on their device; nothing is checked for uniqueness because nothing is stored on the server.

Storage: `users.nickname` (unique, from migration 0001) now holds the **user ID**, lowercased by migration 0009; the nickname people see is `users.display_name`, filled from the old nickname so nobody's visible name changed. Changing the unique column in place avoids rebuilding the users table, which every other table refers to.

Apps before 0.6.0 send only a nickname when an account is created; the server then picks a free user ID from it.
