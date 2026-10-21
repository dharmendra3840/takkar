# 4. Screens

Visual mock-ups of the key new screens are in **`wireframes.html`** (open it in a browser). This file lists every screen and what changes.

## 4.1 Navigation

| Phone tab bar / desktop sidebar | Now | Proposed |
| --- | --- | --- |
| 1 | Home | **Home** (exam-aware: countdown, daily duel, continue, today's room test) |
| 2 | League (demo) | **Practice** (topic practice, mini mocks, challenges) |
| 3 | Squad (demo) | **Rooms** (my class rooms and study groups, join with code, create) |
| 4 | Ranks | **Ranks** (my exam, weekly; percentile) |
| 5 | You | **You** (exam, goal, stats by topic, account, settings) |

## 4.2 Screen list

| Area | Screen | Status |
| --- | --- | --- |
| Onboarding | Welcome (sign in / guest) | Exists; reorder after exam pick |
| | Pick exam group (SSC / Banking / Railways) | **New** |
| | Pick exam (CGL, CHSL, IBPS PO …) | **New** |
| | Exam date (optional) | **New** |
| | Nickname + 18+ | Exists |
| | "Your exam's rules" (marking, time) | **New** |
| | Daily goal + reminder (after first duel) | **New** |
| Home | Today: countdown, daily duel card, continue, room test, streak | Change |
| Duel | Question / reveal / leave | Exists; marking and timer from exam; section label |
| | Result: exam marks, topic breakdown, next step suggestion | Change |
| Practice | Topic list grouped by section with my accuracy per topic | **New** |
| | Topic practice session | **New** (reuses duel screens without a rival) |
| | Mini mock: instructions → test with section tabs and palette → analysis | **New** |
| Rooms | My rooms list + join with code | **New** (replaces League/Squad) |
| | Room page (student): next test, leaderboard, announcements | **New** |
| | Room test (server-served questions, question palette) | **New** |
| | Room results (after window) | **New** |
| | Create room wizard (6 steps) | **New** |
| | Educator dashboard (tabs: Today, Members, Tests, Results, Questions) | **New** |
| | Question editor + sheet upload with row checks | **New** |
| | Become an educator (application) | **New** |
| Ranks | Weekly rank in my exam, percentile, top 10 + me | Change |
| You | Exam and date, daily goal, accuracy by topic and section, account, follow, report, delete | Change |
| Website | Landing: exam picker in hero ("I'm preparing for…") leading into onboarding | Change |
| Admin | Rooms, educator applications, question moderation, exam patterns editor | **New** |

## 4.3 Interaction rules (apply everywhere)

- One primary button per screen, bottom on phones, inline on computers.
- Every button does something real. Nothing shows "In the full app…" any more: if a feature is not ready, the button is not shown.
- Destructive actions (leave room, delete, remove member) always confirm in a dialog naming the thing.
- Every list has an empty state that says what to do next ("No rooms yet. Ask your teacher for a code, or create a study group").
- Every network action shows progress and a clear error with "Try again".
- Back always goes to the previous screen; inside a test, Back asks before leaving.
- Timers are server time in tests; the phone only displays them.
