# 6. Data and API changes

Same stack: Cloudflare Worker + D1 (free tier), the app and website on Vercel. Changes are additive (new tables and columns); existing data stays.

## 6.1 Exam patterns as data

A shared file `exams.js` (used by the app, the server and the admin) holds each exam's pattern: id, name, group, sections with question counts, minutes, marks, negative, seconds per question, topic weights, and status (live / coming). The admin can override numbers in **Settings → Exam patterns** without an app update (stored in `settings`, merged over the defaults, every change in the audit log).

## 6.2 New and changed tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| `users` (+ columns) | Player's exam and goals | `exam_id`, `exam_month`, `daily_goal`, `language`, `hide_from_global` |
| `rooms` (generalises `leagues` and `squads`) | Class rooms and study groups | `id, type (class/group), name, owner_id, exam_id, invite_code, join_rule, status, settings (json), created_at` |
| `room_members` | Membership | `room_id, user_id, role (owner/member), state (pending/member/removed/left), joined_at` |
| `questions` | Educator question bank | `id, owner_id, exam_id, section, topic, difficulty, text, options (json), answer_index, solution, version, status (draft/live/retired/hidden), rights_confirmed_at, created_at` |
| `tests` | A test in a room | `id, room_id, title, source (engine/bank/mix), seed, question_ids (json), opens_at, closes_at, seconds_per_question, marks, negative, show_solutions (after_submit/after_close), status` |
| `attempts` | One player's go at a test | `id, test_id, user_id, started_at, submitted_at, first (bool), score, right, wrong, skipped, time_ms` |
| `attempt_answers` | Each answer, server-timed | `attempt_id, q_index, question_id, version, choice, correct, served_at, answered_at` |
| `educator_requests` (exists) | Become an educator | add `links`, `subjects` |
| `question_reports` | Student reports on educator questions | `question_id, test_id, user_id, reason, status` |

`duels` stays for daily duels; later daily duels move to the same server-scored `tests` / `attempts` model.

## 6.3 New API (player)

| Method | Route | Does |
| --- | --- | --- |
| GET | `/api/exams` | Exam list and patterns (merged with admin overrides) |
| POST | `/api/me/profile` | Set exam, exam month, goal, language, nickname (checked) |
| GET | `/api/rooms` | My rooms |
| POST | `/api/rooms` | Create (class needs approved educator; group anyone) |
| GET | `/api/rooms/:code/preview` | Room name, educator, size, exam (for the invite page, no login needed) |
| POST | `/api/rooms/:code/join` | Join or request |
| POST | `/api/rooms/:id/members/:uid` | Approve, remove, mute (owner) |
| GET/POST | `/api/rooms/:id/tests` | List / create tests |
| POST | `/api/tests/:id/start` | Starts an attempt; returns the first question **without** the answer and the server deadline |
| POST | `/api/attempts/:id/answer` | Records an answer; returns the next question (and, if solutions are "after submit", the result) |
| POST | `/api/attempts/:id/submit` | Ends the attempt; returns score |
| GET | `/api/tests/:id/leaderboard` | Ranks (after close, or live counts during) |
| GET/POST | `/api/questions` | Educator bank: list / create |
| POST | `/api/questions/upload` | CSV/Excel rows → per-row check results; import valid rows |
| POST | `/api/questions/:id/report` | Student reports a question |

## 6.4 Security and fairness

- Room questions and answers never leave the server in bulk; one question at a time, answer key never sent until results open.
- Server is the clock: `served_at` / `answered_at` from the server; answers after the deadline are skipped.
- One counted attempt per player per test, enforced in the database (unique index on test + user where `first`).
- Rate limits on joins, uploads and answers; upload size limits; text checked against the word filter.
- Educator actions in the admin audit log; room takedowns logged with reason.

## 6.5 Admin additions

Rooms (list, search, close/reopen with reason), Educator applications (approve/reject), Question moderation (reported and hidden questions), Exam patterns editor, room and question counts on Overview.

## 6.6 Free-tier check

D1 free: 5 million rows read and 100,000 written per day. A 25-question room test for 300 students writes about 300 × 27 ≈ 8,100 rows; 10 such tests a day ≈ 81,000. That is close to the free limit at that scale, so at around 300 active students taking daily tests we move to Workers Paid ($5/month, 50 million writes). Before that, the free tier is enough for the beta.
