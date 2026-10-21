# 7. Build order

Each phase ends with something testers can use, all tests passing, and the website promising only what works.

## Phase 1: exam-first app (about 1–2 weeks)
1. `exams.js` with the patterns in `01-exam-patterns.md` (after you verify them).
2. Onboarding: exam group → exam → date → nickname → "your exam's rules" → first duel → daily goal.
3. Duels use the exam's marking, time and topic mix; result in exam marks with a topic breakdown and a "practise this next" button.
4. Practice tab: topic practice (unlimited) and mini mock (25 questions, sectional timing for banking).
5. You: change exam, date, goal, nickname.
6. Fix the flow faults in `05-gap-audit.md` §5.3 that do not need rooms (first-duel rules screen, rematch label, resume warning).
7. Website: hero exam picker ("I'm preparing for…") that opens onboarding with the exam selected; remove claims that are not real.
8. First batch of new question types (priority 1 in §1.4).

## Phase 2: rooms (about 2–3 weeks)
1. Server-scored tests (`tests`, `attempts`), used first by rooms.
2. Become an educator → admin approval.
3. Create room wizard, invite link page (`/r/CODE`), join with approval.
4. Question bank: write, sheet upload with row checks, reuse; rights confirmation.
5. Room tests: schedule, take, results after close, leaderboards (test / week / all time).
6. Educator dashboard on computer and phone.
7. Study groups replace the squad demo; League and Squad tabs become Rooms.
8. Admin: rooms, applications, question moderation, exam pattern editor.

## Phase 3: depth (after testers)
- Daily duels server-scored → real global ranks per exam, percentiles.
- Hindi for the top templates; priority 2 and 3 question types (puzzles, DI with charts, figure questions).
- Push notifications (Android) and email reminders; test-starts-soon alerts.
- Plus with real payments (Razorpay), only for features that exist.
- Images in educator questions; formula editor.
- English and GA from licensed or written banks; full mocks.

## What I need from you before Phase 1
See the decisions list in `README.md`.
