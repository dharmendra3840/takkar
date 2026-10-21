# 1. Exams and patterns

The player picks their exam once, during onboarding. From then on the exam decides the **marking**, the **time per question**, the **topic mix** and which **sections** appear. They can change it any time in You → Exam.

> **Verify before launch.** The numbers below are the current understanding of each exam's preliminary / first-stage pattern. Exam bodies change patterns between notifications, so each row has to be checked against the latest official notice, and the admin can edit them later without an app update (see `06-data-and-api.md`, "exam patterns as data").

## 1.1 Exams offered at launch

| Group | Exam (first stage) | Questions | Time | Marks per question | Negative | Sections (questions) |
| --- | --- | --- | --- | --- | --- | --- |
| SSC | CGL Tier 1 | 100 | 60 min | 2 | −0.5 | Reasoning 25, General Awareness 25, Quant 25, English 25 |
| SSC | CHSL Tier 1 | 100 | 60 min | 2 | −0.5 | Reasoning 25, General Awareness 25, Quant 25, English 25 |
| SSC | GD Constable | 80 | 60 min | 2 | −0.25 *(verify)* | Reasoning 20, GK 20, Maths 20, English/Hindi 20 |
| SSC | MTS | *(two sessions; verify)* | | | | Numerical, Reasoning, English, GA |
| Banking | IBPS PO Prelims | 100 | 60 min (20 per section) | 1 | −0.25 | English 30, Quant 35, Reasoning 35 |
| Banking | IBPS Clerk Prelims | 100 | 60 min (sectional) | 1 | −0.25 | English 30, Numerical 35, Reasoning 35 |
| Banking | SBI PO / Clerk Prelims | 100 | 60 min (sectional) | 1 | −0.25 | English 30, Quant 35, Reasoning 35 |
| Banking | IBPS RRB PO / Clerk Prelims | 80 | 45 min | 1 | −0.25 | Reasoning 40, Quant 40 |
| Railways | RRB NTPC CBT 1 | 100 | 90 min | 1 | −1/3 | General Awareness 40, Maths 30, Reasoning 30 |
| Railways | RRB Group D | 100 | 90 min | 1 | −1/3 | Maths 25, Reasoning 30, General Science 25, GA 20 |
| Railways | RRB ALP CBT 1 | 75 | 60 min | 1 | −1/3 | Maths, Reasoning, General Science, GA |

## 1.2 What the exam changes in a duel

| | SSC | Banking | Railways |
| --- | --- | --- | --- |
| **Marking** shown and scored | +2 / −0.5 | +1 / −0.25 | +1 / −⅓ |
| **Seconds per question** (exam time ÷ questions) | 36 s | 36 s (RRB: 34 s) | 54 s |
| **Duel of 10** | 5 Quant + 5 Reasoning | 5 Quant + 5 Reasoning, more puzzles and DI | 4 Maths + 6 Reasoning (Group D) / 5 + 5 (NTPC) |
| **Topic weighting** | Percentages, ratio, algebra, geometry, mensuration, trigonometry; analogy, classification, series, coding | Simplification, approximation, quadratic equations, DI, number series; puzzles, seating, inequalities, syllogism | Number system, BODMAS, percentages, SI/CI, time and work; analogy, series, coding, Venn diagrams |
| **Difficulty** | Exam level = tiers 1–2 | Exam level = tiers 1–2, puzzles weighted up | Tier 1 mostly |

Today the app uses **+4 / −1** for everyone, which matches no exam exactly (the ratio is right for SSC and banking, but not for railways). It also uses 20 / 30 / 35 seconds by level. With exams, marking and time follow the exam, and the level setting becomes **Easier / Exam / Harder** inside that exam.

Scores with fractions (−0.25, −⅓) are shown to two decimals, the way the exams show them.

## 1.3 What we can and cannot cover

The engine generates **Quant** and **Reasoning** with answers computed in code (always correct). It cannot generate **English** or **General Awareness / General Science**: those need written questions (from educators, licensed banks, or our own writers). So:

- **Beta:** duels, practice and mini-mocks cover Quant and Reasoning only, and the app says so plainly ("English and GA come from your educator's room for now").
- **Rooms** (see `03-rooms.md`) can include any section, because educators write those questions.
- A **full mock** (all sections) comes when we have written English and GA questions.

## 1.4 Question types we still need (by exam)

Today: 20 Quant and 10 Reasoning types. The gaps that matter most, in build order:

| Priority | Topic | Needed for | Notes |
| --- | --- | --- | --- |
| 1 | Quadratic equations (compare x and y) | Banking | Pure maths, easy to generate |
| 1 | Inequalities (coded and direct) | Banking | Logic, easy to generate |
| 1 | Syllogism | All | Generated from set rules; must be checked carefully |
| 1 | Blood relations | All | Generated family trees |
| 1 | Number system, BODMAS, decimals and fractions | SSC, Railways | |
| 1 | Approximation | Banking | |
| 2 | Seating arrangement and puzzles (linear, circular, floor) | Banking | Generated from constraint solver; harder, high value |
| 2 | Mensuration (2D, 3D), geometry, trigonometry, algebra | SSC, Railways | Some need a diagram (SVG) |
| 2 | Data interpretation (table, bar, pie, line) | Banking, SSC | Needs drawn charts (SVG), sets of 3–5 questions on one chart |
| 2 | Venn diagrams, missing number, mathematical operations | SSC, Railways | |
| 2 | Wrong number series, missing number series | Banking | |
| 3 | Mirror and water images, paper folding, figure series, dice | SSC, Railways | Figure questions; SVG generation |
| 3 | Statement and conclusion, assumptions, data sufficiency | Railways, Banking | Language-heavy; better written than generated |

Each new type goes through the existing release test (100,000 generated questions per level, 0 defects) before it is switched on.

## 1.5 Language

SSC and Railway exams are **bilingual (English and Hindi)**, and a large share of aspirants prefer Hindi. The engine's questions are built from templates, so Hindi versions are a translation of each template, not of every question. Recommended: English at launch, Hindi for the most-used 30 templates in the next phase. **Decision needed** (see README).
