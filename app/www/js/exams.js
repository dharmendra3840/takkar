// The exams Takkar prepares for, and how each one plays (design/01-exam-patterns.md).
// Shared by the app and the server. The first three were checked against 2025 notices on 22 Oct 2026,
// the other four against 2026 reports on 3 Nov 2026 (design/01-exam-patterns.md §1.6).
//
// marks / negative: per question, as in the real paper.
// seconds: per question in duels and mocks (exam time ÷ questions).
// weights: how often each question type appears (1 = normal), so a duel feels like this exam.
// quantLabel: what the paper calls its quant section, when that isn't "Quant".
// Order: the picker lists them in this order, under their group.

// Topic weights shared by exams of the same kind.
const SSC_WEIGHTS = {
  'percent-of': 3, 'percent-change': 3, 'ratio-share': 3, 'profit-sp': 2, 'profit-percent': 2, discount: 2, 'successive-discount': 2,
  'simple-interest': 2, 'compound-interest': 2, 'work-together': 2, speed: 2, 'train-platform': 2, 'average-new': 2, simplify: 2, 'lcm-bells': 2,
  'number-series': 3, coding: 3, 'odd-prime': 3, analogy: 3, 'letter-series': 2, direction: 2, 'row-position': 2, 'alphabet-position': 2,
  bodmas: 3, 'unit-digit': 2, 'divisible-add': 2, 'fraction-compare': 2, approximation: 0.5, quadratic: 0.1,
  syllogism: 3, 'blood-relation': 3, 'word-analogy': 3, 'letter-analogy': 2, 'letter-classify': 3, inequality: 0.3,
  // Set 3: SSC papers have the odd small seating question, rarely puzzles or tables.
  'seating-row': 1, 'seating-circle': 0.5, 'floor-puzzle': 0.3, 'di-table': 0.3, 'di-share': 0.3,
};
const BANK_WEIGHTS = {
  simplify: 4, 'number-series': 4, 'percent-of': 2, 'percent-change': 2, 'profit-percent': 2, 'ages-ratio': 2, mixture: 2, partnership: 2,
  boats: 2, 'average-new': 2, 'work-together': 2, pipes: 2, 'compound-interest': 2,
  coding: 3, 'row-position': 3, 'alphabet-position': 3, direction: 2, 'clock-angle': 0.5, calendar: 0.5,
  approximation: 5, quadratic: 5, bodmas: 1, 'unit-digit': 0.5, 'divisible-add': 0.5, 'fraction-compare': 0.5,
  inequality: 5, syllogism: 5, 'blood-relation': 3, 'word-analogy': 0.2, 'letter-analogy': 0.5, 'letter-classify': 0.5,
  // Set 3: puzzles, seating and data interpretation are the biggest parts of bank prelims.
  'seating-row': 5, 'seating-circle': 5, 'floor-puzzle': 6, 'di-table': 6, 'di-share': 5,
};
const RAILWAY_WEIGHTS = {
  'lcm-bells': 3, simplify: 3, 'percent-of': 3, 'simple-interest': 3, 'compound-interest': 2, 'work-together': 3, speed: 2, 'average-new': 2,
  'ratio-share': 2, 'profit-sp': 2,
  analogy: 3, 'number-series': 3, coding: 3, 'odd-prime': 2, direction: 2, calendar: 2, 'clock-angle': 2, 'alphabet-position': 2,
  bodmas: 3, 'unit-digit': 3, 'divisible-add': 3, 'fraction-compare': 2, approximation: 2, quadratic: 0.1,
  syllogism: 3, 'blood-relation': 3, 'word-analogy': 3, 'letter-analogy': 2, 'letter-classify': 3, inequality: 0.5,
  // Set 3: railway papers have some seating and puzzle questions, and the odd table.
  'seating-row': 2, 'seating-circle': 1, 'floor-puzzle': 1, 'di-table': 0.5, 'di-share': 0.5,
};

export const EXAMS = {
  'ssc-cgl': {
    id: 'ssc-cgl', short: 'SSC CGL', name: 'SSC CGL Tier 1', group: 'SSC', badge: 'CGL', color: '#2A3BE8',
    paper: { questions: 100, minutes: 60 }, marks: 2, negative: 0.5, seconds: 36,
    sections: [['Reasoning', 25], ['General Awareness', 25], ['Quant', 25], ['English', 25]],
    mock: { quant: 12, reasoning: 13, minutes: 15, sectional: false },
    weights: SSC_WEIGHTS,
  },
  'ssc-chsl': {
    id: 'ssc-chsl', short: 'SSC CHSL', name: 'SSC CHSL Tier 1', group: 'SSC', badge: 'CHSL', color: '#6D28D9',
    paper: { questions: 100, minutes: 60 }, marks: 2, negative: 0.5, seconds: 36,
    sections: [['English', 25], ['Reasoning', 25], ['Quant', 25], ['General Awareness', 25]],
    // 15 minutes a section since 2026.
    mock: { quant: 12, reasoning: 13, minutes: 15, sectional: true },
    weights: SSC_WEIGHTS,
  },
  'ssc-gd': {
    id: 'ssc-gd', short: 'SSC GD', name: 'SSC GD Constable CBT', group: 'SSC', badge: 'GD', color: '#0369A1', quantLabel: 'Maths',
    paper: { questions: 80, minutes: 60 }, marks: 2, negative: 0.25, seconds: 45,
    sections: [['Reasoning', 20], ['General Knowledge', 20], ['Maths', 20], ['English or Hindi', 20]],
    mock: { quant: 12, reasoning: 13, minutes: 18.75, sectional: false },
    // Elementary maths (10th level) and basic reasoning.
    weights: {
      bodmas: 3, simplify: 3, 'lcm-bells': 3, 'divisible-add': 3, 'unit-digit': 2, 'fraction-compare': 2, 'percent-of': 3, 'ratio-share': 2,
      'average-new': 2, 'simple-interest': 2, 'profit-sp': 2, discount: 2, 'work-together': 2, speed: 2,
      'percent-change': 1, 'profit-percent': 1, 'compound-interest': 1, 'successive-discount': 1, 'train-platform': 1,
      pipes: 0.5, boats: 0.5, mixture: 0.5, partnership: 0.5, 'ages-ratio': 0.5, approximation: 0.5, quadratic: 0.1,
      analogy: 3, 'word-analogy': 3, 'letter-analogy': 2, 'letter-classify': 3, 'odd-prime': 3, 'number-series': 3, 'letter-series': 2,
      coding: 3, 'alphabet-position': 3, direction: 2, 'blood-relation': 2, 'row-position': 2,
      syllogism: 1, calendar: 1, 'clock-angle': 1, inequality: 0.2,
      'seating-row': 0.5, 'seating-circle': 0.2, 'floor-puzzle': 0.2, 'di-table': 0.2, 'di-share': 0.2,
    },
  },
  'ibps-po': {
    id: 'ibps-po', short: 'IBPS PO', name: 'IBPS PO Prelims', group: 'Banking', badge: 'PO', color: '#0B6B50',
    paper: { questions: 100, minutes: 60 }, marks: 1, negative: 0.25, seconds: 36,
    sections: [['English', 30], ['Quant', 35], ['Reasoning', 35]],
    // Since 2025 the paper weights sections differently (Quant 30 marks, Reasoning 40, for 35 questions each).
    // Takkar counts 1 mark a question so duels stay comparable; the −¼ penalty ratio is the same.
    note: 'In the real paper Reasoning carries 40 marks and Quant 30 (35 questions each). Takkar counts every question as 1 mark; the ¼ penalty works the same way.',
    mock: { quant: 12, reasoning: 13, minutes: 15, sectional: true },
    weights: BANK_WEIGHTS,
  },
  'ibps-rrb': {
    id: 'ibps-rrb', short: 'IBPS RRB', name: 'IBPS RRB PO & Clerk Prelims', group: 'Banking', badge: 'RRB', color: '#4D7C0F',
    paper: { questions: 80, minutes: 45 }, marks: 1, negative: 0.25, seconds: 34,
    sections: [['Reasoning', 40], ['Quant', 40]],
    // The paper gives Reasoning 25 minutes and Quant 20; a duel keeps one clock of about the average.
    note: 'In the real paper Reasoning has 25 minutes and Quant 20, one after the other. Takkar gives every question 34 seconds, about the average.',
    mock: { quant: 12, reasoning: 13, minutes: 14, sectional: true },
    weights: BANK_WEIGHTS,
  },
  'rrb-ntpc': {
    id: 'rrb-ntpc', short: 'RRB NTPC', name: 'RRB NTPC CBT 1', group: 'Railways', badge: 'NTPC', color: '#B84700', quantLabel: 'Maths',
    paper: { questions: 100, minutes: 90 }, marks: 1, negative: 1 / 3, seconds: 54,
    sections: [['General Awareness', 40], ['Maths', 30], ['Reasoning', 30]],
    mock: { quant: 12, reasoning: 13, minutes: 22.5, sectional: false },
    weights: RAILWAY_WEIGHTS,
  },
  'rrb-group-d': {
    id: 'rrb-group-d', short: 'RRB Group D', name: 'RRB Group D CBT', group: 'Railways', badge: 'Gr D', color: '#9F1239', quantLabel: 'Maths',
    paper: { questions: 100, minutes: 90 }, marks: 1, negative: 1 / 3, seconds: 54,
    sections: [['General Science', 25], ['Maths', 25], ['Reasoning', 30], ['General Awareness', 20]],
    mock: { quant: 12, reasoning: 13, minutes: 22.5, sectional: false },
    weights: RAILWAY_WEIGHTS,
  },
};

export const EXAM_IDS = Object.keys(EXAMS);
export const getExam = (id) => EXAMS[id] || null;

/** The groups in picker order, each with its exams: [['SSC', [exam, …]], …]. */
export function examGroups() {
  const groups = new Map();
  for (const e of Object.values(EXAMS)) groups.set(e.group, [...(groups.get(e.group) || []), e]);
  return [...groups];
}

/** "+2 / −0.5" style marking label. */
export function markingLabel(exam) {
  const neg = exam.negative === 1 / 3 ? '⅓' : String(exam.negative);
  return `+${exam.marks} / −${neg}`;
}

/** "Quant" for the engine's quant topic, or what the exam's paper calls it ("Maths" for railways and SSC GD). */
export const quantName = (exam) => (exam && exam.quantLabel) || 'Quant';
