# Takkar: design for the real exam-prep product

For review before we build. Nothing in this folder is built yet.

| File | What it covers |
| --- | --- |
| `wireframes.html` | **Start here.** Visual mock-ups of the key screens (open in a browser). |
| `01-exam-patterns.md` | SSC CGL, IBPS PO, RRB NTPC: patterns, how the exam drives marking, time and topics; question types to build. |
| `02-user-flows.md` | Onboarding, daily loop, friend duel, squad, league and live room (student and educator), edge cases. |
| `03-duels-squads-leagues-rooms.md` | The four ideas and their rules; educator questions; dashboard. |
| `04-screens.md` | Navigation, every screen, interaction rules. |
| `05-gap-audit.md` | What is wrong or fake in the current app and site. |
| `06-data-and-api.md` | Tables, live parts (Durable Objects), API, fairness, free-tier check. |
| `07-roadmap.md` | Build order in four phases. |

## The design in one paragraph

The player picks their exam first (SSC CGL, IBPS PO or RRB NTPC) and everything follows from it: marking (+2/−0.5, +1/−0.25, +1/−⅓), time per question, topic mix. Four clear ideas: a **Duel** is one-to-one (the rival bot, or one friend live); a **Squad** is a study group anyone can start (students or teachers, up to 20); a **League** is an approved educator's class (up to 100); a **Room** is a live test an approved educator schedules: the lobby opens 15 minutes before, everyone starts together, and the doors close at the start. A Practice tab adds topic practice and mini mocks. Every button does something real.

## Decisions taken (22 Oct 2026)

| # | Decision |
| --- | --- |
| 1 | Launch with **SSC CGL, IBPS PO, RRB NTPC** |
| 2 | Keep the names **League** and **Squad** |
| 3 | **Squad** = study group, created by teachers or students |
| 4 | **Room** = live test at a set time; join before the start; late = cannot join |
| 5 | **Duel** = one-to-one, rival bot or a single friend |
| 6 | Only **approved educators** create leagues and rooms |
| 7 | Educator questions **text only** in the beta; rooms up to **100** members |
| 8 | Website gets an **"I'm preparing for…"** exam picker |

## Defaults I chose (change any of these)

| | Default | Why |
| --- | --- | --- |
| Squad size | Up to 20 | Big enough for a teacher's small group, small enough to feel like friends |
| League size | Up to 100 (same as rooms) | Matches the room limit |
| Room lobby | Opens 15 minutes before; grace after start 0 min (educator can set up to 5) | "Late = cannot join", with an option for patchy networks |
| Friend duel lobby | 10 minutes, then it becomes a challenge (24 h) | Nobody waits forever |
| English and GA | In educators' rooms only for now | The engine cannot generate them |
| Hindi | Phase 4 | English first; bilingual later for CGL and NTPC |
| Plus | Shown as "coming soon" until payments are real | No fake demo switch |

## Still needed from you
- **Verify the three exam patterns** in `01-exam-patterns.md` §1.1 against the latest official notices.
- Say **go** for Phase 1 (`07-roadmap.md`).
