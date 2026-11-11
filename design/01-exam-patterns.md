# 1. Exams and patterns

**Decision (22 Oct 2026): three exams at launch, one per group.** More exams are added later from the same data file without app changes.

**Decision (3 Nov 2026): four more exams**, the ones with the most searches and exams coming up: SSC CHSL, SSC GD, IBPS RRB (PO and Clerk prelims share one pattern) and RRB Group D (§1.6). Seven in all, shown in the picker under SSC, Banking and Railways.

The player picks their exam during onboarding. From then on the exam decides the **marking**, the **time per question**, the **topic mix** and the **sections**. They can change it any time in You → Exam; ranks and results are kept per exam.

> **Checked 22 Oct 2026** against 2025 notices as reported by coaching sites (official PDFs not fetched): SSC CGL and RRB NTPC match. IBPS PO 2025 changed section weights (below).
>
> **Verify before launch.** These are the current understanding of each exam's first stage. Exam bodies change patterns between notifications, so each row must be checked against the latest official notice. The admin can edit them later without an app update (`06-data-and-api.md` §6.1).

## 1.1 Exams at launch

| | SSC CGL Tier 1 | IBPS PO Prelims | RRB NTPC CBT 1 |
| --- | --- | --- | --- |
| Questions | 100 | 100 | 100 |
| Time | 60 min | 60 min, 20 per section | 90 min |
| Marks per question | 2 | 1 on average (Quant 35 Q = 30 marks, Reasoning 35 Q = 40 marks, English 30 Q = 30 marks, since 2025) | 1 |
| Negative | −0.5 | −¼ of the question's marks | −⅓ |
| Sections | Reasoning 25, General Awareness 25, Quant 25, English 25 | English 30, Quant 35, Reasoning 35 | General Awareness 40, Maths 30, Reasoning 30 |
| Seconds per question | 36 | 36 (sectional clock) | 54 |
| Coming next in the group | CHSL, GD, MTS | IBPS Clerk, SBI PO/Clerk, RRB PO/Clerk | Group D, ALP |

## 1.2 What the exam changes

| | SSC CGL | IBPS PO | RRB NTPC |
| --- | --- | --- | --- |
| Marking in duels, rooms, mocks | +2 / −0.5 | +1 / −0.25 | +1 / −⅓ |
| Duel of 10 | 5 Quant + 5 Reasoning | 5 Quant + 5 Reasoning | 5 Maths + 5 Reasoning |
| Mini mock (25) | 12 Quant + 13 Reasoning, 15 min | 12 + 13, sectional 7.5 + 7.5 min | 12 + 13, 22.5 min |
| Topics weighted up | Percentages, ratio, algebra, geometry, mensuration, trigonometry; analogy, classification, series, coding | Simplification, approximation, quadratic equations, number series, DI; puzzles, seating, inequalities, syllogism | Number system, BODMAS, percentages, SI/CI, time and work; analogy, series, coding, Venn diagrams |
| Level setting | Easier / Exam / Harder (question difficulty tiers inside the exam). Time per question always follows the exam. | | |

Scores with fractions are shown to two decimals, as the exams show them.

**IBPS PO simplification:** Takkar counts every IBPS PO question as +1 / −0.25. The real 2025 paper gives Quant questions 30/35 of a mark and Reasoning 40/35, with the same ¼ penalty. Keeping 1 mark a question keeps duels comparable and scores in twelfths; the rules screen says so.

Sources: [SSC CGL (PW)](https://store.pw.live/blogs/ssc-exams/ssc-cgl-exam-pattern-2025), [IBPS PO revised 2025 (Careers360)](https://competition.careers360.com/articles/ibps-po-exam-pattern-2025-revised), [IBPS PO changes (Oliveboard)](https://www.oliveboard.in/blog/major-changes-in-ibps-po-2025/), [RRB NTPC (IIT Kanpur SATHEE)](https://rrb.iitk.ac.in/sathee-railway-exams/rrb-exams/rrb-ntpc/rrb-details/exam-pattern), [RRB NTPC 2025 CBT 1 (Careers360)](https://news.careers360.com/rrb-ntpc-2025-cbt-1-exams-from-june-5-to-23-for-8113-graduate-level-posts/amp).

## 1.3 What we can and cannot cover

The engine generates **Quant** and **Reasoning** with answers computed in code (always correct). It cannot generate **English** or **General Awareness**. So duels and mini mocks are Quant and Reasoning only, and the app says so ("English and General Awareness are coming later") until rooms arrive. Educators' rooms can include any section because they write those questions.

## 1.4 Question types to build, for these three exams

Today: 20 Quant and 10 Reasoning types.

| Priority | Topic | CGL | PO | NTPC | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Number system, BODMAS, fractions and decimals | ✓ | | ✓ | |
| 1 | Simplification and approximation | | ✓ | ✓ | Simplification exists; add approximation |
| 1 | Quadratic equations (compare x and y) | | ✓ | | |
| 1 | Inequalities (direct and coded) | | ✓ | | |
| 1 | Syllogism | ✓ | ✓ | ✓ | Generated from set rules; checked carefully |
| 1 | Blood relations | ✓ | ✓ | ✓ | |
| 1 | Analogy and classification (word/number/letter) | ✓ | | ✓ | Number analogy exists |
| 2 | Algebra, geometry, mensuration, trigonometry | ✓ | | ✓ | Some need a diagram (SVG) |
| 2 | Seating arrangement and puzzles | | ✓ | | **Built (set 3, app 0.10.0):** row and circle seating, floor puzzles |
| 2 | Data interpretation (table, bar, pie) | ✓ | ✓ | | **Tables built (set 3, app 0.10.0)**; bar and pie charts not yet |
| 2 | Venn diagrams, mathematical operations, missing number | ✓ | | ✓ | |
| 3 | Mirror images, paper folding, figure series | ✓ | | ✓ | Figure generation |
| 3 | Statement and conclusion, data sufficiency | | ✓ | ✓ | Better written than generated |

Each new type passes the release test (100,000 generated questions per level, 0 defects) before it is switched on.

**Question set 3 (11 November 2026, app 0.10.0, `app/www/js/engine/bank.js`): the bank-exam types.**

- **Seating arrangement:** a row of 5 or 6 people facing north (tier 1: 5; tiers 2 and 3: 6, no "from the left end" clues at tier 3), and 6 around a round table facing the centre (tiers 2 and 3). **Puzzles:** 5 or 6 people on the floors of a building (tier 3: 6, no "lives on floor n" clues). People are letters, as in the papers, never I or O. The clues are chosen from facts true of a random arrangement until only it fits (every arrangement is tried), then any clue the others make unnecessary is dropped; at most 6 or 7 clues. The question asks something no clue says outright: who sits where, how many sit between two people, who lives on a floor. The steps give the one arrangement that fits.
- **Data interpretation:** a table of two series over five years (tier 1: totals and differences; tier 2: averages and a percentage rise; tier 3: ratios, "what percent of", the year of the widest gap), and a total shared by percentage (tier 1: one share's amount; tier 2: the difference of two; tier 3: one as a percent of another, or their ratio). Figures are chosen so answers are whole numbers or simple ratios.
- Each question has `view` for apps from 0.10.0 (the data as a table, or the clues as a list, with the question apart) and the whole question in `text` as plain sentences, for older apps, the website and the tutor's paper. They take **twice the usual time** in a duel (`time: 2`); the server's duel checks allow it.
- The release test solves every one from its text alone with its own solver (`app/tests/bank-solver.mjs`): exactly one arrangement must fit, and its answer must be the question's.
- Weights: bank exams 5 to 6 (the biggest parts of their papers), railways 0.5 to 2, SSC 0.3 to 1. The daily question takes them from 16 November 2026; earlier days keep their questions.

## 1.5 Language

CGL and NTPC are bilingual (English and Hindi). Recommended: English at launch; Hindi for the most-used templates in Phase 3.

**Decided 4 November 2026: Hindi first, for every question type.** Most aspirants for these exams prepare and sit the paper in Hindi, so Hindi comes before tutor live tests.

- **What is in Hindi:** every question, its options, its solution steps and its topic name, for all 42 types; also share messages (challenges, live duels, squads, leagues). App buttons and screens stay in English for now (a full Hindi app is a later step).
- **How it looks:** the question shows in the player's language with a one-tap हिंदी / EN switch on the question, like the real exam's language toggle. The choice is remembered (settings and the switch).
- **Same question, two languages:** the Hindi text is built from the same numbers as the English, with no extra random draws, so a seed gives the same questions, answers and option order in both. Challenge codes, live duels (a Hindi player against an English one) and saved results work unchanged. Each player's option order is still seeded from the English text.
- **Exam conventions:** digits stay 0–9 and ₹; letter puzzles (coding, series, alphabet, inequalities) keep English capital letters, as the Hindi papers do. Terms follow the papers: साधारण ब्याज, चक्रवृद्धि ब्याज, बट्टा/छूट, अंकित मूल्य, क्रमशः, न्याय निगमन, रक्त संबंध.
- **Blood relations in Hindi** use the side-specific words the papers use (चाचा/मामा, बुआ/मौसी, भतीजा/भांजा, दादा/नाना, पोता/नाती), worked out from the puzzle.
- **Checks:** a test generates every type at every level for many seeds and checks that each Hindi question has four different options, the same answer position as the English, an उत्तर line, and no stray English words. An independent language review of every wording variant (248 examples) was done before release; its fixes are in (4 Nov 2026).
- **Where a Hindi pair would be ambiguous**, the Hindi may use a parallel item rather than a word-for-word one, keeping the answer's place: the word analogy *Ant : Anthill* is *दीमक : बाँबी* in Hindi, because an ant's home is also called बिल, the rabbit's answer.
- **On the website (4 Nov 2026):** the Hindi exam guides show their sample questions in Hindi; Hindi practice pages at /hi/practice (the same 19 topics, the method written in Hindi, the same five questions in Hindi); a Hindi question of the day at /hi/question-of-the-day (same question as the English, with its own archive and dated pages). English and Hindi pages point at each other (hreflang). Links from Hindi pages open the app with `?lang=hi`, which turns on Hindi questions for a player who has not chosen a language.

## 1.6 Added 3 November 2026

> **Checked 3 Nov 2026** against 2026 reports from coaching and exam sites (official PDFs not fetched); they agree on every number below.

| | SSC CHSL Tier 1 | SSC GD Constable | IBPS RRB PO and Clerk Prelims | RRB Group D |
| --- | --- | --- | --- | --- |
| Questions | 100 | 80 | 80 | 100 |
| Time | 60 min, 15 per section (sectional timer new in 2026) | 60 min | 45 min: Reasoning 25, Quant 20 (sectional since 2024) | 90 min |
| Marks per question | 2 | 2 | 1 | 1 |
| Negative | −0.5 | −0.25 | −¼ | −⅓ |
| Sections | English 25, Reasoning 25, Quant 25, General Awareness 25 | Reasoning 20, General Knowledge 20, Elementary Maths 20, English or Hindi 20 | Reasoning 40, Quant 40 (Numerical Ability for Clerk) | General Science 25, Maths 25, Reasoning 30, General Awareness 20 |
| Seconds per question in Takkar | 36 | 45 | 34 (the real paper: 37.5 for Reasoning, 30 for Quant; one clock per duel keeps it simple) | 54 |
| Mini mock (12 + 13) | 15 min, sectional | 18.75 min | 14 min, sectional | 22.5 min |
| Topics weighted up | As CGL, at 10+2 level | Number system, BODMAS, simplification, LCM and HCF, percentages; analogy, classification, series, coding, alphabet test | As IBPS PO: simplification, approximation, quadratic equations, series; inequalities, syllogism, coding | As NTPC |
| Exams coming up (reported) | Tier 1: 30 Nov to 31 Dec 2026 | 2026 exam postponed, new date awaited | PO prelims 21 to 22 Nov 2026; Clerk 6, 12 and 13 Dec 2026 | 2026 CBT held; next cycle 2027 |

Badges in the app: CGL, CHSL, GD (SSC); PO, RRB (Banking); NTPC, Gr D (Railways). SSC GD, IBPS RRB and RRB Group D call the quant section Maths or Quant as their papers do (`quantLabel`).

**Apps before 0.6.0** know only the first three exams. The server sends them no exam for a player who chose a newer one, so the old app asks them to pick again instead of scoring duels the old way.

Sources: [SSC CHSL pattern 2026 (Adda247)](https://www.adda247.com/jobs/ssc-chsl-exam-pattern/), [SSC CHSL dates (Adda247)](https://www.adda247.com/exams/ssc/ssc-chsl-notification-2026-out/), [SSC GD pattern (Oliveboard)](https://www.oliveboard.in/ssc-gd-exam-pattern/), [SSC GD 2026 postponed (Careers360)](https://news.careers360.com/ssc-gd-constable-2026-exam-postponed-25487-vacancies-new-date-soon-capfs-ssf-assam-rifles-pattern-hall-ticket-city-slip-updates/amp), [IBPS RRB pattern (Career Power)](https://www.careerpower.in/ibps-rrb-syllabus-exam-pattern.html), [IBPS RRB dates (Adda247)](https://www.adda247.com/ibps-rrb-po-clerk), [RRB Group D pattern (Career Power)](https://www.careerpower.in/rrb-group-d-exam-pattern.html), [RRB Group D (Testbook)](https://testbook.com/rrb-group-d/exam-pattern).
