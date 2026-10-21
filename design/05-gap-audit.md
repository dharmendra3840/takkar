# 5. Gaps and faults in what exists today

Found by reading the app, server and website code (22 Oct 2026). Grouped by how much they matter for "real exam preparation".

## 5.1 Must fix for the real product

| # | Where | What is wrong today | Fix in this design |
| --- | --- | --- | --- |
| 1 | Whole app | No exam choice. Everyone gets the same mixed questions and **+4 / −1** marking, which matches no exam exactly; railway players learn the wrong penalty. | Exam onboarding; marking and time from the exam (`01-exam-patterns.md`). |
| 2 | Duels | Scored on the phone, so scores and ranks can be faked. Fine for practice, not for leaderboards. | Server-scored tests for rooms first, then daily duels. |
| 3 | League tab | A demo with **sample students**. "Approve members" and "Reset invite code" only show a message. Invite codes cannot be used to join. | Real class rooms (`03-rooms.md`). |
| 4 | Squad tab | A demo with sample mates. "Leave squad" and "Report a member" only show a message; invite shares a link to the game, not to the squad. | Real study groups. |
| 5 | Ranks | Other players are samples. | Real weekly rank per exam once duels are server-scored. |
| 6 | Topics | 30 question types; missing high-frequency topics for banking (quadratic equations, inequalities, puzzles, DI) and SSC (geometry, mensuration, trigonometry, algebra). | Build list in `01-exam-patterns.md` §1.4. |
| 7 | Sections | No English or General Awareness. | Say so in the app; educators can add them in rooms; written banks later. |
| 8 | Sign-in | Google and phone sign-in built but off until Firebase is set up. | Waiting on Firebase details. |

## 5.2 Broken promises (remove or build)

| # | Where | Claim | Reality |
| --- | --- | --- | --- |
| 9 | Website plans, Plus screen | "Rest days that protect your streak" | Not built. |
| 10 | Website plans | "Squad themes and badges" | Not built. |
| 11 | Website plans | Plus: "Accuracy and speed by topic" | Free users already get this on You. |
| 12 | You | "Daily reminder" switch | Saves the choice; sends nothing (no notifications yet). |
| 13 | Plus | "Try Plus" | Demo only; no payments. |
| 14 | Website FAQ / landing | "Squads of up to eight", league with weekly report | Demo only. |

Proposal: until each is real, the website lists only what works, and Plus shows "Coming soon" with a waitlist instead of a demo switch.

## 5.3 Flow and button faults

| # | Where | Fault |
| --- | --- | --- |
| 15 | First open | Goes straight into a duel without explaining marking; first-time players get negative scores and do not know why. |
| 16 | Result | Only lists mistakes; no "what to do next" (weak topic → practice it). |
| 17 | Home | No continue / resume; a duel left halfway cannot be resumed (by design), but the app does not say so before leaving. |
| 18 | You | Cannot change nickname (only the admin can rename). |
| 19 | You | No place to change exam, goal or language (none exist yet). |
| 20 | Challenge | Challenge codes carry the questions' seed inside the code; fine for friends, but room tests must use server IDs. |
| 21 | Rematch | Uses one of the 3 free duels, which surprises players; show "uses 1 free duel" on the button. |
| 22 | Educators | Website "Talk to us" is an email link only; no in-app way to become an educator. |
| 23 | Android | No push notifications, so reminders and "test starts in 10 min" cannot reach players. |
| 24 | Guests | Can play but cannot join rooms; the app needs to explain why at the moment they try. |
| 25 | Hindi | No Hindi anywhere, while SSC and Railway exams are bilingual. |

## 5.4 Smaller polish items

- Ranks tab shows "14 more players above you" with sample data.
- League preview on the intro uses fixed sample numbers ("24 members, 68%").
- Badges: only 4, and "Squad mission" depends on a demo squad.
- Settings sheet "Rival bot" strength is the only difficulty control; with exams, difficulty should be "Easier / Exam / Harder" within the exam.
