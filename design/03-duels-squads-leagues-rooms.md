# 3. Duels, Squads, Leagues and Rooms

**Decisions (22 Oct 2026):** four separate ideas, each with one clear job. Names stay **League** and **Squad**.

| | **Duel** | **Squad** | **League** | **Room** |
| --- | --- | --- | --- | --- |
| What it is | One-to-one: you against the rival bot or one friend | A study group | An educator's ongoing class or channel | A **live test** at a fixed time |
| Who creates | Anyone | Anyone (students or teachers) | **Approved educators only** | **Approved educators only** |
| Size (beta) | 2 | Up to 20 | Up to 100 | Up to **100** |
| Timing | Any time | Ongoing | Ongoing, weekly table | Starts at a set time. **Doors close at the start.** Late = cannot join |
| Questions | Takkar engine, your exam's pattern | Takkar engine | Takkar engine | Engine, the educator's own (text only), or both |
| Result | Win / lose, mistakes with steps | Daily squad table, weekly mission | Weekly table, Monday report | Rank, percentile, solutions after the room ends |

How they connect: a **League** is where an educator keeps their students; they schedule **Rooms** for the league (or for anyone with the invite). A **Squad** is where friends (or a teacher with a small group) practise together every day. A **Duel** is the quick one-to-one game, solo against the bot or against one friend.

---

## 3.1 Duel (one-to-one)

**Rival duel** (exists): you against the bot, 10 questions in your exam's pattern.

**Friend duel** (new, two ways):

1. **Live:** you tap *Duel a friend* → a link and a 6-letter code. The friend opens it and both land in a small lobby with each other's nickname. When both tap *Ready*, a 3-second countdown, then both get the same 10 questions at the same moment. During the duel each sees the other's score on the same blue/orange bar as the rival bot, live, and "Rohit answered" ticks, but never their answer. The result shows both scores and, for each question, who got it right.
2. **If the friend isn't there in 10 minutes**, the lobby turns into a **challenge** (what exists today): you play now, they get 24 hours to beat your score. Nobody waits forever.

Rules: same exam for both (the friend sees "This duel is SSC CGL pattern"; if they prepare for another exam they can still accept). Live duels are server-timed and server-scored. They count for the weekly rank like rival duels only if both play to the end. Leaving mid-duel counts as a loss for the leaver.

## 3.2 Squad (study group)

- **Anyone creates** one: name, exam, invite link. Teachers can create squads for small groups too (no approval needed; it is not a class).
- **Up to 20 members** in the beta. Owner can remove members and hand over ownership. Anyone can leave or report a member (real actions, not messages).
- **Daily squad duel:** the same 10 questions for every member that day, any time before midnight; a squad table for the day.
- **Weekly mission:** e.g. "150 correct answers together"; size scales with members.
- **Reactions:** 6 presets, no free chat (safety).
- **Squad duel challenge:** any member can start a live friend duel with another member from the squad page.

## 3.3 League (educator's class)

- Only **approved educators** create leagues (You → Become an educator → admin approves within 24 hours).
- **Up to 100 members** in the beta. Join with link or code; approval on by default; educator approves, removes, mutes.
- **Daily league duel** (as the current demo, made real): same questions for all, first attempt counts, weekly table, Monday report to the educator.
- **Announcements:** one-line notices at the top.
- **Rooms** for the league are listed on the league page ("Live test tonight at 8 pm").

## 3.4 Room (live test)

The heart of the educator offer: a real exam-like test, everyone at the same time.

**Life of a room**

```
Created ──► Scheduled ──► Lobby open (15 min before) ──► Live (doors close) ──► Ended ──► Results
                           join here                      no new joins          ranks, solutions
```

- **Created** by an approved educator: title, exam pattern (marking, time), question source (engine topics / own questions / both), number of questions, **start time**, duration (from the pattern; editable), who can join (league members, or anyone with the link), max 100.
- **Scheduled:** the room appears in members' League page and on Home with a countdown; students tap **"I'll be there"** to get a reminder (push and email in Phase 3).
- **Lobby (opens 15 minutes before):** students **join** here. They see the start countdown, how many have joined, the rules (marking, time, no switching apps), and a connection check. Joining is the only way in.
- **Live (at start time):** everyone in the lobby gets question 1 at the same moment. **Doors close: nobody can join after the start.** Latecomers see "This test started at 8:00 pm. Joining closed at the start." with a link to the league's next room. The clock is the server's. Questions come one at a time from the server; the full set and the answer key never reach the phone.
- **Disconnected mid-test?** Rejoin is allowed for anyone who joined before the start (their clock kept running).
- **Ended:** at the end time (or when everyone has submitted), scores are final.
- **Results:** rank, percentile, score, section-wise marks, and every question with the right answer and the educator's solution. The educator gets the full analysis (score spread, hardest questions, who missed the room).

**Fairness**: one attempt per student, server-timed and server-scored; a student who reports a wrong question goes to the educator; if the educator removes the question, everyone is re-scored with a note.

## 3.5 Educator questions (text only in the beta)

Three ways in, all landing in the educator's **question bank** (private to their leagues and rooms):

1. **Write one:** question, 4 options, correct option, solution, section, topic, difficulty; live preview.
2. **Upload a sheet** (CSV or Excel from our template): every row checked, clear reasons for bad rows ("Row 14: answer must be A, B, C or D"), only good rows imported, up to 200 rows.
3. **Reuse:** questions from their other rooms, or engine questions by topic.

Rules: rights confirmation on first upload ("I wrote these or have the right to use them; not copied from exam papers or paid material"), word filter, reports from students go to the educator first, admin can hide any question or room. Images and formula editor come later; simple symbols (², √, ÷, π) work now.

## 3.6 Educator dashboard

On a computer (two columns, like the current desktop app) with a compact phone version:

| Tab | Shows |
| --- | --- |
| League | Members (requests, approve, remove), announcements, daily duel table, Monday report |
| Rooms | Upcoming, live (joined count, submitted count), ended; create, duplicate, cancel |
| Results | Per room: score spread, average, top 10, hardest questions, section split, who missed it; export (nicknames only) |
| Questions | Bank: write, upload, edit, retire; usage per question |
