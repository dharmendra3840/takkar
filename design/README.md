# Takkar: design for the real exam-prep product

For review before we build. Nothing in this folder is built yet.

| File | What it covers |
| --- | --- |
| `wireframes.html` | **Start here.** Visual mock-ups of the key new screens (open in a browser). |
| `01-exam-patterns.md` | Exams offered, their patterns, how the exam changes marking, time and topics; question types still needed; Hindi. |
| `02-user-flows.md` | Onboarding, daily loop, practice modes, rooms for students and educators, edge cases. |
| `03-rooms.md` | Rooms (class rooms and study groups), educator questions and uploads, tests, scoring, leaderboards, dashboard. |
| `04-screens.md` | Every screen, new or changed; navigation; interaction rules. |
| `05-gap-audit.md` | What is wrong or fake in the current app and site, and how this design fixes it. |
| `06-data-and-api.md` | Tables, endpoints, security and fairness, admin additions, free-tier check. |
| `07-roadmap.md` | Build order in three phases. |

## The design in one paragraph

The player picks their exam first (SSC, Banking or Railways, then the exact exam), and everything follows from it: marking (+2/−0.5, +1/−0.25 or +1/−⅓), seconds per question, topic mix and sections. The League and Squad demos become **Rooms**: class rooms run by verified educators (their own questions or ours, scheduled tests, server-scored, real leaderboards) and small study groups for friends. A new **Practice** tab adds topic practice and mini mocks that feel like the real CBT. Every button does something real; anything not ready is not shown.

## Decisions I need from you

1. **Exams at launch.** All in `01-exam-patterns.md` §1.1, or start with fewer (for example SSC CGL, IBPS PO, RRB NTPC)? Fewer means each gets better topic coverage sooner.
2. **Verify the patterns.** Please check the table against the latest official notices (or tell me which notification to follow).
3. **Rooms naming.** "Rooms" for both class rooms and study groups, or keep "League" for educators and "Squad" for friends?
4. **Who can create class rooms.** Approved educators only (recommended), or any adult in the beta?
5. **Educator questions.** OK to start with text-only questions (images later)? Max room size for the beta (default 500)?
6. **English and GA.** Leave them out of duels and mocks for now (rooms only), as proposed?
7. **Hindi.** English only at launch, Hindi for the top templates in phase 3, or earlier?
8. **Plus.** Hide Plus until payments are real (recommended), or keep the demo?
9. **Website.** Add an "I'm preparing for…" exam picker in the hero that starts onboarding?

When you are happy with these, I start Phase 1 (`07-roadmap.md`).
