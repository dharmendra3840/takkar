# 1. Exams and patterns

**Decision (22 Oct 2026): three exams at launch, one per group.** More exams are added later from the same data file without app changes.

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
| 2 | Seating arrangement and puzzles | | ✓ | | Constraint solver; high value for PO |
| 2 | Data interpretation (table, bar, pie) | ✓ | ✓ | | Drawn charts, 3–5 questions per chart |
| 2 | Venn diagrams, mathematical operations, missing number | ✓ | | ✓ | |
| 3 | Mirror images, paper folding, figure series | ✓ | | ✓ | Figure generation |
| 3 | Statement and conclusion, data sufficiency | | ✓ | ✓ | Better written than generated |

Each new type passes the release test (100,000 generated questions per level, 0 defects) before it is switched on.

## 1.5 Language

CGL and NTPC are bilingual (English and Hindi). Recommended: English at launch; Hindi for the most-used templates in Phase 3. *(Open decision.)*
