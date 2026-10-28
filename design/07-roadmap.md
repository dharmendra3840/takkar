# 7. Build order

Each phase ends with something testers can use, all tests passing, and the website promising only what works.

## Phase 1: exam-first app
1. `exams.js` for SSC CGL, IBPS PO, RRB NTPC (after the patterns are verified).
2. Onboarding: exam → month → sign in → nickname → your exam's rules → first duel → daily goal.
3. Rival duels use the exam's marking, time and topic mix; scores in exam marks (twelfths on the server); result with topic breakdown and "practise this next".
4. Practice tab: topic practice and mini mock (25 questions, exam timing, sectional clock for IBPS PO).
5. Navigation: Home · Practice · League · Squad · You (Ranks inside League).
6. You: change exam, month, goal, nickname.
7. Website: "I'm preparing for…" exam picker in the hero; remove claims that are not real; Plus shown as "coming soon".
8. Priority 1 question types from `01-exam-patterns.md` §1.4.
9. Challenge codes carry the exam (new code version; old codes still open).

## Phase 2: Squads and friend duels

**Decisions (28 Oct 2026):** Phase 1 is done (app 0.4.0). Squads are built first, then live friend duels. Squads and friend duels need sign-in; Google sign-in for now, real phone SMS (Firebase Blaze) when Takkar opens to the public. Squads hold up to **20 members** in the beta.

**Squads, step by step**
1. Server: migration (squads get `exam_id`, `invite_code`, `max_members`; members get `role`), routes to create, preview, join, leave, remove, hand over ownership, report, react; today's squad duel (same seed for every member that day) and the daily table; weekly mission totals from members' own duels.
2. App: Squad tab with "your squads", create (name, exam), invite link and code, join from a link (`/play/?squad=CODE`), squad page (today's duel, table, mission, members, reactions), owner actions. Guests see the sign-in step first.
3. Admin: the existing squad list and close action, plus member counts and reports.
4. Tests: server tests for every route and limit (20 members, one squad per invite, owner rules), browser tests for the flows, a two-player test (two accounts in one squad).
1. Durable Objects set up; authenticated WebSocket tickets.
2. Friend duel: invite, lobby, live duel, result; fallback to challenge after 10 minutes.
3. Squads: create, join, members, owner actions, leave and report (real), daily squad duel and table, weekly mission, reactions.
4. Squad tab replaces the demo.

## Phase 3: Leagues and Rooms (educators)
1. Become an educator → admin approval.
2. Leagues: create, invite, approve members (100 max), daily league duel, weekly table, announcements, Monday report.
3. Question bank: write, sheet upload with row checks, reuse; rights confirmation; moderation.
4. Rooms: create (6 steps), RSVP, lobby, doors close at start, live test served by the `TestRoom` object, results, re-scoring.
5. Educator dashboard (computer and phone).
6. Admin: applications, leagues, rooms, question moderation, exam pattern editor.

## Phase 4: depth
- Real global ranks per exam (server-scored duels), percentiles.
- Push notifications (Android) and email: room reminders, squad nudges, duel invites.
- Hindi for the top templates; priority 2 and 3 question types (puzzles, DI, figures).
- Images and formulas in educator questions.
- Plus with real payments (Razorpay), only for features that exist.
- More exams in each group.
