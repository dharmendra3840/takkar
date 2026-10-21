# 4. Screens

Visual mock-ups are in **`wireframes.html`**. This file lists every screen and what changes.

## 4.1 Navigation (phone tab bar, desktop sidebar)

| | Now | New |
| --- | --- | --- |
| 1 | Home | **Home**: exam countdown, rival duel, duel a friend, today's squad duel, live room tonight, practise next |
| 2 | League (demo) | **Practice**: topic practice, mini mocks |
| 3 | Squad (demo) | **League**: my leagues, upcoming and live rooms, weekly ranks in my exam (segment) |
| 4 | Ranks | **Squad**: my squads, today's squad duel, mission |
| 5 | You | **You**: exam and date, goal, stats, account, become an educator |

Ranks move inside League (a "Ranks" segment), because the league is where competition lives. Duels start from Home.

## 4.2 Screen list

| Area | Screen | Status |
| --- | --- | --- |
| Onboarding | Which exam (3 cards) · exam month · sign in · nickname + 18+ · your exam's rules · daily goal | New / changed |
| Home | Countdown, duel cards, squad duel, live room, practise next | Changed |
| Duel | Rival duel (exists, exam marking and timer) · Friend duel: invite, lobby, live duel, result | Changed / **new** |
| Practice | Topics by section with my accuracy · topic practice session · mini mock (instructions, test with section tabs and palette, analysis) | **New** |
| Squad | List / create / join · squad page (daily squad duel, table, mission, members, reactions) · manage (owner) | **New** (replaces demo) |
| League | My leagues + rooms + ranks · league page (daily duel, table, rooms, announcements) · join / waiting | **New** (replaces demo) |
| Room | Room card (countdown, I'll be there) · lobby · live test (server questions, palette) · doors-closed screen · submitted · results | **New** |
| Educator | Become an educator · create league · create room (6 steps) · question bank (write, upload with row checks) · dashboard | **New** |
| You | Exam and month, goal, nickname, stats by topic and section, account, follow, report, delete | Changed |
| Website | Hero exam picker "I'm preparing for…" → `/play/?exam=…` | **New** |
| Admin | Educator applications · leagues · rooms · question moderation · exam patterns editor | **New** |

## 4.3 Interaction rules

- One primary button per screen.
- Every button does something real; nothing says "in the full app". Not ready = not shown.
- Destructive actions (leave, remove, delete, cancel room) confirm in a dialog naming the thing.
- Every list has an empty state with the next step.
- Every network action shows progress and a clear error with "Try again".
- Back goes to the previous screen; inside a duel or room test, Back asks first.
- Timers in friend duels and rooms are server time; the phone only shows them.
