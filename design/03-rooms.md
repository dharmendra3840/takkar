# 3. Rooms (replaces the league and squad demos)

One idea instead of two: a **room** is a private group with its own tests and leaderboard.

| | Class room | Study group |
| --- | --- | --- |
| Created by | A verified educator | Any player |
| Size | Up to the admin's limit (default 500) | Up to 8 (as squads today) |
| Questions | Takkar engine, the educator's own, or both | Takkar engine only |
| Tests | Scheduled tests, daily duel, practice sets | One shared daily duel and a weekly mission |
| Leaderboard | Per test, weekly, all time | Weekly |
| Reactions | Educator announcements only | 6 preset reactions (as now), no chat |

## 3.1 Creating a class room (educator)

Six short steps, each one screen on a phone, one page with sections on a computer:

1. **Basics:** room name ("SSC Maths with Rahul"), exam (pre-selects the pattern), optional logo/initials colour.
2. **Who can join:** open with link · approval needed (default) · closed (no new members).
3. **Questions:** Takkar engine (pick topics and level) · my questions · both.
4. **Schedule:** daily duel at a time (e.g. 8 pm, same questions for all) · one test with an opening and closing time · always-open practice set.
5. **Rules:** marking and time per question (default from the exam), attempts (1 counts for rank; practice attempts allowed after the window), show solutions: after submit / after window closes (default).
6. **Review and share:** invite link `takkar.info/r/AB12CD`, code, QR to put on a slide, a ready WhatsApp/Telegram message.

## 3.2 Educator questions

Three ways in, all landing in the educator's **question bank**:

**a) Write one** (form): question text, 4 options, correct option, solution steps, topic (from the exam's syllabus list), difficulty (easy/medium/hard), optional explanation link. Live preview shows exactly how students will see it.

**b) Upload a sheet** (CSV or Excel, from a template we provide):

| question | option_a | option_b | option_c | option_d | answer | solution | topic | difficulty |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A train 150 m long … | 10 s | 12 s | 15 s | 18 s | B | Speed = … | Trains | medium |

After upload, every row is checked and shown in a preview table: green rows are ready, red rows say exactly what is wrong ("Row 14: answer must be A, B, C or D"). Only valid rows are imported. Up to 200 rows per upload.

**c) Reuse:** copy questions from another of their rooms, or add Takkar engine questions by topic.

Rules for educator questions
- **Private to the educator's rooms.** Students see a question only inside a test, one at a time, and the full set is never sent to the phone (the server sends the next question after the last answer). No "download questions" for students.
- **Ownership:** on first upload the educator confirms: "I wrote these questions or have the right to use them, and they are not copied from exam papers or paid material." Stored with the date. A copyright complaint can take a question or room down (admin action, logged).
- **Moderation:** word filter on text; students can report a question (goes to the educator, then to Takkar if unresolved); admin can hide any question or room.
- **Images** (diagrams, tables): phase 2 (needs file storage and checks).
- **Maths formatting:** plain text with simple symbols at first (², √, ÷, π); a small formula editor later.

## 3.3 Tests and scoring

- A test is a fixed list of questions (or an engine seed), a window (opens/closes), marking, and time.
- **Server-scored:** the server sends questions without answers, records each answer with its time, and scores. This is the change that makes room leaderboards trustworthy (today's duels are scored on the phone).
- **First attempt counts**; later attempts are practice and marked as such.
- **Ties:** higher score, then fewer wrong answers, then less total time.
- **Results:** student gets score immediately; rank, percentile and solutions when the window closes (so answers do not leak to classmates who have not played).
- **Re-scoring:** if the educator removes a faulty question, scores and ranks update for everyone, with a note.

## 3.4 Leaderboards and ranks

- **Room:** this test · this week · all time (sum of first attempts), with rank, score, accuracy, time. The player's own row is always shown, even if far down.
- **Global (per exam):** weekly rank among all players of that exam, from daily duels (best 3 a day, as now) - real players once duels are server-scored; until then the board says "sample" as it does now.
- **Percentile** next to rank ("Top 12%") is more motivating than "Rank 3,412".
- **Privacy:** nicknames only; educators never see emails or phone numbers; students can hide from global ranks (still visible inside their rooms).

## 3.5 Educator dashboard

| Panel | Shows |
| --- | --- |
| Today | Who played, average score, live count during a test window |
| Members | Join requests (approve / decline), members, remove, mute |
| Tests | Upcoming, live, past; duplicate a test; extend a window |
| Results | Score distribution, question-wise accuracy, weakest topics, top movers |
| Question bank | Write, upload, edit, retire; usage count per question |
| Announcements | One-line notices shown at the top of the room |
| Export | Scores as CSV (nicknames only) |

On a computer this is the main place educators work (two-column layout like the current desktop app). On a phone it is a compact version.

## 3.6 Study groups (squads, made real)

Kept small and friendly: invite link, up to 8, one shared daily duel, weekly mission ("30 correct answers together"), preset reactions, leave and report working for real. No chat (safety and moderation cost).
